package task

import (
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

/*
Router maps endpoints to handlers
*/
func Routes(app *fiber.App, collections map[string]*mongo.Collection) {
	service := newService(collections)
	handler := Handler{service}

	// Add a group for API versioning
	apiV1 := app.Group("/v1")

	// Add Sample group under API Version 1
	Tasks := apiV1.Group("/tasks")

	Tasks.Get("/", handler.GetTasks)
	Tasks.Get("/:id", handler.GetTask)

	// Tasks.Get("/completed", handler.GetCompletedTasks)
	Tasks.Get("/active/:id", handler.GetActiveTasks)

	AuthorizedTasks := app.Group("/v1/user/tasks")
	AuthorizedTasks.Get("/", handler.GetTasksByUser)
	AuthorizedTasks.Post("/:category", handler.CreateTask)
	AuthorizedTasks.Delete("/:category/:id", handler.DeleteTask)
	AuthorizedTasks.Patch("/:category/:id", handler.UpdateTask)
	AuthorizedTasks.Post("/complete/:category/:id", handler.CompleteTask)

	AuthorizedTasks.Post("/active/:category/:id", handler.ActivateTask)

	AuthorizedTasks.Post("/template/:id", handler.CreateTaskFromTemplate)
	AuthorizedTasks.Get("/template/old", handler.GetTasksWithStartTimesOlderThanOneDay)
	AuthorizedTasks.Get("/template/pastDeadline", handler.GetRecurringTasksWithPastDeadlines)

	AuthorizedTasks.Post("/:category/:id/notes", handler.UpdateTaskNotes)
	AuthorizedTasks.Post("/:category/:id/checklist", handler.UpdateTaskChecklist)
	// AuthorizedTasks.Get("/reminders", handler.HandleReminder)
	AuthorizedTasks.Post("/:category/:id/reminder", handler.AddReminderToTask)
}
