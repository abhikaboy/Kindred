package task

import (
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var validator = xvalidator.Validator

type Handler struct {
	service *Service
}

func (h *Handler) GetTasksByUser(c *fiber.Ctx) error {
	user_id := c.UserContext().Value("user_id").(string)

	id := c.Query("id", user_id) // uses the logged in user if not specified
	userId, err := primitive.ObjectIDFromHex(id)

	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format " + err.Error() + " ID: " + id,
		})
	}

	var sort SortParams

	sort.SortBy = c.Query("sortBy", "timestamp")
	sort.SortDir, err = strconv.Atoi(c.Query("sortDir", "-1"))

	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid sortDir format",
		})
	}

	sortAggregation := bson.D{
		{Key: "$sort", Value: bson.M{
			sort.SortBy: sort.SortDir,
		}},
	}

	Tasks, err := h.service.GetTasksByUser(userId, sortAggregation)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.JSON(Tasks)
}

// parseTimesToUTC parses deadline, startTime, and startDate to UTC format
func parseTimesToUTC(params *CreateTaskParams) (*time.Time, *time.Time, *time.Time, error) {
	var deadline, startTime, startDate *time.Time

	if params.Deadline != nil {
		parsedDeadline, err := xutils.ParseTimeToUTC(*params.Deadline)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("invalid deadline format: %w", err)
		}
		deadline = &parsedDeadline
	}

	if params.StartTime != nil {
		parsedStartTime, err := xutils.ParseTimeToUTC(*params.StartTime)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("invalid start time format: %w", err)
		}
		startTime = &parsedStartTime
	}

	if params.StartDate != nil {
		parsedStartDate, err := xutils.ParseTimeToUTC(*params.StartDate)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("invalid start date format: %w", err)
		}
		startDate = &parsedStartDate
	}

	return deadline, startTime, startDate, nil
}

func (h *Handler) CreateTask(c *fiber.Ctx) error {
	var params CreateTaskParams

	user_id := c.UserContext().Value("user_id").(string)

	err, ids := xutils.ParseIDs(c, c.Params("category"), user_id)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(err)
	}
	_, categoryId := ids[1], ids[0]

	if err := c.BodyParser(&params); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if err := validator.Validate(params); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(err)
	}
	/**
	Truncating the start date to the start of the day to
	make sure its detected as 1 day old as soon as the new day starts
	*/
	if params.StartDate != nil {
		// remove the time and only keep the date
		truncated := params.StartDate.Truncate(24 * time.Hour)
		params.StartDate = &truncated
	}

	if params.RecurDetails != nil {
		if params.RecurDetails.Every == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Every is required",
			})
		}
	}
	// parse times to UTC
	deadline, startTime, startDate, err := parseTimesToUTC(&params)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	doc := TaskDocument{
		ID:             primitive.NewObjectID(),
		Priority:       params.Priority,
		Content:        params.Content,
		Value:          params.Value,
		Recurring:      params.Recurring,
		RecurFrequency: params.RecurFrequency,
		Public:         params.Public,
		Active:         params.Active,
		Timestamp:      xutils.NowUTC(),
		Notes:          params.Notes,
		Checklist:      params.Checklist,
		Reminders:      params.Reminders,
		Deadline:       deadline,
		StartTime:      startTime,
		StartDate:      startDate,
	}

	var template_id primitive.ObjectID = primitive.NewObjectID()
	if doc.Recurring {
		if params.RecurFrequency == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid recurring frequency",
			})
		} else {
		}
		if params.RecurDetails == nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Recurring details are required",
			})
		} else {
		}

		recurType := "OCCURRENCE"

		// if we have a deadline with no start information
		if params.Deadline != nil {
			recurType = "DEADLINE"
			if params.StartTime != nil || params.StartDate != nil {
				recurType = "WINDOW"
			}
		}

		baseTime := xutils.NowUTC()
		if params.Deadline != nil {
			baseTime = *params.Deadline
		} else if params.StartTime != nil {
			baseTime = *params.StartTime
		}
		// Create a template for the recurring task
		template_doc := TemplateTaskDocument{
			CategoryID:     categoryId,
			ID:             template_id,
			Content:        params.Content,
			Priority:       params.Priority,
			Value:          params.Value,
			Public:         params.Public,
			RecurType:      recurType,
			RecurFrequency: params.RecurFrequency,
			RecurDetails:   params.RecurDetails,

			Deadline:      deadline,
			StartTime:     startTime,
			StartDate:     startDate,
			LastGenerated: &baseTime,
		}

		var next_occurence time.Time
		if recurType == "OCCURRENCE" {
			next_occurence, err = h.service.ComputeNextOccurrence(&template_doc)
			if err != nil {
				slog.LogAttrs(c.Context(), slog.LevelError, "Error creating OCCURENCE template task", slog.String("error", err.Error()))
				return c.Status(fiber.StatusInternalServerError).JSON(err)
			}
		} else if recurType == "DEADLINE" {
			next_occurence, err = h.service.ComputeNextDeadline(&template_doc)
			if err != nil {
				slog.LogAttrs(c.Context(), slog.LevelError, "Error creating DEADLINE template task", slog.String("error", err.Error()))
				return c.Status(fiber.StatusInternalServerError).JSON(err)
			}
		} else if recurType == "WINDOW" {
			next_occurence, err = h.service.ComputeNextOccurrence(&template_doc)
			if err != nil {
				slog.LogAttrs(c.Context(), slog.LevelError, "Error creating WINDOW template task", slog.String("error", err.Error()))
				return c.Status(fiber.StatusInternalServerError).JSON(err)
			}
		}

		template_doc.NextGenerated = &next_occurence

		_, err = h.service.CreateTemplateTask(categoryId, &template_doc)
		if err != nil {
			slog.LogAttrs(c.Context(), slog.LevelError, "Error creating template task", slog.String("error", err.Error()))
			return c.Status(fiber.StatusInternalServerError).JSON(err)
		}

		doc.TemplateID = template_id
	}

	_, err = h.service.CreateTask(categoryId, &doc)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.Status(fiber.StatusCreated).JSON(doc)
}

