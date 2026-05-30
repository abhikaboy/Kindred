package Category

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// normalizeTags trims, lowercases, drops empties, and dedupes (preserving
// first-seen order). Always returns a non-nil slice.
func normalizeTags(tags []string) []string {
	seen := make(map[string]struct{}, len(tags))
	out := make([]string, 0, len(tags))
	for _, t := range tags {
		t = strings.ToLower(strings.TrimSpace(t))
		if t == "" {
			continue
		}
		if _, ok := seen[t]; ok {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}
	return out
}

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Categories:    collections["categories"],
		TemplateTasks: collections["template-tasks"],
		Workspaces:    collections["workspaces"],
	}
}

// NewService creates a new category service (public for external use)
func NewService(collections map[string]*mongo.Collection) *Service {
	return newService(collections)
}

// GetAllCategories fetches all Category documents from MongoDB
func (s *Service) GetAllCategories() ([]CategoryDocument, error) {
	ctx := context.Background()
	cursor, err := s.Categories.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	results := make([]CategoryDocument, 0)
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// GetAllCategories fetches all Category documents from MongoDB
func (s *Service) GetCategoriesByUser(id primitive.ObjectID) ([]WorkspaceResult, error) {
	ctx := context.Background()

	filter := bson.M{"user": id}
	cursor, err := s.Categories.Aggregate(ctx, mongo.Pipeline{
		{
			{Key: "$match", Value: filter},
		},
		{
			{Key: "$group", Value: bson.M{
				"_id": "$$ROOT.workspaceName",
				"categories": bson.M{
					"$push": "$$ROOT",
				},
			}},
		},
		{
			{Key: "$lookup", Value: bson.M{
				"from": "workspaces",
				"let":  bson.M{"wname": "$_id", "uid": id},
				"pipeline": mongo.Pipeline{
					{{Key: "$match", Value: bson.M{"$expr": bson.M{
						"$and": []bson.M{
							{"$eq": []interface{}{"$name", "$$wname"}},
							{"$eq": []interface{}{"$user", "$$uid"}},
						},
					}}}},
				},
				"as": "meta",
			}},
		},
		{
			{Key: "$addFields", Value: bson.M{
				"icon":  bson.M{"$ifNull": []interface{}{bson.M{"$arrayElemAt": []interface{}{"$meta.icon", 0}}, nil}},
				"color": bson.M{"$ifNull": []interface{}{bson.M{"$arrayElemAt": []interface{}{"$meta.color", 0}}, nil}},
			}},
		},
		{
			{Key: "$project", Value: bson.M{"meta": 0}},
		},
	})

	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	results := make([]WorkspaceResult, 0)
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

// GetCategoryByID returns a single Category document by its ObjectID
func (s *Service) GetCategoryByID(id primitive.ObjectID) (*CategoryDocument, error) {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	var Category CategoryDocument
	err := s.Categories.FindOne(ctx, filter).Decode(&Category)

	if err == mongo.ErrNoDocuments {
		// No matching Category found
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		// Different error occurred
		return nil, err
	}

	return &Category, nil
}

// InsertCategory adds a new Category document
func (s *Service) CreateCategory(r *CategoryDocument) (*CategoryDocument, error) {
	ctx := context.Background()
	// Insert the document into the collection

	_, err := s.Categories.InsertOne(ctx, r)
	if err != nil {
		return nil, err
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Category inserted", slog.String("id", r.ID.Hex()))

	return r, nil
}

// UpdatePartialCategory updates only the provided fields of a Category by ObjectID.
func (s *Service) UpdatePartialCategory(id primitive.ObjectID, updated UpdateCategoryDocument, user primitive.ObjectID) (*CategoryDocument, error) {
	ctx := context.Background()

	set := bson.D{{Key: "lastEdited", Value: xutils.NowUTC()}}
	if updated.Name != "" {
		set = append(set, bson.E{Key: "name", Value: updated.Name})
	}
	if updated.IsBlueprint != nil {
		set = append(set, bson.E{Key: "isBlueprint", Value: *updated.IsBlueprint})
	}
	if updated.BlueprintID != nil {
		set = append(set, bson.E{Key: "blueprintId", Value: *updated.BlueprintID})
	}
	if updated.Tags != nil {
		set = append(set, bson.E{Key: "tags", Value: normalizeTags(*updated.Tags)})
	}

	filter := bson.M{"_id": id, "user": user}
	result, err := s.Categories.UpdateOne(ctx, filter, bson.D{{Key: "$set", Value: set}})
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to update Category",
			slog.String("categoryID", id.Hex()), slog.String("error", err.Error()))
		return nil, err
	}
	if result.MatchedCount == 0 {
		slog.LogAttrs(ctx, slog.LevelError, "Category not found or user doesn't own it",
			slog.String("categoryID", id.Hex()), slog.String("userID", user.Hex()))
		return nil, fmt.Errorf("category not found or access denied")
	}

	return s.GetCategoryByID(id)
}

// DeleteCategory removes a Category document by ObjectID.
func (s *Service) DeleteCategory(userId primitive.ObjectID, id primitive.ObjectID) error {
	ctx := context.Background()

	// Delete all template tasks associated with this category
	templateFilter := bson.M{"categoryID": id}
	templateResult, err := s.TemplateTasks.DeleteMany(ctx, templateFilter)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to delete template tasks for category",
			slog.String("categoryID", id.Hex()),
			slog.String("error", err.Error()))
		// Continue with category deletion even if template deletion fails
	} else if templateResult.DeletedCount > 0 {
		slog.LogAttrs(ctx, slog.LevelInfo, "Deleted template tasks for category",
			slog.String("categoryID", id.Hex()),
			slog.Int64("templatesDeleted", templateResult.DeletedCount))
	}

	// Delete the category
	_, err = s.Categories.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (s *Service) DeleteWorkspace(workspaceName string, user primitive.ObjectID) error {
	ctx := context.Background()

	// First, find all categories in the workspace to get their IDs
	filter := bson.M{"workspaceName": workspaceName, "user": user}
	cursor, err := s.Categories.Find(ctx, filter)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to find categories for workspace deletion",
			slog.String("workspace", workspaceName),
			slog.String("error", err.Error()))
		return err
	}
	defer cursor.Close(ctx)

	// Collect all category IDs
	var categoryIDs []primitive.ObjectID
	for cursor.Next(ctx) {
		var category CategoryDocument
		if err := cursor.Decode(&category); err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Failed to decode category during workspace deletion",
				slog.String("error", err.Error()))
			continue
		}
		categoryIDs = append(categoryIDs, category.ID)
	}

	// Delete all template tasks associated with these categories
	if len(categoryIDs) > 0 {
		templateFilter := bson.M{"categoryID": bson.M{"$in": categoryIDs}}
		templateResult, err := s.TemplateTasks.DeleteMany(ctx, templateFilter)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Failed to delete template tasks for workspace",
				slog.String("workspace", workspaceName),
				slog.String("error", err.Error()))
			// Continue with category deletion even if template deletion fails
		} else {
			slog.LogAttrs(ctx, slog.LevelInfo, "Deleted template tasks for workspace",
				slog.String("workspace", workspaceName),
				slog.Int64("templatesDeleted", templateResult.DeletedCount))
		}
	}

	// Delete all categories in the workspace
	categoryResult, err := s.Categories.DeleteMany(ctx, filter)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to delete categories for workspace",
			slog.String("workspace", workspaceName),
			slog.String("error", err.Error()))
		return err
	}

	// Delete workspace metadata document
	if s.Workspaces != nil {
		_, err = s.Workspaces.DeleteOne(ctx, bson.M{"name": workspaceName, "user": user})
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Failed to delete workspace metadata",
				slog.String("workspace", workspaceName),
				slog.String("error", err.Error()))
			// Non-fatal: categories are already deleted
		}
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Workspace deleted successfully",
		slog.String("workspace", workspaceName),
		slog.Int64("categoriesDeleted", categoryResult.DeletedCount))

	return nil
}

