package task

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func getTasksByUserPipeline(userId primitive.ObjectID) []bson.D {
	var pipeline []bson.D = []bson.D{
		{
			{Key: "$match", Value: bson.M{"user": userId}},
		},
		{
			{Key: "$unwind", Value: "$tasks"},
		},
		{
			{Key: "$replaceRoot", Value: bson.M{
				"newRoot": "$tasks",
			}},
		},
	}
	return pipeline
}

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Tasks:          collections["categories"],
		Users:          collections["users"],
		CompletedTasks: collections["completed-tasks"],
		TemplateTasks:  collections["template-tasks"],
	}
}

// GetAllTasks fetches all Task documents from MongoDB
func (s *Service) GetAllTasks() ([]TaskDocument, error) {
	ctx := context.Background()
	cursor, err := s.Tasks.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []TaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

func (s *Service) GetTasksByUser(id primitive.ObjectID, sort bson.D) ([]TaskDocument, error) {
	ctx := context.Background()

	fmt.Println(sort)

	pipeline := getTasksByUserPipeline(id)
	pipeline = append(pipeline, sort)
	cursor, err := s.Tasks.Aggregate(ctx, pipeline)

	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []TaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// GetTaskByID returns a single Task document by its ObjectID
func (s *Service) GetTaskByID(id primitive.ObjectID, user primitive.ObjectID) (*TaskDocument, error) {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	var Task = make([]TaskDocument, 0)
	var pipeline  = getTasksByUserPipeline(user)
	pipeline = append(pipeline, bson.D{
		{Key: "$match", Value: filter},
	})
	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	err = cursor.All(ctx, &Task)
	if len(Task) == 0 {
		return nil, mongo.ErrNoDocuments
	}

	return &Task[0], nil
}

// InsertTask adds a new Task document
func (s *Service) CreateTask(categoryId primitive.ObjectID, r *TaskDocument) (*TaskDocument, error) {
	ctx := context.Background()
	// Insert the document into the collection

	_, err := s.Tasks.UpdateOne(
		ctx,
		bson.M{
			"_id":        categoryId,
		},
		bson.M{"$push": bson.M{"tasks": r}},
	)
	if err != nil {
		return nil, err
	}

	// Cast the inserted ID to ObjectID
	slog.LogAttrs(ctx, slog.LevelInfo, "Task inserted")

	return r, nil
}

func (s *Service) CreateTemplateTask(categoryId primitive.ObjectID, r *TemplateTaskDocument) (*TemplateTaskDocument, error) {
	ctx := context.Background()

	_, err := s.TemplateTasks.InsertOne(ctx, r)
	if err != nil {
		return nil, err
	}

	return r, nil
}

// UpdatePartialTask updates only specified fields of a Task document by ObjectID.
func (s *Service) UpdatePartialTask(
	id primitive.ObjectID,
	categoryId primitive.ObjectID,
	updated UpdateTaskDocument) (*TaskDocument, error) {

	ctx := context.Background()

	options := options.UpdateOptions{
		ArrayFilters: &options.ArrayFilters{
			Filters: bson.A{
				bson.M{
					"t._id": id,
				},
			},
		},
	}

	_, err := s.Tasks.UpdateOne(ctx,
		bson.M{
			"_id":        categoryId,
		},
		bson.D{{
			Key: "$set", Value: bson.D{
				{Key: "tasks.$[t].priority", Value: updated.Priority},
				{Key: "tasks.$[t].lastEdited", Value: time.Now()},
				{Key: "tasks.$[t].content", Value: updated.Content},
				{Key: "tasks.$[t].value", Value: updated.Value},
				{Key: "tasks.$[t].recurring", Value: updated.Recurring},
				{Key: "tasks.$[t].recurDetails", Value: updated.RecurDetails},
				{Key: "tasks.$[t].public", Value: updated.Public},
				{Key: "tasks.$[t].active", Value: updated.Active}},
		}},
		&options,
	)

	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to update Category", slog.String("error", err.Error()))
		return nil, err
	}

	return nil, err
}

func (s *Service) CompleteTask(
	userId primitive.ObjectID,
	id primitive.ObjectID,
	categoryId primitive.ObjectID,
	completed CompleteTaskDocument) error {

	ctx := context.Background()
	pipeline := getTasksByUserPipeline(userId)
	pipeline = append(pipeline, bson.D{
		{Key: "$set", Value: bson.M{
			"active":        false,
			"timeTaken":     completed.TimeTaken,
			"timeCompleted": completed.TimeCompleted,
			"category":      categoryId,
			"user":          userId,
		}},
	},
		bson.D{
			{Key: "$unset", Value: bson.A{
				"recurDetails",
			},
			},
		},
		bson.D{
			{Key: "$merge", Value: bson.M{
				"into":           "completed-tasks",
				"on":             "_id",
				"whenMatched":    "replace",
				"whenNotMatched": "insert",
			}},
		},
	)
	_, err := s.Tasks.Aggregate(ctx, pipeline)

	return err
}

func (s *Service) IncrementTaskCompletedAndDelete(userId primitive.ObjectID, categoryId primitive.ObjectID, id primitive.ObjectID) error {
	ctx := context.Background()

	// TODO: find a way better way to do this
	cursor, err := s.Tasks.Aggregate(ctx, mongo.Pipeline{
		{
			{Key: "$match", Value: bson.M{"_id": categoryId}},
		},
		{
			{Key: "$unwind", Value: "$tasks"},
		},
		{
			{Key: "$replaceRoot", Value: bson.M{
				"newRoot": "$tasks",
			}},
		},
		{
			{Key: "$match", Value: bson.M{
				"_id": id,
			}},
		}})
	if cursor.RemainingBatchLength() == 0 {
		return fiber.ErrNotFound // 404
	}

	result, err := s.Users.UpdateOne(ctx,
		bson.M{
			"_id":        userId,
		},
		bson.M{
			"$inc":  bson.M{"tasks_complete": 1},
		},
	)

	if err != nil {
		return err
	}

	resultDecoded := *result
	fmt.Println(resultDecoded.ModifiedCount)
	if resultDecoded.ModifiedCount == 0 {
		return errors.New("No tasks found")
	}

	err = s.DeleteTask(categoryId, id)

	return err
}

// DeleteCategory removes a Category document by ObjectID.
func (s *Service) DeleteTask(categoryId primitive.ObjectID, id primitive.ObjectID) error {
	ctx := context.Background()
	result, err := s.Tasks.UpdateOne(
		ctx, bson.M{
			"_id":        categoryId,
		},
		bson.M{"$pull": bson.M{"tasks": bson.M{"_id": id}}},
	)
	if err != nil {
		return err
	}

	resultDecoded := *result
	fmt.Println(resultDecoded)
	return err

}

// DeleteCategory removes a Category document by ObjectID.
func (s *Service) ActivateTask(userId primitive.ObjectID, categoryId primitive.ObjectID, id primitive.ObjectID, newStatus bool) error {
	ctx := context.Background()
	options := options.UpdateOptions{
		ArrayFilters: &options.ArrayFilters{
			Filters: bson.A{
				bson.M{
					"t._id": id,
				},
			},
		},
	}

	result, err := s.Tasks.UpdateOne(ctx,
		bson.M{
			"_id":        userId,
			"categories": bson.M{"$elemMatch": bson.M{"_id": categoryId}},
		},
		bson.D{{
			Key: "$set", Value: bson.D{
				{Key: "categories.$.tasks.$[t].lastEdited", Value: time.Now()},
				{Key: "categories.$.tasks.$[t].active", Value: newStatus}},
		}},
		&options,
	)

	if err != nil {
		return err
	}

	resultDecoded := *result
	fmt.Println(resultDecoded)
	return err

}

func (s *Service) GetActiveTasks(userId primitive.ObjectID) ([]TaskDocument, error) {
	ctx := context.Background()

	pipeline := getTasksByUserPipeline(userId)
	pipeline = append(pipeline, bson.D{
		{Key: "$match", Value: bson.M{
			"active": true,
		}},
	})
	cursor, err := s.Tasks.Aggregate(ctx, pipeline)

	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results = make([]TaskDocument, 0)
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}



func (s *Service) CreateTaskFromTemplate(templateId primitive.ObjectID) (*TaskDocument, error) {
	ctx := context.Background()

	template := s.TemplateTasks.FindOne(ctx, bson.M{"_id": templateId})
	
	// make sure the template exists
	if template == nil {
		return nil, errors.New("template not found")
	}

	var templateDoc TemplateTaskDocument
	err := template.Decode(&templateDoc)
	if err != nil {
		return nil, err
	}

	// construct a task document from the template
	task := constructTaskFromTemplate(&templateDoc)

	//
	templateDoc.LastGenerated = templateDoc.NextGenerated
	thisGeneration := templateDoc.LastGenerated

	var nextGeneration time.Time
	if templateDoc.RecurType == "OCCURRENCE" {

		err = s.DeleteTaskFromTemplateID(templateDoc)
		if err != nil {
			return nil, err
		}

		nextGeneration, err := s.ComputeNextOccurrence(&templateDoc)
		if err != nil {
			return nil, err
		}
		task.StartDate = &nextGeneration
	
	} else if templateDoc.RecurType == "DEADLINE" {

		// if the recur behavior is buildup, then we dont need to delete the last task
		// otherwise, if its rolling we need to delete the last task
		if templateDoc.RecurDetails.Behavior == "BUILDUP" {
			err = s.DeleteTaskFromTemplateID(templateDoc)
			if err != nil {
				return nil, err
			}
		}
		nextGeneration, err := s.ComputeNextDeadline(&templateDoc)
		if err != nil {
			return nil, err
		}
		task.Deadline = &nextGeneration
	} else if templateDoc.RecurType == "WINDOW" {
		// TODO: implement window
		nextGeneration = templateDoc.NextGenerated
		task.Deadline = &nextGeneration
	}
	
	s.TemplateTasks.UpdateOne(ctx, bson.M{"_id": templateId}, bson.M{"$set": bson.M{"lastGenerated": thisGeneration, "nextGenerated": nextGeneration}})


	// insert the task into the database
	_, err = s.Tasks.UpdateOne(ctx, bson.M{"_id": templateDoc.CategoryID}, bson.M{"$push": bson.M{"tasks": task}})
	if err != nil {
		return nil, err
	}

	return &task, nil
}


func (s *Service) DeleteTaskFromTemplateID(templateDoc TemplateTaskDocument) error {
	ctx := context.Background()

		cursor, err := s.Tasks.Aggregate(ctx, mongo.Pipeline{
		   {
				{Key: "$match", Value: bson.M{"_id": templateDoc.CategoryID}},
			 },
			 {
				{Key: "$unwind", Value: "$tasks"},
			 },
			 {
				{Key: "$match", Value: bson.M{"tasks.templateID": templateDoc.ID}},
			 },
		})
	if err != nil {
		return err
	}
	var results []TaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return err
	}
		if len(results) > 0 {
			// lets just delete the task for now 
		s.DeleteTask(templateDoc.CategoryID, results[0].ID)
	}

	return nil
}

