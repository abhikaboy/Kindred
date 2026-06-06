package Post

import (
	"context"
	"crypto/rand"
	"fmt"
	"log/slog"
	"math/big"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/encouragement"
	"github.com/abhikaboy/Kindred/internal/handlers/notifications"
	"github.com/abhikaboy/Kindred/internal/handlers/rings"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type UserStatsUpdate struct {
	PostsMade int `json:"posts_made"`
	Points    int `json:"points"`
}

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection, ringService *rings.RingService) *Service {
	return &Service{
		Posts:                collections["posts"],
		Users:                collections["users"],
		Blueprints:           collections["blueprints"],
		Categories:           collections["categories"],
		Groups:               collections["groups"],
		Connections:          collections["friend-requests"],
		Reports:              collections["reports"],
		NotificationService:  notifications.NewNotificationService(collections),
		RingService:          ringService,
		EncouragementService: encouragement.NewEncouragementService(collections),
	}
}

// NewService is the exported version for testing
func NewService(collections map[string]*mongo.Collection) *Service {
	return newService(collections, nil)
}

// GetReportedPostIDs returns IDs of all posts that have been reported by any user with pending or reviewed status
func (s *Service) GetReportedPostIDs(ctx context.Context) ([]primitive.ObjectID, error) {
	if s.Reports == nil {
		return []primitive.ObjectID{}, nil
	}
	projection := options.Find().SetProjection(bson.M{"content_id": 1, "_id": 0})
	cursor, err := s.Reports.Find(ctx, bson.M{
		"content_type": "post",
		"status":       bson.M{"$in": []string{"pending", "reviewed"}},
	}, projection)
	if err != nil {
		return nil, fmt.Errorf("failed to query reported posts: %w", err)
	}
	defer cursor.Close(ctx)

	var reports []struct {
		ContentID primitive.ObjectID `bson:"content_id"`
	}
	if err := cursor.All(ctx, &reports); err != nil {
		return nil, fmt.Errorf("failed to decode reports: %w", err)
	}

	ids := make([]primitive.ObjectID, 0, len(reports))
	for _, r := range reports {
		ids = append(ids, r.ContentID)
	}
	return ids, nil
}

// GetUserReportedPostIDs returns IDs of posts reported by a specific user (any status)
func (s *Service) GetUserReportedPostIDs(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	if s.Reports == nil {
		return []primitive.ObjectID{}, nil
	}
	projection := options.Find().SetProjection(bson.M{"content_id": 1, "_id": 0})
	cursor, err := s.Reports.Find(ctx, bson.M{
		"reporter_id":  userID,
		"content_type": "post",
	}, projection)
	if err != nil {
		return nil, fmt.Errorf("failed to query user reported posts: %w", err)
	}
	defer cursor.Close(ctx)

	var reports []struct {
		ContentID primitive.ObjectID `bson:"content_id"`
	}
	if err := cursor.All(ctx, &reports); err != nil {
		return nil, fmt.Errorf("failed to decode user reports: %w", err)
	}

	ids := make([]primitive.ObjectID, 0, len(reports))
	for _, r := range reports {
		ids = append(ids, r.ContentID)
	}
	return ids, nil
}

// GetUserSettings retrieves the display settings for a user
func (s *Service) GetUserContentFilterEnabled(ctx context.Context, userID primitive.ObjectID) (bool, error) {
	var user struct {
		Settings types.UserSettings `bson:"settings"`
	}
	err := s.Users.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		return false, err
	}
	return user.Settings.Display.ContentFilter, nil
}

// GetAllPosts fetches all Post documents from MongoDB with pagination
func (s *Service) GetAllPosts(limit, offset int) ([]types.PostDocument, int, error) {
	ctx := context.Background()

	filter := bson.M{
		"metadata.isDeleted": false,
		"metadata.isPublic":  true,
	}

	// Get total count
	total, err := s.Posts.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	// Set default limit if not provided
	if limit <= 0 {
		limit = 8
	}

	// Find with pagination
	findOptions := options.Find().
		SetSort(bson.D{{Key: "metadata.createdAt", Value: -1}}). // Sort by newest first
		SetLimit(int64(limit)).
		SetSkip(int64(offset))

	cursor, err := s.Posts.Find(ctx, filter, findOptions)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var results []types.PostDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, 0, err
	}

	return results, int(total), nil
}

// GetPostByID returns a single Post document by its ObjectID
func (s *Service) GetPostByID(id primitive.ObjectID) (*types.PostDocument, error) {
	ctx := context.Background()
	filter := bson.M{
		"_id":                id,
		"metadata.isDeleted": false,
	}
	var Post types.PostDocument
	err := s.Posts.FindOne(ctx, filter).Decode(&Post)

	if err == mongo.ErrNoDocuments {
		// No matching Post found
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		// Different error occurred
		return nil, err
	}

	return &Post, nil
}

