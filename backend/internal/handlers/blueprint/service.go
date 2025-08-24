package Blueprint

import (
	"context"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Blueprints: collections["blueprints"],
		Users:      collections["users"],
	}
}

// GetAllBlueprints fetches all Blueprint documents from MongoDB
func (s *Service) GetAllBlueprints() ([]BlueprintDocument, error) {
	ctx := context.Background()
	cursor, err := s.Blueprints.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var internalResults []BlueprintDocumentInternal
	if err := cursor.All(ctx, &internalResults); err != nil {
		return nil, err
	}

	// Convert internal documents to API documents
	results := make([]BlueprintDocument, len(internalResults))
	for i, internal := range internalResults {
		results[i] = *internal.ToAPI()
	}

	return results, nil
}

// GetBlueprintByID returns a single Blueprint document by its ObjectID
func (s *Service) GetBlueprintByID(id primitive.ObjectID) (*BlueprintDocument, error) {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	var internalBlueprint BlueprintDocumentInternal
	err := s.Blueprints.FindOne(ctx, filter).Decode(&internalBlueprint)

	if err == mongo.ErrNoDocuments {
		// No matching Blueprint found
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		// Different error occurred
		return nil, err
	}

	return internalBlueprint.ToAPI(), nil
}

// CreateBlueprint adds a new Blueprint document
func (s *Service) CreateBlueprint(r *BlueprintDocumentInternal) (*BlueprintDocument, error) {
	ctx := context.Background()

	blueprint := BlueprintDocumentInternal{
		ID:               primitive.NewObjectID(),
		Banner:           r.Banner,
		Name:             r.Name,
		Tags:             r.Tags,
		Description:      r.Description,
		Duration:         r.Duration,
		Category:         r.Category,
		Categories:       r.Categories,
		Subscribers:      []primitive.ObjectID{},
		SubscribersCount: 0,
		Timestamp:        time.Now(),
	}

	slog.Info("Creating blueprint", "owner_id", r.Owner.ID)
	cursor, err := s.Users.Aggregate(ctx, []bson.M{
		{
			"$match": bson.M{"_id": r.Owner.ID},
		},
		{
			"$project": bson.M{"handle": 1, "display_name": 1, "profile_picture": 1},
		},
	})
	defer cursor.Close(ctx)

	var user types.UserExtendedReferenceInternal
	cursor.Next(ctx)
	if err := cursor.Decode(&user); err != nil {
		return nil, err
	}

	blueprint.Owner = &user

	_, err = s.Blueprints.InsertOne(ctx, blueprint)
	if err != nil {
		return nil, err
	}

	return blueprint.ToAPI(), nil
}

// UpdatePartialBlueprint updates only specified fields of a Blueprint document by ObjectID.
func (s *Service) UpdatePartialBlueprint(id primitive.ObjectID, updated UpdateBlueprintDocument) error {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	updateFields, err := xutils.ToDoc(updated)
	if err != nil {
		return err
	}

	update := bson.M{"$set": updateFields}

	_, err = s.Blueprints.UpdateOne(ctx, filter, update)
	return err
}

// DeleteBlueprint removes a Blueprint document by ObjectID.
func (s *Service) DeleteBlueprint(id primitive.ObjectID) error {
	ctx := context.Background()

	filter := bson.M{"_id": id}

	_, err := s.Blueprints.DeleteOne(ctx, filter)
	return err
}

// SubscribeToBlueprint adds a user to the subscribers array and increments the count
func (s *Service) SubscribeToBlueprint(blueprintID, userID primitive.ObjectID) error {
	ctx := context.Background()

	// Use FindOneAndUpdate to get the blueprint and update it atomically
	filter := bson.M{"_id": blueprintID, "subscribers": bson.M{"$ne": userID}}
	update := bson.M{
		"$addToSet": bson.M{"subscribers": userID},
		"$inc":      bson.M{"subscribersCount": 1},
	}

	var blueprint BlueprintDocumentInternal
	err := s.Blueprints.FindOneAndUpdate(ctx, filter, update).Decode(&blueprint)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return mongo.ErrNoDocuments // Already subscribed or blueprint not found
		}
		return err
	}

	// Process and insert categories from the blueprint
	if err := s.processBlueprintCategories(&blueprint, userID); err != nil {
		return err
	}

	return nil
}

