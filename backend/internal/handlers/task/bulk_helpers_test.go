package task

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// testBulkItem is a simple implementation of bulkTaskItem for testing
type testBulkItem struct {
	taskID     string
	categoryID string
}

func (t testBulkItem) GetTaskID() string     { return t.taskID }
func (t testBulkItem) GetCategoryID() string { return t.categoryID }

func TestParseBulkTaskIDs_ValidIDs(t *testing.T) {
	taskID := primitive.NewObjectID()
	catID := primitive.NewObjectID()

	items := []bulkTaskItem{
		testBulkItem{taskID: taskID.Hex(), categoryID: catID.Hex()},
	}

	valid, failed := parseBulkTaskIDs(items)
	assert.Equal(t, 1, len(valid))
	assert.Equal(t, 0, len(failed))
	assert.Equal(t, taskID, valid[0].taskID)
	assert.Equal(t, catID, valid[0].categoryID)
}

func TestParseBulkTaskIDs_InvalidTaskID(t *testing.T) {
	catID := primitive.NewObjectID()

	items := []bulkTaskItem{
		testBulkItem{taskID: "bad-id", categoryID: catID.Hex()},
	}

	valid, failed := parseBulkTaskIDs(items)
	assert.Equal(t, 0, len(valid))
	assert.Equal(t, 1, len(failed))
	assert.Equal(t, "bad-id", failed[0])
}

func TestParseBulkTaskIDs_InvalidCategoryID(t *testing.T) {
	taskID := primitive.NewObjectID()

	items := []bulkTaskItem{
		testBulkItem{taskID: taskID.Hex(), categoryID: "bad-id"},
	}

	valid, failed := parseBulkTaskIDs(items)
	assert.Equal(t, 0, len(valid))
	assert.Equal(t, 1, len(failed))
}

func TestParseBulkTaskIDs_MixedValid(t *testing.T) {
	taskID := primitive.NewObjectID()
	catID := primitive.NewObjectID()

	items := []bulkTaskItem{
		testBulkItem{taskID: taskID.Hex(), categoryID: catID.Hex()},
		testBulkItem{taskID: "bad-id", categoryID: catID.Hex()},
	}

	valid, failed := parseBulkTaskIDs(items)
	assert.Equal(t, 1, len(valid))
	assert.Equal(t, 1, len(failed))
}

func TestParseBulkTaskIDs_EmptyList(t *testing.T) {
	items := []bulkTaskItem{}
	valid, failed := parseBulkTaskIDs(items)
	assert.Equal(t, 0, len(valid))
	assert.Equal(t, 0, len(failed))
}