// RenameWorkspace renames a workspace by updating all categories that belong to it
func (s *Service) RenameWorkspace(oldWorkspaceName string, newWorkspaceName string, user primitive.ObjectID) error {
	ctx := context.Background()

	filter := bson.M{"workspaceName": oldWorkspaceName, "user": user}
	update := bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "workspaceName", Value: newWorkspaceName},
			{Key: "lastEdited", Value: xutils.NowUTC()},
		}},
	}

	result, err := s.Categories.UpdateMany(ctx, filter, update)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to rename workspace",
			slog.String("oldName", oldWorkspaceName),
			slog.String("newName", newWorkspaceName),
			slog.String("error", err.Error()))
		return err
	}

	// Update workspace metadata name
	if s.Workspaces != nil {
		_, err = s.Workspaces.UpdateOne(ctx,
			bson.M{"name": oldWorkspaceName, "user": user},
			bson.D{{Key: "$set", Value: bson.D{{Key: "name", Value: newWorkspaceName}}}},
		)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Failed to rename workspace metadata",
				slog.String("oldName", oldWorkspaceName),
				slog.String("newName", newWorkspaceName),
				slog.String("error", err.Error()))
			// Non-fatal: categories are already renamed
		}
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Workspace renamed successfully",
		slog.String("oldName", oldWorkspaceName),
		slog.String("newName", newWorkspaceName),
		slog.Int64("categoriesUpdated", result.ModifiedCount))

	return nil
}