// processBlueprintCategories processes the blueprint categories and inserts them into the categories collection
func (s *Service) processBlueprintCategories(blueprint *BlueprintDocumentInternal, userID primitive.ObjectID) error {
	ctx := context.Background()
	today := time.Now()

	// Get the categories collection
	categoriesCollection := s.Blueprints.Database().Collection("categories")

	for _, category := range blueprint.Categories {
		// Create a new category document for the user
		newCategory := types.CategoryDocument{
			ID:            primitive.NewObjectID(),
			Name:          category.Name,
			WorkspaceName: blueprint.Name, // Use blueprint name as workspace name
			LastEdited:    today,
			User:          userID,
			Tasks:         make([]types.TaskDocument, 0),
			IsBlueprint:   true,
			BlueprintID:   &blueprint.ID,
		}

		// Process tasks in the category
		for _, task := range category.Tasks {
			newTask := s.processTaskForSubscription(task, today, newCategory.ID, userID, blueprint.ID)
			newCategory.Tasks = append(newCategory.Tasks, newTask)
		}

		// Insert the new category
		_, err := categoriesCollection.InsertOne(ctx, newCategory)
		if err != nil {
			return err
		}
	}

	return nil
}

// processTaskForSubscription processes a task for subscription, adjusting time-related fields
func (s *Service) processTaskForSubscription(task types.TaskDocument, today time.Time, categoryID, userID, blueprintID primitive.ObjectID) types.TaskDocument {
	// Create new task with fresh ID
	newTask := types.TaskDocument{
		ID:             primitive.NewObjectID(),
		Priority:       task.Priority,
		Content:        task.Content,
		Value:          task.Value,
		Recurring:      task.Recurring,
		RecurFrequency: task.RecurFrequency,
		RecurType:      task.RecurType,
		RecurDetails:   task.RecurDetails,
		Public:         task.Public,
		Active:         task.Active,
		Timestamp:      today,
		LastEdited:     today,
		UserID:         userID,
		CategoryID:     categoryID,
		Notes:          task.Notes,
		Checklist:      task.Checklist,
		BlueprintID:    &blueprintID,
	}

	// Process time-related fields
	if task.StartDate != nil {
		// Calculate the offset from unix epoch and apply it to today
		epoch := time.Unix(0, 0)
		offset := task.StartDate.Sub(epoch)
		newStartDate := today.Add(offset)
		newTask.StartDate = &newStartDate
	}

	if task.StartTime != nil {
		// Calculate the offset from unix epoch and apply it to today
		epoch := time.Unix(0, 0)
		offset := task.StartTime.Sub(epoch)
		newStartTime := today.Add(offset)
		newTask.StartTime = &newStartTime
	}

	if task.Deadline != nil {
		// Calculate the offset from unix epoch and apply it to today
		epoch := time.Unix(0, 0)
		offset := task.Deadline.Sub(epoch)
		newDeadline := today.Add(offset)
		newTask.Deadline = &newDeadline
	}

	// Process reminders
	if task.Reminders != nil {
		newReminders := make([]*types.Reminder, len(task.Reminders))
		for i, reminder := range task.Reminders {
			if reminder != nil {
				// Calculate the offset from unix epoch and apply it to today
				epoch := time.Unix(0, 0)
				offset := reminder.TriggerTime.Sub(epoch)
				newTriggerTime := today.Add(offset)

				newReminders[i] = &types.Reminder{
					TriggerTime:    newTriggerTime,
					Type:           reminder.Type,
					Sent:           false, // Reset sent status
					AfterStart:     reminder.AfterStart,
					BeforeStart:    reminder.BeforeStart,
					BeforeDeadline: reminder.BeforeDeadline,
					AfterDeadline:  reminder.AfterDeadline,
					CustomMessage:  reminder.CustomMessage,
					Sound:          reminder.Sound,
					Vibration:      reminder.Vibration,
				}
			}
		}
		newTask.Reminders = newReminders
	}

	return newTask
}

