package task

import (
	"bufio"
	"context"
	"fmt"
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// NewStreamHandler creates a Handler for SSE streaming routes.
func NewStreamHandler(collections map[string]*mongo.Collection, geminiService any) *Handler {
	service := newService(collections)
	return &Handler{
		service:       service,
		geminiService: geminiService,
	}
}

// nlpStreamBody is the common request body for all NLP streaming endpoints.
type nlpStreamBody struct {
	Text     string `json:"text"`
	Timezone string `json:"timezone,omitempty"`
}

// parseNLPBody parses the common text/timezone body from a Fiber request.
func parseNLPBody(c *fiber.Ctx) (nlpStreamBody, error) {
	var body nlpStreamBody
	if err := c.BodyParser(&body); err != nil {
		return body, err
	}
	if body.Text == "" {
		return body, fmt.Errorf("text field is required")
	}
	if body.Timezone == "" {
		body.Timezone = "America/New_York"
	}
	return body, nil
}

// consumeCredit consumes one NL credit and returns a non-nil error (with HTTP response already
// written) if it fails. The caller should return nil after this returns an error.
func (h *Handler) consumeNLCredit(c *fiber.Ctx, ctx context.Context, userObjID primitive.ObjectID, userID string) error {
	err := h.service.Users.ConsumeCredit(ctx, userObjID, types.CreditTypeNaturalLanguage)
	if err != nil {
		if err == types.ErrInsufficientCredits {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Insufficient credits. You need at least 1 natural language credit to use this feature.",
			})
		}
		slog.LogAttrs(ctx, slog.LevelError, "Failed to consume credit",
			slog.String("userID", userID),
			slog.String("error", err.Error()))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Unable to process your credit. Please try again later.",
		})
	}
	return nil
}

// refundNLCredit refunds one NL credit after a flow failure, logging but not surfacing errors.
func (h *Handler) refundNLCredit(ctx context.Context, userObjID primitive.ObjectID, userID string) {
	if refundErr := h.service.Users.AddCredits(ctx, userObjID, types.CreditTypeNaturalLanguage, 1); refundErr != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to refund credit after AI failure",
			slog.String("userID", userID),
			slog.String("refundError", refundErr.Error()))
	} else {
		slog.LogAttrs(ctx, slog.LevelInfo, "Credit successfully refunded",
			slog.String("userID", userID))
	}
}

// setSSEHeaders sets the required SSE response headers.
func setSSEHeaders(c *fiber.Ctx) {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")
}

// StreamIntentNaturalLanguage handles POST /api/v1/user/tasks/natural-language/intent/stream
func (h *Handler) StreamIntentNaturalLanguage(c *fiber.Ctx) error {
	body, err := parseNLPBody(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	userID, err := auth.RequireAuthFiber(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Please log in to continue"})
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid user ID format"})
	}

	ctx := c.UserContext()

	if err := h.consumeNLCredit(c, ctx, userObjID, userID); err != nil {
		return nil
	}

	setSSEHeaders(c)

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		sse := NewSSEWriter(w)

		sse.Send("status", map[string]string{"stage": "starting", "message": "Processing your request..."})

		slog.LogAttrs(ctx, slog.LevelInfo, "Starting streaming intent NL routing",
			slog.String("userID", userID),
			slog.String("inputText", body.Text),
			slog.String("timezone", body.Timezone))

		intentOutput, err := h.callGeminiIntentFlow(ctx, userID, body.Text, body.Timezone)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "First attempt to call Gemini intent flow failed, retrying",
				slog.String("userID", userID),
				slog.String("error", err.Error()))
			sse.Send("status", map[string]string{"stage": "retrying", "message": "Retrying AI request..."})

			intentOutput, err = h.callGeminiIntentFlow(ctx, userID, body.Text, body.Timezone)
			if err != nil {
				h.refundNLCredit(ctx, userObjID, userID)
				sse.SendError("Failed to process natural language intent with AI after retry. Your credit has been refunded.")
				return
			}
		}

		sse.Send("status", map[string]string{"stage": "processing_results", "message": "Processing results..."})

		var responseOps []IntentOpResponse

		for _, op := range intentOutput.Ops {
			switch op.Type {
			case "edit":
				if op.EditPayload == nil {
					continue
				}
				editedTasks, editedTemplates, totalEdited := h.applyEditInstructions(ctx, userObjID, userID, op.EditPayload)
				responseOps = append(responseOps, IntentOpResponse{
					Type: "edit",
					EditResult: &EditResultResponse{
						Tasks:       editedTasks,
						Templates:   editedTemplates,
						EditedCount: totalEdited,
					},
				})

			case "delete":
				if op.DeletePayload == nil {
					continue
				}
				filters, err := convertQueryOutput(op.DeletePayload)
				if err != nil {
					slog.LogAttrs(ctx, slog.LevelWarn, "Failed to convert delete query output",
						slog.String("error", err.Error()))
					continue
				}
				tasks, err := h.service.QueryTasksByUser(userObjID, filters)
				if err != nil {
					slog.LogAttrs(ctx, slog.LevelWarn, "Failed to query tasks for delete op",
						slog.String("error", err.Error()))
					continue
				}
				responseOps = append(responseOps, IntentOpResponse{
					Type:        "delete",
					DeleteTasks: tasks,
				})

			case "create":
				if op.CreatePayload == nil {
					continue
				}
				responseOps = append(responseOps, IntentOpResponse{
					Type:          "create",
					CreatePreview: op.CreatePayload,
				})
			}
		}

		if responseOps == nil {
			responseOps = []IntentOpResponse{}
		}

		slog.LogAttrs(ctx, slog.LevelInfo, "Streaming intent NL routing completed",
			slog.String("userID", userID),
			slog.Int("opCount", len(responseOps)))

		sse.Send("result", map[string]interface{}{"ops": responseOps})
	})

	return nil
}