func (s *Service) GetTasksWithStartTimesOlderThanOneDay() ([]TaskDocument, error) {
	ctx := context.Background()

	inOneDay := time.Now().AddDate(0, 0, 1)

	baseTime := inOneDay // Simulating which tasks to update in one day

	slog.LogAttrs(ctx, slog.LevelInfo, "Getting tasks with start times older than one day using: " + baseTime.String())
	pipeline := 
		bson.A{
			bson.D{{"$unwind", "$tasks"}},
			bson.D{{"$replaceRoot", bson.D{{"newRoot", "$tasks"}}}},
			bson.D{{"$match", bson.D{{"templateID", bson.D{{"$exists", true}}}}}},
			bson.D{{"$match", bson.D{{"startDate", bson.D{{"$lt", baseTime.AddDate(0, 0, -1)}}}}}},
		}

	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []TaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

func (s *Service) GetRecurringTasksWithPastDeadlines() ([]TaskDocument, error) {
	ctx := context.Background()

	pipeline := 
		bson.A{
			bson.D{{"$unwind", "$tasks"}},
			bson.D{{"$replaceRoot", bson.D{{"newRoot", "$tasks"}}}},
			bson.D{{"$match", bson.D{{"templateID", bson.D{{"$exists", true}}}}}},
		  bson.D{{"$match", bson.D{{"deadline", bson.D{{"$lt", time.Now()}}}}}},
		}

	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []TaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}
