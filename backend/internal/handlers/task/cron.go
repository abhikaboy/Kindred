package task

import (
	"fmt"
	"log/slog"
	"time"

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
		tasks := make([]TaskDocument, 0)
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
			if task.Deadline != nil {
				fmt.Println("DEADLINE: " + task.ID.Hex() + " " + task.Content + " " + task.Deadline.Format(time.RFC3339))
			} else if task.StartDate != nil {
				fmt.Println("START TIME: " + task.ID.Hex() + " " + task.Content + " " + task.StartDate.Format(time.RFC3339))
			}

			newTask, err := service.CreateTaskFromTemplate(task.TemplateID)
			if err != nil {
				slog.Error("Error creating task from template", "error", err)
				if err.Error() == "mongo: no documents in result" {
					slog.Info("No template found, deleting task", "task", task.TemplateID)
					// delete the task somehow 
					err = service.DeleteTaskByID(task.ID)
					if err != nil {
						slog.Error("Error deleting task from template", "error", err)
					}
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