// StreamCreateNaturalLanguage handles POST /api/v1/user/tasks/natural-language/stream
func (h *Handler) StreamCreateNaturalLanguage(c *fiber.Ctx) error {
	body, err := parseNLPBody(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	userID, err := auth.RequireAuthFiber(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Please log in to continue"})
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid user ID format"})
	}

	ctx := c.UserContext()

	if err := h.consumeNLCredit(c, ctx, userObjID, userID); err != nil {
		return nil
	}

	setSSEHeaders(c)

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		sse := NewSSEWriter(w)

		sse.Send("status", map[string]string{"stage": "starting", "message": "Processing your request..."})

		slog.LogAttrs(ctx, slog.LevelInfo, "Starting streaming NL task creation",
			slog.String("userID", userID),
			slog.String("inputText", body.Text),
			slog.String("timezone", body.Timezone))

		result, err := h.callGeminiFlow(ctx, userID, body.Text, body.Timezone)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "First attempt to call Gemini flow failed, retrying",
				slog.String("userID", userID),
				slog.String("error", err.Error()))
			sse.Send("status", map[string]string{"stage": "retrying", "message": "Retrying AI request..."})

			result, err = h.callGeminiFlow(ctx, userID, body.Text, body.Timezone)
			if err != nil {
				h.refundNLCredit(ctx, userObjID, userID)
				sse.SendError("Failed to process natural language with AI after retry. Your credit has been refunded.")
				return
			}
		}

		sse.Send("status", map[string]string{"stage": "processing_results", "message": "Creating tasks..."})

		newCategoryTasks, newCategoryMetadata, categoriesCreated, newCategoryTaskCount, err := h.processNewCategories(ctx, result.Categories, userObjID)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Failed to process new categories",
				slog.String("userID", userID),
				slog.String("error", err.Error()))
			sse.SendError(err.Error())
			return
		}

		existingCategoryTasks, existingCategoryTaskCount, err := h.processExistingCategoryTasks(ctx, result.Tasks, userObjID)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Failed to process existing category tasks",
				slog.String("userID", userID),
				slog.String("error", err.Error()))
			sse.SendError(err.Error())
			return
		}

		allTasks := append(newCategoryTasks, existingCategoryTasks...)
		totalTasks := newCategoryTaskCount + existingCategoryTaskCount

		var message string
		if totalTasks == 0 {
			message = "No valid tasks could be created from the provided text"
		} else if categoriesCreated > 0 {
			message = fmt.Sprintf("Successfully created %d tasks in %d new categories", totalTasks, categoriesCreated)
		} else {
			message = fmt.Sprintf("Successfully created %d tasks in existing categories", totalTasks)
		}

		slog.LogAttrs(ctx, slog.LevelInfo, "Streaming NL task creation completed",
			slog.String("userID", userID),
			slog.Int("totalTasks", totalTasks),
			slog.Int("categoriesCreated", categoriesCreated))

		sse.Send("result", map[string]interface{}{
			"categoriesCreated": categoriesCreated,
			"newCategories":     newCategoryMetadata,
			"tasksCreated":      totalTasks,
			"tasks":             allTasks,
			"message":           message,
		})
	})

	return nil
}

