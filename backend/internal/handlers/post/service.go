package Post

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/notifications"
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
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Posts:               collections["posts"],
		Users:               collections["users"],
		Blueprints:          collections["blueprints"],
		Categories:          collections["categories"],
		Groups:              collections["groups"],
		Connections:         collections["friend-requests"],
		NotificationService: notifications.NewNotificationService(collections),
	}
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
	id := result.InsertedID.(primitive.ObjectID)
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

// updateUserPostStats increments the user's posts made count and adds points based on streak
func (s *Service) updateUserPostStats(ctx context.Context, userID primitive.ObjectID) (*UserStatsUpdate, error) {
	userFilter := bson.M{"_id": userID}

	// Use aggregation pipeline to calculate points based on current streak in a single atomic operation
	// Points = 1 (base) + current streak value
	updatePipeline := []bson.M{
		{
			"$set": bson.M{
				"posts_made": bson.M{"$add": []interface{}{"$posts_made", 1}},
				"points":     bson.M{"$add": []interface{}{"$points", bson.M{"$add": []interface{}{1, "$streak"}}}},
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
func (s *Service) UpdatePartialPost(id primitive.ObjectID, updated UpdatePostParams) error {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	updateDoc := bson.M{
		"$set": bson.M{
			"metadata.updatedAt": time.Now(),
			"metadata.isEdited":  true,
		},
	}
	if updated.Caption != nil {
		updateDoc["$set"].(bson.M)["caption"] = *updated.Caption
	}

	if updated.IsPublic != nil {
		updateDoc["$set"].(bson.M)["metadata.isPublic"] = *updated.IsPublic
	}

	if updated.Size != nil {
		updateDoc["$set"].(bson.M)["size"] = *updated.Size
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

// GetUserPosts fetches posts for a specific user
func (s *Service) GetUserPosts(userID primitive.ObjectID) ([]types.PostDocument, error) {
	ctx := context.Background()

	filter := bson.M{
		"user._id":           userID,
		"metadata.isDeleted": false,
	}

	cursor, err := s.Posts.Find(ctx, filter)
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

// GetFriendsPosts fetches posts from the user's friends using aggregation pipeline with group visibility, ordered chronologically (newest first) with pagination
func (s *Service) GetFriendsPosts(userID primitive.ObjectID, limit, offset int) ([]types.PostDocument, int, error) {
	ctx := context.Background()

	// Set default limit if not provided
	if limit <= 0 {
		limit = 8
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

	// First, get the total count of visible posts
	countPipeline := mongo.Pipeline{
		// Stage 1: Match the specific user
		{{Key: "$match", Value: bson.M{"_id": userID}}},

		// Stage 2: Lookup friends from users collection based on friends array
		{{Key: "$lookup", Value: bson.M{
			"from":         "users",
			"localField":   "friends",
			"foreignField": "_id",
			"as":           "friendsData",
		}}},

		// Stage 3: Extract friend IDs for posts lookup
		{{Key: "$project", Value: bson.M{
			"friendIds": "$friends",
		}}},

		// Stage 4: Lookup posts with visibility filtering
		{{Key: "$lookup", Value: bson.M{
			"from": "posts",
			"let":  bson.M{"friendIds": "$friendIds"},
			"pipeline": mongo.Pipeline{
				// Match posts that are not deleted and meet visibility criteria
				{{Key: "$match", Value: bson.M{
					"$expr": bson.M{
						"$and": []bson.M{
							{"$eq": []interface{}{"$metadata.isDeleted", false}},
							{
								"$or": visibilityConditions,
							},
						},
					},
				}}},
			},
			"as": "visiblePosts",
		}}},

		// Stage 5: Count the posts
		{{Key: "$project", Value: bson.M{
			"total": bson.M{"$size": "$visiblePosts"},
		}}},
	}

	countCursor, err := s.Users.Aggregate(ctx, countPipeline)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count friends posts: %w", err)
	}
	defer countCursor.Close(ctx)

	var countResult []bson.M
	if err := countCursor.All(ctx, &countResult); err != nil {
		return nil, 0, fmt.Errorf("failed to decode count result: %w", err)
	}

	total := 0
	if len(countResult) > 0 {
		if t, ok := countResult[0]["total"].(int32); ok {
			total = int(t)
		} else if t, ok := countResult[0]["total"].(int64); ok {
			total = int(t)
		}
	}

	// Now get the paginated posts
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

		// Stage 3: Extract friend IDs for posts lookup
		{{Key: "$project", Value: bson.M{
			"friendIds": "$friends",
		}}},

		// Stage 4: Lookup posts with visibility filtering
		{{Key: "$lookup", Value: bson.M{
			"from": "posts",
			"let":  bson.M{"friendIds": "$friendIds"},
			"pipeline": mongo.Pipeline{
				// Match posts that are not deleted and meet visibility criteria
				{{Key: "$match", Value: bson.M{
					"$expr": bson.M{
						"$and": []bson.M{
							{"$eq": []interface{}{"$metadata.isDeleted", false}},
							{
								"$or": visibilityConditions,
							},
						},
					},
				}}},
				// Sort by creation date (newest first)
				{{Key: "$sort", Value: bson.M{"metadata.createdAt": -1}}},
				// Add pagination
				{{Key: "$skip", Value: offset}},
				{{Key: "$limit", Value: limit}},
			},
			"as": "visiblePosts",
		}}},

		// Stage 5: Unwind the posts array to get individual posts
		{{Key: "$unwind", Value: "$visiblePosts"}},

		// Stage 6: Replace root with the post document
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
		err = s.sendCommentNotification(post.User.ID, comment.User.DisplayName, comment.Content)
		if err != nil {
			// Log error but don't fail the operation since comment was already created
			slog.Error("Failed to send comment notification", "error", err, "post_owner_id", post.User.ID)
		}

		// Create notification in the database with thumbnail (first image from post if available)
		notificationContent := fmt.Sprintf("%s commented on your post: \"%s\"", comment.User.DisplayName, comment.Content)
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
func (s *Service) sendCommentNotification(postOwnerID primitive.ObjectID, commenterName, commentText string) error {
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

	message := fmt.Sprintf("%s has commented on your post \"%s\"", commenterName, commentText)

	notification := xutils.Notification{
		Token:   postOwner.PushToken,
		Title:   "New Comment!",
		Message: message,
		Data: map[string]string{
			"type":           "comment",
			"commenter_name": commenterName,
			"comment_text":   commentText,
		},
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