// UnsubscribeFromBlueprint removes a user from the subscribers array and decrements the count only if the user was subscribed
func (s *Service) UnsubscribeFromBlueprint(blueprintID, userID primitive.ObjectID) error {
	ctx := context.Background()
	filter := bson.M{"_id": blueprintID, "subscribers": userID}
	update := bson.M{
		"$inc":  bson.M{"subscribersCount": -1},
		"$pull": bson.M{"subscribers": userID},
	}
	result, err := s.Blueprints.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return mongo.ErrNoDocuments // Not subscribed or blueprint not found
	}

	// Delete all categories that were created from this blueprint subscription
	if err := s.deleteBlueprintCategories(blueprintID, userID); err != nil {
		return err
	}

	return nil
}

// deleteBlueprintCategories deletes all categories that were created from a specific blueprint subscription
func (s *Service) deleteBlueprintCategories(blueprintID, userID primitive.ObjectID) error {
	ctx := context.Background()

	// Get the categories collection
	categoriesCollection := s.Blueprints.Database().Collection("categories")

	// Delete all categories that match the userID and blueprintID
	filter := bson.M{
		"user":        userID,
		"blueprintId": blueprintID,
		"isBlueprint": true,
	}

	result, err := categoriesCollection.DeleteMany(ctx, filter)
	if err != nil {
		return err
	}

	slog.Info("Deleted blueprint categories",
		"blueprintID", blueprintID.Hex(),
		"userID", userID.Hex(),
		"deletedCount", result.DeletedCount)

	return nil
}

func (s *Service) SearchBlueprints(query string) ([]BlueprintDocument, error) {
	ctx := context.Background()
	slog.Info("Searching blueprints", "query", query)
	cursor, err := s.Blueprints.Aggregate(ctx, mongo.Pipeline{
		bson.D{
			{"$search", bson.D{
				{"index", "blueprints_text"},
				{"text", bson.D{
					{"query", query},
					{"path", bson.A{"name", "description", "tags", "owner.handle"}},
					{"fuzzy", bson.D{{"maxEdits", 2}}},
				}},
			}},
		},
		bson.D{
			{"$sort", bson.D{{"score", -1}, {"timestamp", -1}}},
		},
		bson.D{
			{"$limit", 10},
		},
	})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	slog.Info("Cursor", "cursor length", cursor.RemainingBatchLength())

	var internalResults []BlueprintDocumentInternal
	if err := cursor.All(ctx, &internalResults); err != nil {
		return nil, err
	}

	results := make([]BlueprintDocument, len(internalResults))
	for i, internal := range internalResults {
		results[i] = *internal.ToAPI()
	}

	return results, nil
}

// GetUserSubscribedBlueprints fetches all blueprints that a user is subscribed to
func (s *Service) GetUserSubscribedBlueprints(userID primitive.ObjectID) ([]BlueprintDocumentWithoutSubscribers, error) {
	ctx := context.Background()
	filter := bson.M{"subscribers": userID}

	cursor, err := s.Blueprints.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var internalResults []BlueprintDocumentInternal
	if err := cursor.All(ctx, &internalResults); err != nil {
		return nil, err
	}

	// Convert internal documents to API documents without subscribers field
	results := make([]BlueprintDocumentWithoutSubscribers, len(internalResults))
	for i, internal := range internalResults {
		results[i] = *internal.ToAPIWithoutSubscribers()
	}

	return results, nil
}

// GetBlueprintByCategory groups blueprints by their category field
func (s *Service) GetBlueprintByCategory() ([]BlueprintCategoryGroup, error) {
	ctx := context.Background()

	cursor, err := s.Blueprints.Aggregate(ctx, mongo.Pipeline{
		bson.D{
			{"$group", bson.D{
				{"_id", "$category"},
				{"blueprints", bson.D{
					{"$push", "$$ROOT"},
				}},
				{"count", bson.D{
					{"$sum", 1},
				}},
			}},
		},
		bson.D{
			{"$sort", bson.D{
				{"count", -1},
				{"_id", 1},
			}},
		},
	})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []BlueprintCategoryGroup
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	// Convert internal documents to API documents for each blueprint in the groups
	for i, group := range results {
		blueprints := make([]BlueprintDocument, len(group.Blueprints))
		for j, blueprint := range group.Blueprints {
			// Convert the raw blueprint document to internal format
			var internalBlueprint BlueprintDocumentInternal
			bytes, _ := bson.Marshal(blueprint)
			bson.Unmarshal(bytes, &internalBlueprint)

			// Convert to API format
			blueprints[j] = *internalBlueprint.ToAPI()
		}
		results[i].Blueprints = blueprints
	}

	return results, nil
}