func (s *Service) GetWorkspaces(userId primitive.ObjectID) ([]WorkspaceResult, error) {
	ctx := context.Background()

	filter := bson.M{"user": userId}
	cursor, err := s.Categories.Aggregate(ctx, mongo.Pipeline{
		{
			{Key: "$match", Value: filter},
		},
		{
			{Key: "$group", Value: bson.M{
				"_id": "$$ROOT.workspaceName",
				"categories": bson.M{
					"$push": "$$ROOT",
				},
			}},
		},
		{
			{Key: "$lookup", Value: bson.M{
				"from": "workspaces",
				"let":  bson.M{"wname": "$_id", "uid": userId},
				"pipeline": mongo.Pipeline{
					{{Key: "$match", Value: bson.M{"$expr": bson.M{
						"$and": []bson.M{
							{"$eq": []interface{}{"$name", "$$wname"}},
							{"$eq": []interface{}{"$user", "$$uid"}},
						},
					}}}},
				},
				"as": "meta",
			}},
		},
		{
			{Key: "$addFields", Value: bson.M{
				"icon":  bson.M{"$ifNull": []interface{}{bson.M{"$arrayElemAt": []interface{}{"$meta.icon", 0}}, nil}},
				"color": bson.M{"$ifNull": []interface{}{bson.M{"$arrayElemAt": []interface{}{"$meta.color", 0}}, nil}},
			}},
		},
		{
			{Key: "$project", Value: bson.M{"meta": 0}},
		},
	})

	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	results := make([]WorkspaceResult, 0)
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

// UpsertWorkspaceMeta creates or updates workspace metadata (icon/color)
func (s *Service) UpsertWorkspaceMeta(name string, user primitive.ObjectID, icon *string, color *string) error {
	if s.Workspaces == nil {
		return nil
	}
	ctx := context.Background()

	setFields := bson.D{{Key: "name", Value: name}, {Key: "user", Value: user}}
	if icon != nil {
		setFields = append(setFields, bson.E{Key: "icon", Value: icon})
	}
	if color != nil {
		setFields = append(setFields, bson.E{Key: "color", Value: color})
	}

	opts := options.Update().SetUpsert(true)
	_, err := s.Workspaces.UpdateOne(ctx,
		bson.M{"name": name, "user": user},
		bson.D{{Key: "$set", Value: setFields}},
		opts,
	)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to upsert workspace metadata",
			slog.String("workspace", name),
			slog.String("error", err.Error()))
	}
	return err
}

// GetCategoryNamesSummary returns a lightweight text summary of a user's
// workspace and category structure, suitable for direct injection into an
// LLM prompt. Each category includes its hex ObjectID so the model can
// reference it in structured output.
func (s *Service) GetCategoryNamesSummary(userID primitive.ObjectID) (string, error) {
	workspaces, err := s.GetCategoriesByUser(userID)
	if err != nil {
		return "", fmt.Errorf("failed to fetch categories: %w", err)
	}

	if len(workspaces) == 0 {
		return "No workspaces or categories found.", nil
	}

	var b strings.Builder
	for i, ws := range workspaces {
		if i > 0 {
			b.WriteByte('\n')
		}
		fmt.Fprintf(&b, "Workspace %q:\n", ws.Name)
		for _, cat := range ws.Categories {
			fmt.Fprintf(&b, "  - %s (id: %s)\n", cat.Name, cat.ID.Hex())
		}
	}
	return b.String(), nil
}

// SetWorkspacePushEnabled sets push_enabled on every calendar-integrated
// category in the given workspace owned by the user. Categories without a
// "gcal:" integration are not touched, since they have no destination calendar.
func (s *Service) SetWorkspacePushEnabled(workspaceName string, user primitive.ObjectID, enabled bool) (int64, error) {
	ctx := context.Background()

	filter := bson.M{
		"workspaceName": workspaceName,
		"user":          user,
		"integration":   bson.M{"$regex": "^gcal:"},
	}
	update := bson.D{{Key: "$set", Value: bson.D{
		{Key: "push_enabled", Value: enabled},
		{Key: "lastEdited", Value: xutils.NowUTC()},
	}}}

	result, err := s.Categories.UpdateMany(ctx, filter, update)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to set workspace push_enabled",
			slog.String("workspace", workspaceName),
			slog.String("userID", user.Hex()),
			slog.Bool("enabled", enabled),
			slog.String("error", err.Error()))
		return 0, err
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Workspace push_enabled updated",
		slog.String("workspace", workspaceName),
		slog.Bool("enabled", enabled),
		slog.Int64("matched", result.MatchedCount),
		slog.Int64("modified", result.ModifiedCount))

	return result.ModifiedCount, nil
}

// UpdateWorkspaceMeta updates only the provided icon/color fields on a workspace document
func (s *Service) UpdateWorkspaceMeta(name string, user primitive.ObjectID, icon *string, color *string) error {
	if s.Workspaces == nil {
		return nil
	}
	ctx := context.Background()

	setFields := bson.D{}
	if icon != nil {
		setFields = append(setFields, bson.E{Key: "icon", Value: icon})
	}
	if color != nil {
		setFields = append(setFields, bson.E{Key: "color", Value: color})
	}
	if len(setFields) == 0 {
		return nil
	}

	opts := options.Update().SetUpsert(true)
	_, err := s.Workspaces.UpdateOne(ctx,
		bson.M{"name": name, "user": user},
		bson.D{
			{Key: "$set", Value: setFields},
			{Key: "$setOnInsert", Value: bson.D{{Key: "name", Value: name}, {Key: "user", Value: user}}},
		},
		opts,
	)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to update workspace metadata",
			slog.String("workspace", name),
			slog.String("error", err.Error()))
	}
	return err
}