// InsertPost adds a new Post document
func (s *Service) CreatePost(r *types.PostDocument) (*types.PostDocument, *UserStatsUpdate, error) {
	ctx := context.Background()

	// Insert the document into the collection
	result, err := s.Posts.InsertOne(ctx, r)
	if err != nil {
		return nil, nil, err
	}

	// Cast the inserted ID to ObjectID
	id, ok := result.InsertedID.(primitive.ObjectID)
	if !ok {
		return nil, nil, fmt.Errorf("failed to convert InsertedID to ObjectID")
	}
	r.ID = id

	// If this post is linked to a task, mark the task as posted
	if r.Task != nil {
		// Determine which collection the task is in (likely "completed-tasks" but we should check)
		// For now, we assume tasks are moved to "completed-tasks" upon completion
		// But since we don't have a direct reference to the collection name in the task reference,
		// we'll try to update it in the users collection where completed tasks are embedded/stored
		// Wait, completed tasks are stored in the "completed-tasks" collection according to task service.

		// Since we don't have direct access to "completed-tasks" collection here in the struct,
		// let's assume we need to add it or use a dynamic collection access if needed.
		// However, looking at task service, completed tasks are stored in "tasks" collection but moved to "completed-tasks"?
		// Let's check the task service again...
		// "into": "completed-tasks" in the aggregation pipeline.

		// Since we don't have the "completed-tasks" collection initialized in Service struct,
		// we might need to add it or access it via the database.
		// But wait, 'Categories' collection contains active tasks.
		// Completed tasks are likely in a separate collection or just marked as inactive?
		// In task/service.go: "into": "completed-tasks" suggests a separate collection.

		// Let's try to update it in the "completed-tasks" collection.
		// Since it's not in the Service struct, we'll need to use the client from one of the other collections
		// or better, add it to the Service struct in newService (but I can't change main.go/wire.go easily).
		// Instead, I'll access it via the database of another collection.

		db := s.Posts.Database()
		completedTasksColl := db.Collection("completed-tasks")

		_, err := completedTasksColl.UpdateOne(ctx,
			bson.M{"_id": r.Task.ID},
			bson.M{"$set": bson.M{"posted": true}},
		)

		if err != nil {
			// Log warning but don't fail the post creation
			fmt.Printf("Warning: Failed to mark task as posted: %v\n", err)
		}
	}

	// Update user stats after successful post creation and get the updated stats
	userStats, err := s.updateUserPostStats(ctx, r.User.ID)
	if err != nil {
		// Log the error but don't fail the post creation
		// The post was created successfully, so we return it
		// Consider using a proper logger here
		fmt.Printf("Warning: Failed to update user stats after post creation: %v\n", err)
		return r, nil, nil
	}

	return r, userStats, nil
}

// updateUserPostStats increments the user's posts made count.
func (s *Service) updateUserPostStats(ctx context.Context, userID primitive.ObjectID) (*UserStatsUpdate, error) {
	userFilter := bson.M{"_id": userID}

	updatePipeline := []bson.M{
		{
			"$set": bson.M{
				"posts_made": bson.M{"$add": []interface{}{"$posts_made", 1}},
			},
		},
	}

	// Use FindOneAndUpdate with ReturnDocument: options.After to get the updated document
	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var updatedUser types.SafeUser
	err := s.Users.FindOneAndUpdate(ctx, userFilter, updatePipeline, opts).Decode(&updatedUser)
	if err != nil {
		return nil, fmt.Errorf("failed to update user stats: %w", err)
	}

	return &UserStatsUpdate{
		PostsMade: updatedUser.PostsMade,
		Points:    updatedUser.Points,
	}, nil
}

// UpdatePartialPost updates only specified fields of a Post document by ObjectID.
func (s *Service) UpdatePartialPost(ctx context.Context, id primitive.ObjectID, updated UpdatePostParams) error {
	filter := bson.M{"_id": id}

	updateDoc := bson.M{
		"$set": bson.M{
			"metadata.updatedAt": time.Now(),
			"metadata.isEdited":  true,
		},
	}
	setMap, ok := updateDoc["$set"].(bson.M)
	if !ok {
		return fmt.Errorf("failed to get $set map from update document")
	}

	if updated.Caption != nil {
		setMap["caption"] = *updated.Caption
	}

	if updated.IsPublic != nil {
		setMap["metadata.isPublic"] = *updated.IsPublic
	}

	if updated.Size != nil {
		setMap["size"] = *updated.Size
	}

	if updated.TaggedUsers != nil {
		// Fetch the existing post to diff against.
		var existing types.PostDocument
		if err := s.Posts.FindOne(ctx, bson.M{"_id": id, "metadata.isDeleted": false}).Decode(&existing); err != nil {
			return fmt.Errorf("failed to fetch existing post for tag diff: %w", err)
		}

		var candidates []primitive.ObjectID
		for _, m := range *updated.TaggedUsers {
			if objID, err := primitive.ObjectIDFromHex(m.ID); err == nil {
				candidates = append(candidates, objID)
			}
		}

		resolved, err := s.ResolveTaggedUsers(ctx, existing.User.ID, candidates)
		if err != nil {
			return fmt.Errorf("failed to resolve tagged users: %w", err)
		}

		// Diff against the existing list.
		prevSet := make(map[primitive.ObjectID]struct{}, len(existing.TaggedUsers))
		for _, t := range existing.TaggedUsers {
			prevSet[t.ID] = struct{}{}
		}
		var newlyAdded []types.MentionReference
		for _, t := range resolved {
			if _, found := prevSet[t.ID]; !found {
				newlyAdded = append(newlyAdded, t)
			}
		}

		setMap["taggedUsers"] = resolved

		// Fan out notifications only to the newly added users.
		var thumbnail string
		if len(existing.Images) > 0 {
			thumbnail = existing.Images[0]
		}
		for _, t := range newlyAdded {
			if t.ID == existing.User.ID {
				continue
			}
			content := fmt.Sprintf("%s tagged you in a post", existing.User.DisplayName)
			_ = s.NotificationService.CreateNotification(existing.User.ID, t.ID, content, notifications.NotificationTypePostTag, existing.ID, thumbnail)
			_ = s.sendTagPushNotification(t.ID, existing.ID, existing.User.DisplayName)
		}
	}

	_, err := s.Posts.UpdateOne(ctx, filter, updateDoc)
	return err
}

