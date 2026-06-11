package Post

import (
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// optionalTime extracts a nullable datetime field from a pipeline document.
func optionalTime(doc bson.M, key string) *time.Time {
	if dt, ok := doc[key].(primitive.DateTime); ok {
		t := dt.Time()
		return &t
	}
	return nil
}

// parseTaskCandidate converts a GetFriendsPublicTasks pipeline document into
// a scoring candidate. Returns false if any required field is malformed
// (the task is skipped, matching previous handler behavior).
func parseTaskCandidate(task bson.M) (*taskCandidate, bool) {
	taskID, ok := task["_id"].(primitive.ObjectID)
	if !ok {
		return nil, false
	}
	content, ok := task["content"].(string)
	if !ok {
		return nil, false
	}
	priority, ok := task["priority"].(int32)
	if !ok {
		return nil, false
	}
	value, ok := task["value"].(float64)
	if !ok {
		return nil, false
	}
	public, ok := task["public"].(bool)
	if !ok {
		return nil, false
	}
	timestamp, ok := task["timestamp"].(primitive.DateTime)
	if !ok {
		return nil, false
	}
	categoryID, ok := task["categoryId"].(primitive.ObjectID)
	if !ok {
		return nil, false
	}
	categoryName, ok := task["categoryName"].(string)
	if !ok {
		return nil, false
	}
	workspaceName, ok := task["workspaceName"].(string)
	if !ok {
		return nil, false
	}

	var taskUser *types.UserExtendedReference
	if userDoc, ok := task["user"].(bson.M); ok {
		if id, ok := userDoc["_id"].(primitive.ObjectID); ok {
			if handle, ok := userDoc["handle"].(string); ok {
				if displayName, ok := userDoc["display_name"].(string); ok {
					if profilePicture, ok := userDoc["profile_picture"].(string); ok {
						taskUser = &types.UserExtendedReference{
							ID:             id.Hex(),
							Handle:         handle,
							DisplayName:    displayName,
							ProfilePicture: profilePicture,
						}
					}
				}
			}
		}
	}

	createdAt := timestamp.Time()
	return &taskCandidate{
		feedTask: FeedTaskData{
			ID:            taskID.Hex(),
			Content:       content,
			Priority:      int(priority),
			Value:         value,
			Public:        public,
			Timestamp:     createdAt.Format(time.RFC3339),
			CategoryID:    categoryID.Hex(),
			CategoryName:  categoryName,
			WorkspaceName: workspaceName,
			User:          taskUser,
		},
		createdAt:      createdAt,
		deadline:       optionalTime(task, "deadline"),
		startTime:      optionalTime(task, "startTime"),
		startDate:      optionalTime(task, "startDate"),
		workingOnSince: optionalTime(task, "workingOnSince"),
	}, true
}
