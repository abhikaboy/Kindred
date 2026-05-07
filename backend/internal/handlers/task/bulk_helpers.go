package task

import (
	"log/slog"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// bulkTaskItem is the interface that both BulkCompleteTaskItem and BulkDeleteTaskItem satisfy.
type bulkTaskItem interface {
	GetTaskID() string
	GetCategoryID() string
}

// parsedBulkTask holds the parsed ObjectIDs from a bulk task item.
type parsedBulkTask struct {
	taskID     primitive.ObjectID
	categoryID primitive.ObjectID
	index      int
}

// parseBulkTaskIDs validates and parses hex string IDs into ObjectIDs.
// Returns the valid parsed tasks and a list of failed task ID strings.
func parseBulkTaskIDs(items []bulkTaskItem) ([]parsedBulkTask, []string) {
	valid := make([]parsedBulkTask, 0, len(items))
	failed := make([]string, 0)

	for i, item := range items {
		taskID, err := primitive.ObjectIDFromHex(item.GetTaskID())
		if err != nil {
			failed = append(failed, item.GetTaskID())
			slog.Warn("Invalid task ID in bulk operation", "taskID", item.GetTaskID(), "error", err)
			continue
		}

		categoryID, err := primitive.ObjectIDFromHex(item.GetCategoryID())
		if err != nil {
			failed = append(failed, item.GetTaskID())
			slog.Warn("Invalid category ID in bulk operation", "categoryID", item.GetCategoryID(), "error", err)
			continue
		}

		valid = append(valid, parsedBulkTask{
			taskID:     taskID,
			categoryID: categoryID,
			index:      i,
		})
	}

	return valid, failed
}