// DeletePost removes a Post document by ObjectID.
func (s *Service) DeletePost(id primitive.ObjectID) error {
	ctx := context.Background()

	filter := bson.M{"_id": id}

	_, err := s.Posts.DeleteOne(ctx, filter)
	return err
}

// GetUserPosts fetches posts for a specific user with pagination
func (s *Service) GetUserPosts(userID primitive.ObjectID, limit, offset int) ([]types.PostDocument, int, error) {
	ctx := context.Background()

	filter := bson.M{
		"user._id":           userID,
		"metadata.isDeleted": false,
	}

	// Set default limit if not provided
	if limit <= 0 {
		limit = 18
	}

	// Get total count
	total, err := s.Posts.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	// Find with pagination
	findOptions := options.Find().
		SetSort(bson.D{{Key: "metadata.createdAt", Value: -1}}).
		SetLimit(int64(limit)).
		SetSkip(int64(offset))

	cursor, err := s.Posts.Find(ctx, filter, findOptions)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var results []types.PostDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, 0, err
	}

	return results, int(total), nil
}

// GetFriendsPosts fetches posts from the user's friends using aggregation pipeline with group visibility, ordered chronologically (newest first) with pagination
func (s *Service) GetFriendsPosts(userID primitive.ObjectID, limit, offset int) ([]types.PostDocument, int, error) {
	ctx := context.Background()

	// Set default limit if not provided
	if limit <= 0 {
		limit = 8
	}

	// Get blocked user IDs to filter them out
	blockedUserIDs, err := s.GetBlockedUserIDs(ctx, userID)
	if err != nil {
		slog.Warn("Failed to get blocked users, continuing without filter", "error", err)
		blockedUserIDs = []primitive.ObjectID{}
	}

	// Ensure blockedUserIDs is never nil for MongoDB aggregation
	// Convert to bson.A to ensure proper serialization
	var blockedUserIDsArray bson.A
	if len(blockedUserIDs) == 0 {
		blockedUserIDsArray = bson.A{}
	} else {
		blockedUserIDsArray = make(bson.A, len(blockedUserIDs))
		for i, id := range blockedUserIDs {
			blockedUserIDsArray[i] = id
		}
	}

	// Get post IDs that the current user has personally reported (always hidden)
	userReportedIDs, err := s.GetUserReportedPostIDs(ctx, userID)
	if err != nil {
		slog.Warn("Failed to get user reported posts, continuing without filter", "error", err)
		userReportedIDs = []primitive.ObjectID{}
	}

	// If content filter is enabled, also get all globally reported post IDs
	contentFilterEnabled, err := s.GetUserContentFilterEnabled(ctx, userID)
	if err != nil {
		slog.Warn("Failed to get content filter setting, defaulting to enabled", "error", err)
		contentFilterEnabled = true
	}

	var allReportedIDs []primitive.ObjectID
	if contentFilterEnabled {
		allReportedIDs, err = s.GetReportedPostIDs(ctx)
		if err != nil {
			slog.Warn("Failed to get reported posts, continuing without filter", "error", err)
			allReportedIDs = []primitive.ObjectID{}
		}
	}

	// Merge user-reported IDs and content-filter reported IDs into one exclusion set
	excludedPostIDSet := make(map[primitive.ObjectID]struct{})
	for _, id := range userReportedIDs {
		excludedPostIDSet[id] = struct{}{}
	}
	for _, id := range allReportedIDs {
		excludedPostIDSet[id] = struct{}{}
	}
	var excludedPostIDsArray bson.A
	for id := range excludedPostIDSet {
		excludedPostIDsArray = append(excludedPostIDsArray, id)
	}
	if excludedPostIDsArray == nil {
		excludedPostIDsArray = bson.A{}
	}

	// Get user's groups to check group membership
	userGroups, err := s.GetUserGroups(userID)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get user groups: %w", err)
	}

	// Extract group IDs
	var userGroupIDs []primitive.ObjectID
	for _, group := range userGroups {
		userGroupIDs = append(userGroupIDs, group.ID)
	}

	// Build visibility filter
	// Simple rules:
	// 1. Post has groups → Show if user is a member of any of those groups
	// 2. Post has no groups → Show if user is a friend of the creator
	visibilityConditions := []bson.M{}

	// Rule 1: Post has groups AND user is a member of at least one group
	if len(userGroupIDs) > 0 {
		visibilityConditions = append(visibilityConditions, bson.M{
			"$and": []bson.M{
				// Post must have groups
				{"$ne": []interface{}{"$groups", nil}},
				{"$gt": []interface{}{bson.M{"$size": bson.M{"$ifNull": []interface{}{"$groups", []interface{}{}}}}, 0}},
				// User must be in at least one of the post's groups
				{
					"$gt": []interface{}{
						bson.M{
							"$size": bson.M{
								"$setIntersection": []interface{}{
									bson.M{"$ifNull": []interface{}{"$groups", []interface{}{}}},
									userGroupIDs,
								},
							},
						},
						0,
					},
				},
			},
		})
	}

	// Rule 2: Post has no groups (or empty groups array) AND user is a friend of the creator
	visibilityConditions = append(visibilityConditions, bson.M{
		"$and": []bson.M{
			// User must be a friend of the post creator
			{
				"$in": []interface{}{
					bson.M{"$toObjectId": "$user._id"},
					"$$friendIds",
				},
			},
			// Post must have no groups or empty groups array
			{
				"$or": []bson.M{
					{"$eq": []interface{}{"$groups", nil}},
					{"$eq": []interface{}{bson.M{"$size": bson.M{"$ifNull": []interface{}{"$groups", []interface{}{}}}}, 0}},
				},
			},
		},
	})

	// Build the common match conditions
	feedMatchConditions := []bson.M{
		{"$eq": []interface{}{"$metadata.isDeleted", false}},
		{
			"$or": visibilityConditions,
		},
		// Filter out posts from blocked users
		{
			"$not": bson.M{
				"$in": []interface{}{
					bson.M{"$toObjectId": "$user._id"},
					blockedUserIDsArray,
				},
			},
		},
	}

	// Filter out reported posts (user's own reports + content filter)
	if len(excludedPostIDsArray) > 0 {
		feedMatchConditions = append(feedMatchConditions, bson.M{
			"$not": bson.M{
				"$in": []interface{}{"$_id", excludedPostIDsArray},
			},
		})
	}

	// Fetch limit+1 to determine hasMore without a separate count pipeline.
	// This avoids loading ALL visible posts into memory just to count them.
	fetchLimit := limit + 1

	pipeline := mongo.Pipeline{
		// Stage 1: Match the specific user
		{{Key: "$match", Value: bson.M{"_id": userID}}},

		// Stage 2: Extract friend IDs for posts lookup (no need to $lookup the full friend docs)
		{{Key: "$project", Value: bson.M{
			"friendIds": "$friends",
		}}},

		// Stage 3: Lookup posts with visibility filtering
		{{Key: "$lookup", Value: bson.M{
			"from": "posts",
			"let":  bson.M{"friendIds": "$friendIds"},
			"pipeline": mongo.Pipeline{
				// Match posts that are not deleted and meet visibility criteria
				{{Key: "$match", Value: bson.M{
					"$expr": bson.M{
						"$and": feedMatchConditions,
					},
				}}},
				// Sort by creation date (newest first)
				{{Key: "$sort", Value: bson.M{"metadata.createdAt": -1}}},
				// Add pagination — fetch one extra to detect hasMore
				{{Key: "$skip", Value: offset}},
				{{Key: "$limit", Value: fetchLimit}},
			},
			"as": "visiblePosts",
		}}},

		// Stage 4: Unwind the posts array to get individual posts
		{{Key: "$unwind", Value: "$visiblePosts"}},

		// Stage 5: Replace root with the post document
		{{Key: "$replaceRoot", Value: bson.M{
			"newRoot": "$visiblePosts",
		}}},
	}

	cursor, err := s.Users.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to execute aggregation pipeline: %w", err)
	}
	defer cursor.Close(ctx)

	var results []types.PostDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, 0, fmt.Errorf("failed to decode aggregation results: %w", err)
	}

	// If we got more than limit, there are more pages.
	// Compute a synthetic total that makes hasMore work: offset + len(results) [+ 1 if more].
	hasMore := len(results) > limit
	if hasMore {
		results = results[:limit] // trim the extra probe row
	}

	// Callers compute hasMore as: offset+len(results) < total.
	// Set total so that formula produces the right boolean.
	total := offset + len(results)
	if hasMore {
		total++ // ensures offset+len(results) < total → true
	}

	return results, total, nil
}

