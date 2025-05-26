package task

import (
	"fmt"
	"log/slog"

	"github.com/robfig/cron/v3"
	"go.mongodb.org/mongo-driver/mongo"
)

/*
Router maps endpoints to handlers
*/
func Cron(collections map[string]*mongo.Collection) {
	service := newService(collections)

	// Get all tasks with start times older than one da	y

	c := cron.New()
	id, err := c.AddFunc("@every 1m", func() {
		slog.Info("Cron job started")
		tasks := make([]TemplateTaskDocument, 0)
		recurringTasks, err := service.GetTasksWithStartTimesOlderThanOneDay()
		if err != nil {
			slog.Error("Error getting tasks with start times older than one day", "error", err)
		}
		tasks = append(tasks, recurringTasks...)

		recurringTasks, err = service.GetRecurringTasksWithPastDeadlines()
		if err != nil {
			slog.Error("Error getting recurring tasks with past deadlines", "error", err)
		}
		tasks = append(tasks, recurringTasks...)

		slog.Info("Tasks to process", "count", len(tasks))
		for _, task := range tasks {
			// TOOD: Optimize to take the template itself rather than the ID
			newTask, err := service.CreateTaskFromTemplate(task.ID)
			if err != nil {
				slog.Error("Error creating task from template", "error", err)
				if err.Error() == "mongo: no documents in result" {
					slog.Info("No template found, deleting task", "task", task.ID)
				}
			} else {
				fmt.Println(newTask)
			}
		}
		slog.Info("Cron job finished")
	})
	if err != nil {
		slog.Error("Error adding cron job", "error", err)
	}

	c.Start()
	slog.Info("Cron scheduler started", "id", id)
}
