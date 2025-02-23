package task

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Tasks: collections["users"],
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

	filter := bson.M{"_id": id}
	cursor, err := s.Tasks.Aggregate(ctx, mongo.Pipeline{
		{
			{Key: "$match", Value: filter},
		},
		{
			{Key: "$unwind", Value: "$categories"},
		},
		{
			{Key: "$replaceRoot", Value: bson.M{
				"newRoot": "$categories",
			}},
		},
		{
			{Key: "$unwind", Value: "$tasks"},
		},
		{
			{Key: "$replaceRoot", Value: bson.M{
				"newRoot": "$tasks",
			}},
		},
		sort,
	})

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
func (s *Service) GetTaskByID(id primitive.ObjectID) (*TaskDocument, error) {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	var Task TaskDocument
	err := s.Tasks.FindOne(ctx, filter).Decode(&Task)

	if err == mongo.ErrNoDocuments {
		// No matching Task found
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		// Different error occurred
		return nil, err
	}

	return &Task, nil
}

// InsertTask adds a new Task document
func (s *Service) CreateTask(userId primitive.ObjectID, categoryId primitive.ObjectID, r *TaskDocument) (*TaskDocument, error) {
	ctx := context.Background()
	// Insert the document into the collection

	_, err := s.Tasks.UpdateOne(
		ctx, 
		bson.M{
			"_id": userId, 
			"categories": bson.M{"$elemMatch": bson.M{"_id": categoryId}},
		},
		bson.M{"$push": bson.M{"categories.$.tasks": r}},
	)
	if err != nil {
		return nil, err
	}

	// Cast the inserted ID to ObjectID
	slog.LogAttrs(ctx, slog.LevelInfo, "Task inserted")

	return r, nil
}

// UpdatePartialTask updates only specified fields of a Task document by ObjectID.
func (s *Service) UpdatePartialTask(userId primitive.ObjectID,id primitive.ObjectID, categoryId primitive.ObjectID, updated UpdateTaskDocument) (*TaskDocument, error) {
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
			"_id": userId, 
			"categories": bson.M{"$elemMatch": bson.M{"_id": categoryId}},
		},
		bson.D{{
			 Key: "$set", Value: bson.D{
				{Key: "categories.$.tasks.$[t].priority", Value: updated.Priority},
				{Key: "categories.$.tasks.$[t].lastEdited", Value: time.Now()},
				{Key: "categories.$.tasks.$[t].content", Value: updated.Content},
				{Key: "categories.$.tasks.$[t].value", Value: updated.Value},
				{Key: "categories.$.tasks.$[t].recurring", Value: updated.Recurring},
				{Key: "categories.$.tasks.$[t].recurDetails", Value: updated.RecurDetails},
				{Key: "categories.$.tasks.$[t].public", Value: updated.Public},
				{Key: "categories.$.tasks.$[t].active", Value: updated.Active},},
		}},
		&options,
		)

	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to update Category", slog.String("error", err.Error()))
		return nil, err
	}

	return nil, err
}

// DeleteTask removes a Task document by ObjectID.
func (s *Service) DeleteTask(id primitive.ObjectID) error {
	ctx := context.Background()

	filter := bson.M{"_id": id}

	_, err := s.Tasks.DeleteOne(ctx, filter)
	return err
}