// GetUserGroups fetches all groups where the user is a creator or member
func (s *Service) GetUserGroups(userID primitive.ObjectID) ([]types.GroupDocument, error) {
	ctx := context.Background()

	// Find groups where user is creator or member
	filter := bson.M{
		"$or": []bson.M{
			{"creator": userID},
			{"members._id": userID},
		},
		"metadata.isDeleted": false,
	}

	cursor, err := s.Groups.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []types.GroupDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// GetFriendsPublicTasks fetches public tasks from the user's friends using aggregation pipeline
func (s *Service) GetFriendsPublicTasks(userID primitive.ObjectID, limit, offset int) ([]bson.M, int, error) {
	ctx := context.Background()

	// Set default limit if not provided
	if limit <= 0 {
		limit = 20
	}

	// Build aggregation pipeline to get friends' public tasks
	pipeline := mongo.Pipeline{
		// Stage 1: Match the specific user
		{{Key: "$match", Value: bson.M{"_id": userID}}},

		// Stage 2: Lookup friends from users collection based on friends array
		{{Key: "$lookup", Value: bson.M{
			"from":         "users",
			"localField":   "friends",
			"foreignField": "_id",
			"as":           "friendsData",
		}}},

		// Stage 3: Extract friend IDs
		{{Key: "$project", Value: bson.M{
			"friendIds": "$friends",
		}}},

		// Stage 4: Lookup categories owned by friends
		{{Key: "$lookup", Value: bson.M{
			"from": "categories",
			"let":  bson.M{"friendIds": "$friendIds"},
			"pipeline": mongo.Pipeline{
				// Match categories owned by friends
				{{Key: "$match", Value: bson.M{
					"$expr": bson.M{
						"$in": []interface{}{"$user", "$$friendIds"},
					},
				}}},
				// Unwind tasks array to work with individual tasks
				{{Key: "$unwind", Value: "$tasks"}},
				// Match only public tasks (field is "public" not "isPublic")
				{{Key: "$match", Value: bson.M{
					"tasks.public": true,
				}}},
				// Project the fields we need
				{{Key: "$project", Value: bson.M{
					"_id":           "$tasks._id",
					"content":       "$tasks.content",
					"priority":      "$tasks.priority",
					"value":         "$tasks.value",
					"public":        "$tasks.public",
					"timestamp":     "$tasks.timestamp",
					"lastEdited":    "$tasks.lastEdited",
					"categoryId":    "$_id",
					"categoryName":  "$name",
					"workspaceName": "$workspaceName",
					"userId":        "$user",
				}}},
			},
			"as": "friendsTasks",
		}}},

		// Stage 5: Unwind the tasks array
		{{Key: "$unwind", Value: "$friendsTasks"}},

		// Stage 6: Replace root with the task document
		{{Key: "$replaceRoot", Value: bson.M{
			"newRoot": "$friendsTasks",
		}}},

		// Stage 7: Lookup user information for the task owner
		{{Key: "$lookup", Value: bson.M{
			"from":         "users",
			"localField":   "userId",
			"foreignField": "_id",
			"as":           "userData",
		}}},

		// Stage 8: Add user object to the task document
		{{Key: "$addFields", Value: bson.M{
			"user": bson.M{
				"$arrayElemAt": []interface{}{"$userData", 0},
			},
		}}},

		// Stage 9: Remove temporary userData field
		{{Key: "$project", Value: bson.M{
			"userData": 0,
		}}},

		// Stage 10: Add random field for sampling
		{{Key: "$addFields", Value: bson.M{
			"randomSort": bson.M{"$rand": bson.M{}},
		}}},

		// Stage 11: Sort by random field first, then timestamp for consistency
		{{Key: "$sort", Value: bson.M{
			"randomSort": 1,
			"timestamp":  -1,
		}}},

		// Stage 12: Apply pagination
		{{Key: "$facet", Value: bson.M{
			"metadata": []bson.M{
				{"$count": "total"},
			},
			"data": []bson.M{
				{"$skip": offset},
				{"$limit": limit},
			},
		}}},
	}

	cursor, err := s.Users.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get friends public tasks: %w", err)
	}
	defer cursor.Close(ctx)

	var results []bson.M
	if err := cursor.All(ctx, &results); err != nil {
		return nil, 0, fmt.Errorf("failed to decode friends public tasks: %w", err)
	}

	// Extract total count and data from facet result
	total := 0
	var tasks []bson.M

	if len(results) > 0 {
		if metadata, ok := results[0]["metadata"].(primitive.A); ok && len(metadata) > 0 {
			if metaDoc, ok := metadata[0].(bson.M); ok {
				if t, ok := metaDoc["total"].(int32); ok {
					total = int(t)
				} else if t, ok := metaDoc["total"].(int64); ok {
					total = int(t)
				}
			}
		}

		if data, ok := results[0]["data"].(primitive.A); ok {
			for _, item := range data {
				if taskDoc, ok := item.(bson.M); ok {
					tasks = append(tasks, taskDoc)
				}
			}
		}
	}

	slog.Info("Friends public tasks fetched with random sampling",
		"userId", userID.Hex(),
		"count", len(tasks),
		"total", total,
		"limit", limit,
		"offset", offset,
	)

	return tasks, total, nil
}