func (h *Handler) GetTasks(c *fiber.Ctx) error {
	Tasks, err := h.service.GetAllTasks()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch Tasks",
		})
	}

	return c.JSON(Tasks)
}

func (h *Handler) GetTask(c *fiber.Ctx) error {
	user_id := c.UserContext().Value("user_id").(string)
	userId, err := primitive.ObjectIDFromHex(user_id)

	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	Task, err := h.service.GetTaskByID(id, userId)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Task not found",
		})
	}

	return c.JSON(Task)
}

/*
*

	@TODO - Add a verification to check if the user is the owner of the task
*/
func (h *Handler) UpdateTask(c *fiber.Ctx) error {
	context_id := c.UserContext().Value("user_id").(string)

	_, err := primitive.ObjectIDFromHex(context_id)
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	categoryId, err := primitive.ObjectIDFromHex(c.Params("category"))

	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	var update UpdateTaskDocument
	if err := c.BodyParser(&update); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if _, err := h.service.UpdatePartialTask(id, categoryId, update); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.SendStatus(fiber.StatusOK)
}

/*
*

	@TODO - Add a verification to check if the user is the owner of the task
*/
func (h *Handler) CompleteTask(c *fiber.Ctx) error {
	context_id := c.UserContext().Value("user_id").(string)

	err, ids := xutils.ParseIDs(c, context_id, c.Params("category"), c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(err)
	}
	user_id, categoryId, id := ids[0], ids[1], ids[2]

	var data CompleteTaskDocument
	if err := c.BodyParser(&data); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if err := h.service.CompleteTask(user_id, id, categoryId, data); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	if err = h.service.IncrementTaskCompletedAndDelete(user_id, categoryId, id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.SendStatus(fiber.StatusOK)
}

/**
@TODO - Add a verification to check if the user is the owner of the task
*/

func (h *Handler) DeleteTask(c *fiber.Ctx) error {
	context_id := c.UserContext().Value("user_id").(string)

	err, ids := xutils.ParseIDs(c, context_id, c.Params("category"), c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(err)
	}
	_, categoryId, id := ids[0], ids[1], ids[2]

	if err := h.service.DeleteTask(categoryId, id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.SendStatus(fiber.StatusOK)
}

func (h *Handler) ActivateTask(c *fiber.Ctx) error {
	context_id := c.UserContext().Value("user_id").(string)

	err, ids := xutils.ParseIDs(c, context_id, c.Params("category"), c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(err)
	}
	user_id, categoryId, id := ids[0], ids[1], ids[2]

	newStatus := c.QueryBool("active", false)

	if err := h.service.ActivateTask(user_id, categoryId, id, newStatus); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.SendStatus(fiber.StatusOK)
}

func (h *Handler) GetActiveTasks(c *fiber.Ctx) error {

	err, ids := xutils.ParseIDs(c, c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(err)
	}
	id := ids[0]

	tasks, err := h.service.GetActiveTasks(id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.JSON(tasks)
}

func (h *Handler) CreateTaskFromTemplate(c *fiber.Ctx) error {
	templateId := c.Params("id")

	templateOID, err := primitive.ObjectIDFromHex(templateId)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	template, err := h.service.CreateTaskFromTemplate(templateOID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.JSON(template)
}

/*
Get all the tasks with start times that are at least a day older than the current time
*/
func (h *Handler) GetTasksWithStartTimesOlderThanOneDay(c *fiber.Ctx) error {
	tasks, err := h.service.GetTasksWithStartTimesOlderThanOneDay()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.JSON(tasks)
}

func (h *Handler) GetRecurringTasksWithPastDeadlines(c *fiber.Ctx) error {
	tasks, err := h.service.GetRecurringTasksWithPastDeadlines()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.JSON(tasks)
}

// UpdateTaskNotes updates the notes field of a task
func (h *Handler) UpdateTaskNotes(c *fiber.Ctx) error {
	context_id := c.UserContext().Value("user_id").(string)
	userId, err := primitive.ObjectIDFromHex(context_id)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID format",
		})
	}

	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	categoryId, err := primitive.ObjectIDFromHex(c.Params("category"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	var update UpdateTaskNotesDocument
	if err := c.BodyParser(&update); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if err := h.service.UpdateTaskNotes(id, categoryId, userId, update); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.SendStatus(fiber.StatusOK)
}

// UpdateTaskChecklist updates the checklist field of a task
func (h *Handler) UpdateTaskChecklist(c *fiber.Ctx) error {
	context_id := c.UserContext().Value("user_id").(string)

	err, ids := xutils.ParseIDs(c, context_id, c.Params("category"), c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(err)
	}
	userId, categoryId, id := ids[0], ids[1], ids[2]

	var update UpdateTaskChecklistDocument
	if err := c.BodyParser(&update); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if err := h.service.UpdateTaskChecklist(id, categoryId, userId, update); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.SendStatus(fiber.StatusOK)
}