// StreamQueryNaturalLanguage handles POST /api/v1/user/tasks/natural-language/query/stream
func (h *Handler) StreamQueryNaturalLanguage(c *fiber.Ctx) error {
	body, err := parseNLPBody(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	userID, err := auth.RequireAuthFiber(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Please log in to continue"})
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid user ID format"})
	}

	ctx := c.UserContext()

	if err := h.consumeNLCredit(c, ctx, userObjID, userID); err != nil {
		return nil
	}

	setSSEHeaders(c)

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		sse := NewSSEWriter(w)

		sse.Send("status", map[string]string{"stage": "starting", "message": "Processing your query..."})

		slog.LogAttrs(ctx, slog.LevelInfo, "Starting streaming NL task query",
			slog.String("userID", userID),
			slog.String("inputText", body.Text),
			slog.String("timezone", body.Timezone))

		queryOutput, err := h.callGeminiQueryFlow(ctx, userID, body.Text, body.Timezone)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "First attempt to call Gemini query flow failed, retrying",
				slog.String("userID", userID),
				slog.String("error", err.Error()))
			sse.Send("status", map[string]string{"stage": "retrying", "message": "Retrying AI request..."})

			queryOutput, err = h.callGeminiQueryFlow(ctx, userID, body.Text, body.Timezone)
			if err != nil {
				h.refundNLCredit(ctx, userObjID, userID)
				sse.SendError("Failed to process natural language query with AI after retry. Your credit has been refunded.")
				return
			}
		}

		sse.Send("status", map[string]string{"stage": "processing_results", "message": "Querying tasks..."})

		filters, err := convertQueryOutput(queryOutput)
		if err != nil {
			slog.Error("Failed to parse AI query response", "userId", userID, "error", err)
			sse.SendError("The AI response could not be interpreted. Please try rephrasing your query.")
			return
		}

		tasks, err := h.service.QueryTasksByUser(userObjID, filters)
		if err != nil {
			slog.Error("Failed to execute NL task query", "userId", userID, "error", err)
			sse.SendError("Unable to query tasks due to a server error. Please try again.")
			return
		}

		slog.LogAttrs(ctx, slog.LevelInfo, "Streaming NL task query completed",
			slog.String("userID", userID),
			slog.Int("taskCount", len(tasks)))

		sse.Send("result", map[string]interface{}{
			"tasks": tasks,
			"query": filters,
		})
	})

	return nil
}

// StreamEditNaturalLanguage handles POST /api/v1/user/tasks/natural-language/edit/stream
func (h *Handler) StreamEditNaturalLanguage(c *fiber.Ctx) error {
	body, err := parseNLPBody(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	userID, err := auth.RequireAuthFiber(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Please log in to continue"})
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid user ID format"})
	}

	ctx := c.UserContext()

	if err := h.consumeNLCredit(c, ctx, userObjID, userID); err != nil {
		return nil
	}

	setSSEHeaders(c)

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		sse := NewSSEWriter(w)

		sse.Send("status", map[string]string{"stage": "starting", "message": "Processing your edit..."})

		slog.LogAttrs(ctx, slog.LevelInfo, "Starting streaming NL task edit",
			slog.String("userID", userID),
			slog.String("inputText", body.Text),
			slog.String("timezone", body.Timezone))

		editOutput, err := h.callGeminiEditFlow(ctx, userID, body.Text, body.Timezone)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "First attempt to call Gemini edit flow failed, retrying",
				slog.String("userID", userID),
				slog.String("error", err.Error()))
			sse.Send("status", map[string]string{"stage": "retrying", "message": "Retrying AI request..."})

			editOutput, err = h.callGeminiEditFlow(ctx, userID, body.Text, body.Timezone)
			if err != nil {
				h.refundNLCredit(ctx, userObjID, userID)
				sse.SendError("Failed to process natural language edit with AI after retry. Your credit has been refunded.")
				return
			}
		}

		sse.Send("status", map[string]string{"stage": "processing_results", "message": "Applying edits..."})

		editedTasks, editedTemplates, totalEdited := h.applyEditInstructions(ctx, userObjID, userID, editOutput)

		var message string
		switch totalEdited {
		case 0:
			message = "No matching tasks found"
		case 1:
			message = "Successfully edited 1 task"
		default:
			message = fmt.Sprintf("Successfully edited %d tasks", totalEdited)
		}

		slog.LogAttrs(ctx, slog.LevelInfo, "Streaming NL task edit completed",
			slog.String("userID", userID),
			slog.Int("editedTasks", len(editedTasks)),
			slog.Int("editedTemplates", len(editedTemplates)))

		sse.Send("result", map[string]interface{}{
			"tasks":       editedTasks,
			"templates":   editedTemplates,
			"editedCount": totalEdited,
			"message":     message,
		})
	})

	return nil
}