// GetPostsByBlueprint fetches all posts associated with a specific blueprint
func (s *Service) GetPostsByBlueprint(blueprintID primitive.ObjectID) ([]types.PostDocument, error) {
	ctx := context.Background()

	filter := bson.M{
		"blueprint.id":       blueprintID,
		"metadata.isDeleted": false,
		"metadata.isPublic":  true, // Only return public posts
	}

	// Sort by creation date, newest first
	cursor, err := s.Posts.Find(ctx, filter, &options.FindOptions{
		Sort: bson.D{{Key: "metadata.createdAt", Value: -1}},
	})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []types.PostDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

func (s *Service) AddComment(postID primitive.ObjectID, comment types.CommentDocument) error {
	ctx := context.Background()

	comment.Metadata = types.NewCommentMetadata()

	filter := bson.M{"_id": postID, "metadata.isDeleted": false}
	update := bson.M{
		"$push": bson.M{
			"comments": comment,
		},
		"$set": bson.M{
			"metadata.updatedAt": time.Now(),
			"metadata.isEdited":  true,
		},
	}

	// Use FindOneAndUpdate to get the post document and update it in one operation
	var post types.PostDocument
	err := s.Posts.FindOneAndUpdate(ctx, filter, update).Decode(&post)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return fmt.Errorf("post not found or has been deleted")
		}
		return fmt.Errorf("failed to add comment: %w", err)
	}

	// Send notification to post owner (only if commenter is not the post owner)
	if comment.User != nil && comment.User.ID != post.User.ID {
		// Send push notification
		err = s.sendCommentNotification(post.User.ID, post.ID, comment.User.DisplayName, comment.Content)
		if err != nil {
			// Log error but don't fail the operation since comment was already created
			slog.Error("Failed to send comment notification", "error", err, "post_owner_id", post.User.ID)
		}

		// Create notification in the database with thumbnail (first image from post if available).
		// The in-app card already shows the commenter's avatar + name and a
		// "commented on your post" header, so the body is just the comment text.
		// (Push notifications still prefix the name — see sendCommentNotification.)
		notificationContent := comment.Content
		var thumbnail string
		if len(post.Images) > 0 {
			thumbnail = post.Images[0]
		}
		err = s.NotificationService.CreateNotification(comment.User.ID, post.User.ID, notificationContent, notifications.NotificationTypeComment, post.ID, thumbnail)
		if err != nil {
			// Log error but don't fail the operation since comment was already created
			slog.Error("Failed to create comment notification in database", "error", err, "post_owner_id", post.User.ID)
		}
	}

	// Notify mentioned users
	for _, mention := range comment.Mentions {
		// Don't notify if mentioning yourself or the post owner (already notified)
		if mention.ID == comment.User.ID || mention.ID == post.User.ID {
			continue
		}

		notificationContent := fmt.Sprintf("%s mentioned you: \"%s\"", comment.User.DisplayName, comment.Content)
		var thumbnail string
		if len(post.Images) > 0 {
			thumbnail = post.Images[0]
		}

		err = s.NotificationService.CreateNotification(comment.User.ID, mention.ID, notificationContent, notifications.NotificationTypeComment, post.ID, thumbnail)
		if err != nil {
			slog.Error("Failed to create mention notification", "error", err, "mentioned_user_id", mention.ID)
		}

		// Send push notification
		err = s.sendCommentNotification(mention.ID, post.ID, comment.User.DisplayName, comment.Content)
		if err != nil {
			slog.Error("Failed to send mention push notification", "error", err, "mentioned_user_id", mention.ID)
		}
	}

	return nil
}

