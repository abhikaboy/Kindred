package task

import (
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

/*
Router maps endpoints to handlers
*/
func Routes(api huma.API, collections map[string]*mongo.Collection) {
	service := newService(collections)
	handler := Handler{service}

	RegisterTaskOperations(api, &handler)
}

// RegisterTaskOperations registers all task operations with Huma
func RegisterTaskOperations(api huma.API, handler *Handler) {
	RegisterGetTasksByUserOperation(api, handler)
	RegisterCreateTaskOperation(api, handler)
	RegisterGetTasksOperation(api, handler)
	RegisterGetTaskOperation(api, handler)
	RegisterUpdateTaskOperation(api, handler)
	RegisterCompleteTaskOperation(api, handler)
	RegisterDeleteTaskOperation(api, handler)
	RegisterActivateTaskOperation(api, handler)
	RegisterGetActiveTasksOperation(api, handler)
	RegisterCreateTaskFromTemplateOperation(api, handler)
	RegisterGetTasksWithStartTimesOlderThanOneDayOperation(api, handler)
	RegisterGetRecurringTasksWithPastDeadlinesOperation(api, handler)
	RegisterUpdateTaskNotesOperation(api, handler)
	RegisterUpdateTaskChecklistOperation(api, handler)
	RegisterUpdateTaskDeadlineOperation(api, handler)
	RegisterUpdateTaskStartOperation(api, handler)
	RegisterUpdateTaskReminderOperation(api, handler)
	RegisterGetTemplateByIDOperation(api, handler)
	RegisterUpdateTemplateOperation(api, handler)
	RegisterGetCompletedTasksOperation(api, handler)
}