func (s *Service) ToggleReaction(r *types.ReactDocument) (bool, error) {
	ctx := context.Background()
	field := "reactions." + r.Emoji

	// Get current state
	var post types.PostDocument
	err := s.Posts.FindOne(ctx, bson.M{"_id": r.PostID}).Decode(&post)
	if err != nil {
		return false, err
	}

	currentReactions := post.Reactions[r.Emoji]
	userExists := false
	for _, id := range currentReactions {
		if id == r.UserID {
			userExists = true
			break
		}
	}

	var update bson.M
	if userExists {
		// Remove user
		if len(currentReactions) == 1 {
			update = bson.M{
				"$unset": bson.M{field: ""},
				"$set": bson.M{
					"metadata.updatedAt": time.Now(),
					"metadata.isEdited":  true,
				},
			}
		} else {
			// Remove just this user
			update = bson.M{
				"$pull": bson.M{field: r.UserID},
				"$set": bson.M{
					"metadata.updatedAt": time.Now(),
					"metadata.isEdited":  true,
				},
			}
		}
	} else {
		// Add user
		update = bson.M{
			"$addToSet": bson.M{field: r.UserID},
			"$set": bson.M{
				"metadata.updatedAt": time.Now(),
				"metadata.isEdited":  true,
			},
		}
	}

	_, err = s.Posts.UpdateOne(ctx, bson.M{"_id": r.PostID}, update)
	if err != nil {
		return false, err
	}

	return !userExists, err
}

// Replace your existing DeleteComment method in service.go with this:

func (s *Service) DeleteComment(postID primitive.ObjectID, commentID primitive.ObjectID) error {
	ctx := context.Background()

	filter := bson.M{
		"_id":                postID,
		"metadata.isDeleted": false,
	}

	// Delete the comment and all replies that have this comment as parentId
	update := bson.M{
		"$pull": bson.M{
			"comments": bson.M{
				"$or": []bson.M{
					{"_id": commentID},      // Delete the comment itself
					{"parentId": commentID}, // Delete all replies to this comment
				},
			},
		},
		"$set": bson.M{
			"metadata.updatedAt": time.Now(),
			"metadata.isEdited":  true,
		},
	}

	result, err := s.Posts.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to delete comment and replies: %w", err)
	}

	if result.ModifiedCount == 0 {
		return fmt.Errorf("comment not found or post has been deleted")
	}

	return nil
}

// sendCommentNotification sends a push notification when a comment is added to a post
func (s *Service) sendCommentNotification(postOwnerID, postID primitive.ObjectID, commenterName, commentText string) error {
	if s.Users == nil {
		return fmt.Errorf("users collection not available")
	}

	ctx := context.Background()

	// Get post owner's push token
	var postOwner types.User
	err := s.Users.FindOne(ctx, bson.M{"_id": postOwnerID}).Decode(&postOwner)
	if err != nil {
		return fmt.Errorf("failed to get post owner user: %w", err)
	}

	if postOwner.PushToken == "" {
		slog.Warn("Post owner has no push token", "post_owner_id", postOwnerID)
		return nil // Not an error, just no notification sent
	}

	message := fmt.Sprintf("%s commented: \"%s\"", commenterName, commentText)

	data := map[string]string{
		"type":           "comment",
		"commenter_name": commenterName,
		"comment_text":   commentText,
	}
	if !postID.IsZero() {
		data["post_id"] = postID.Hex()
	}

	notification := xutils.Notification{
		Token:   postOwner.PushToken,
		Title:   "New comment on your post",
		Message: message,
		Data:    data,
	}

	return xutils.SendNotification(notification)
}

// sendTagPushNotification sends a push notification when a user is tagged in a post.
func (s *Service) sendTagPushNotification(taggedUserID, postID primitive.ObjectID, taggerName string) error {
	if s.Users == nil {
		return fmt.Errorf("users collection not available")
	}

	ctx := context.Background()

	var taggedUser types.User
	err := s.Users.FindOne(ctx, bson.M{"_id": taggedUserID}).Decode(&taggedUser)
	if err != nil {
		return fmt.Errorf("failed to get tagged user: %w", err)
	}

	if taggedUser.PushToken == "" {
		slog.Warn("Tagged user has no push token", "tagged_user_id", taggedUserID)
		return nil
	}

	data := map[string]string{
		"type":        "post_tag",
		"tagger_name": taggerName,
	}
	if !postID.IsZero() {
		data["post_id"] = postID.Hex()
	}

	notification := xutils.Notification{
		Token:   taggedUser.PushToken,
		Title:   "You were tagged in a post",
		Message: fmt.Sprintf("%s tagged you in a post", taggerName),
		Data:    data,
	}

	return xutils.SendNotification(notification)
}

// CheckRelationship checks the relationship between two users
// Returns true if they are friends or if it's the same user
func (s *Service) CheckRelationship(viewerID, profileUserID primitive.ObjectID) (bool, error) {
	ctx := context.Background()

	// Check for self - user can always view their own posts
	if viewerID == profileUserID {
		return true, nil
	}

	// Check if users are friends
	// Sort IDs to match how they're stored in the database
	sortedIDs := sortUserIDs(viewerID, profileUserID)

	// Query the connections collection
	var connection struct {
		Status string `bson:"status"`
	}

	err := s.Connections.FindOne(ctx, bson.M{"users": sortedIDs}).Decode(&connection)

	if err != nil {
		if err == mongo.ErrNoDocuments {
			// No connection found, they're not friends
			return false, nil
		}
		// Some other error occurred
		return false, err
	}

	// If users are blocked, deny access
	if connection.Status == "blocked" {
		return false, nil
	}

	// Check if status is "friends"
	return connection.Status == "friends", nil
}

// sortUserIDs sorts two user IDs to ensure consistent ordering
func sortUserIDs(userA, userB primitive.ObjectID) []primitive.ObjectID {
	if userA.Hex() < userB.Hex() {
		return []primitive.ObjectID{userA, userB}
	}
	return []primitive.ObjectID{userB, userA}
}

// GetBlockedUserIDs retrieves all user IDs that are blocked by or have blocked the given user
func (s *Service) GetBlockedUserIDs(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	// Find all blocked relationships involving this user
	cursor, err := s.Connections.Find(ctx, bson.M{
		"users":  userID,
		"status": "blocked",
	})

	if err != nil {
		return nil, fmt.Errorf("failed to find blocked relationships: %w", err)
	}
	defer cursor.Close(ctx)

	var blockedRelationships []struct {
		Users []primitive.ObjectID `bson:"users"`
	}

	if err := cursor.All(ctx, &blockedRelationships); err != nil {
		return nil, fmt.Errorf("failed to decode blocked relationships: %w", err)
	}

	// Extract the other user IDs from each relationship
	var blockedUserIDs []primitive.ObjectID
	for _, rel := range blockedRelationships {
		for _, id := range rel.Users {
			if id != userID {
				blockedUserIDs = append(blockedUserIDs, id)
			}
		}
	}

	return blockedUserIDs, nil
}

// NotifyRandomFriendsOfPost notifies a random subset of friends about a new post
// Each friend has a configurable probability (default 30%) of being notified
func (s *Service) NotifyRandomFriendsOfPost(postID primitive.ObjectID, posterID primitive.ObjectID, posterName string, postCaption string, notificationProbability float64) error {
	ctx := context.Background()

	// Default to 30% probability if not specified or invalid
	if notificationProbability <= 0 || notificationProbability > 1 {
		notificationProbability = 0.30
	}

	// Get the poster's friends list
	var posterUser struct {
		Friends []primitive.ObjectID `bson:"friends"`
	}
	err := s.Users.FindOne(ctx, bson.M{"_id": posterID}).Decode(&posterUser)
	if err != nil {
		return fmt.Errorf("failed to get poster's friends: %w", err)
	}

	if len(posterUser.Friends) == 0 {
		slog.Info("No friends to notify", "poster_id", posterID)
		return nil
	}

	// Randomly select friends to notify based on probability
	var selectedFriends []primitive.ObjectID
	for _, friendID := range posterUser.Friends {
		// Use crypto/rand for secure random number generation
		randNum, err := rand.Int(rand.Reader, big.NewInt(1000))
		if err != nil {
			slog.Warn("Failed to generate random number for friend selection", "error", err)
			continue
		}
		if float64(randNum.Int64())/1000.0 < notificationProbability {
			selectedFriends = append(selectedFriends, friendID)
		}
	}

	if len(selectedFriends) == 0 {
		slog.Info("No friends randomly selected for notification", "poster_id", posterID, "total_friends", len(posterUser.Friends))
		return nil
	}

	// Get the post to extract thumbnail
	post, err := s.GetPostByID(postID)
	if err != nil {
		return fmt.Errorf("failed to get post for notification: %w", err)
	}

	var thumbnail string
	if len(post.Images) > 0 {
		thumbnail = post.Images[0]
	}

	// Truncate caption for notification if too long
	notificationCaption := postCaption
	if len(notificationCaption) > 40 {
		notificationCaption = notificationCaption[:37] + "..."
	}

	// Send notifications to selected friends
	successCount := 0
	errorCount := 0

	// Possible call-to-action phrases - supportive and encouraging
	callToActions := []string{
		"Show them some love!",
		"Cheer them on!",
		"Send them some encouragement!",
		"Celebrate with them!",
		"Let them know you're proud!",
		"Support their progress!",
		"LFG!",
		"Bang!",
	}

	for _, friendID := range selectedFriends {
		// Get friend's push token
		var friend types.User
		err := s.Users.FindOne(ctx, bson.M{"_id": friendID}).Decode(&friend)
		if err != nil {
			slog.Warn("Failed to get friend user for notification", "friend_id", friendID, "error", err)
			errorCount++
			continue
		}

		// Pick a random call to action using crypto/rand
		randIdx, err := rand.Int(rand.Reader, big.NewInt(int64(len(callToActions))))
		if err != nil {
			slog.Warn("Failed to generate random index for call to action", "error", err)
			continue
		}
		callToAction := callToActions[randIdx.Int64()]

		// Send push notification if friend has a push token
		if friend.PushToken != "" {
			// Personalized notification: "John just completed 'Morning workout' - Check it out!"
			notificationTitle := fmt.Sprintf("%s just completed \"%s\"", posterName, notificationCaption)
			notification := xutils.Notification{
				Token:   friend.PushToken,
				Title:   notificationTitle,
				Message: callToAction,
				Data: map[string]string{
					"type":        "new_post",
					"post_id":     postID.Hex(),
					"poster_name": posterName,
					"poster_id":   posterID.Hex(),
				},
			}

			err = xutils.SendNotification(notification)
			if err != nil {
				slog.Error("Failed to send push notification for new post", "error", err, "friend_id", friendID)
				errorCount++
			}
		}

		// Create notification in database with personalized message
		notificationContent := fmt.Sprintf("%s just completed \"%s\"", posterName, notificationCaption)
		err = s.NotificationService.CreateNotification(posterID, friendID, notificationContent, notifications.NotificationTypePost, postID, thumbnail)
		if err != nil {
			slog.Error("Failed to create database notification for new post", "error", err, "friend_id", friendID)
			errorCount++
		} else {
			successCount++
		}
	}

	slog.Info("Notified random subset of friends about new post",
		"post_id", postID,
		"poster_id", posterID,
		"total_friends", len(posterUser.Friends),
		"selected_friends", len(selectedFriends),
		"success_count", successCount,
		"error_count", errorCount,
		"probability", notificationProbability,
	)

	return nil
}

// GetFriendsRingClosures returns ring closure notifications from friends, sorted by time descending.
func (s *Service) GetFriendsRingClosures(userID primitive.ObjectID, limit, offset int) ([]FeedRingsClosedData, int, error) {
	ctx := context.Background()

	notifColl := s.NotificationService.Notifications

	filter := bson.M{
		"receiver":         userID,
		"notificationType": "RINGS_CLOSED",
		"user._id":         bson.M{"$ne": userID},
	}

	total, err := notifColl.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "time", Value: -1}}).
		SetLimit(int64(limit)).
		SetSkip(int64(offset))

	cursor, err := notifColl.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var results []FeedRingsClosedData
	for cursor.Next(ctx) {
		var doc struct {
			ID      primitive.ObjectID `bson:"_id"`
			Time    time.Time          `bson:"time"`
			Content string             `bson:"content"`
			User    struct {
				ID             primitive.ObjectID `bson:"_id"`
				DisplayName    string             `bson:"display_name"`
				Handle         string             `bson:"handle"`
				ProfilePicture string             `bson:"profile_picture"`
			} `bson:"user"`
		}
		if err := cursor.Decode(&doc); err != nil {
			continue
		}

		results = append(results, FeedRingsClosedData{
			ID:        doc.ID.Hex(),
			Timestamp: doc.Time.Format(time.RFC3339),
			Content:   doc.Content,
			User: &types.UserExtendedReference{
				ID:             doc.User.ID.Hex(),
				Handle:         doc.User.Handle,
				DisplayName:    doc.User.DisplayName,
				ProfilePicture: doc.User.ProfilePicture,
			},
		})
	}

	return results, int(total), nil
}

// ResolveTaggedUsers validates a candidate set of user IDs against the
// author's friends list and returns canonical MentionReferences in the
// original insertion order, deduped, with self excluded.
func (s *Service) ResolveTaggedUsers(ctx context.Context, authorID primitive.ObjectID, candidates []primitive.ObjectID) ([]types.MentionReference, error) {
	if len(candidates) == 0 {
		return nil, nil
	}

	// 1. Load the author's accepted friend IDs.
	cursor, err := s.Connections.Find(ctx, bson.M{
		"users":  authorID,
		"status": "friends",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query author's friends: %w", err)
	}
	defer cursor.Close(ctx)

	var connections []struct {
		Users []primitive.ObjectID `bson:"users"`
	}
	if err := cursor.All(ctx, &connections); err != nil {
		return nil, fmt.Errorf("failed to decode friends: %w", err)
	}

	friends := make(map[primitive.ObjectID]struct{}, len(connections))
	for _, c := range connections {
		for _, uid := range c.Users {
			if uid != authorID {
				friends[uid] = struct{}{}
			}
		}
	}

	// 2. Walk candidates in order, keeping the first occurrence of each
	//    candidate that is a friend (and not the author themselves).
	seen := make(map[primitive.ObjectID]struct{}, len(candidates))
	var validIDs []primitive.ObjectID
	for _, cid := range candidates {
		if cid == authorID {
			continue
		}
		if _, ok := friends[cid]; !ok {
			continue
		}
		if _, dup := seen[cid]; dup {
			continue
		}
		seen[cid] = struct{}{}
		validIDs = append(validIDs, cid)
	}

	if len(validIDs) == 0 {
		return nil, nil
	}

	// 3. Fetch canonical handle, name, and avatar in one query.
	userCursor, err := s.Users.Find(ctx, bson.M{"_id": bson.M{"$in": validIDs}}, options.Find().SetProjection(bson.M{"_id": 1, "handle": 1, "display_name": 1, "profile_picture": 1}))
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user handles: %w", err)
	}
	defer userCursor.Close(ctx)

	var users []struct {
		ID             primitive.ObjectID `bson:"_id"`
		Handle         string             `bson:"handle"`
		DisplayName    string             `bson:"display_name"`
		ProfilePicture string             `bson:"profile_picture"`
	}
	if err := userCursor.All(ctx, &users); err != nil {
		return nil, fmt.Errorf("failed to decode users: %w", err)
	}

	refByID := make(map[primitive.ObjectID]types.MentionReference, len(users))
	for _, u := range users {
		refByID[u.ID] = types.MentionReference{ID: u.ID, Handle: u.Handle, Name: u.DisplayName, Icon: u.ProfilePicture}
	}

	// 4. Build result in the order of validIDs.
	result := make([]types.MentionReference, 0, len(validIDs))
	for _, id := range validIDs {
		ref, ok := refByID[id]
		if !ok {
			// User was a friend but doesn't exist anymore — skip.
			continue
		}
		result = append(result, ref)
	}

	return result, nil
}
