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

// GetFriendsPosts fetches posts from the user's friends using aggregation pipeline, ordered chronologically (newest first) with pagination
func (s *Service) GetFriendsPosts(userID primitive.ObjectID, limit, offset int) ([]types.PostDocument, int, error) {
	ctx := context.Background()

	// Set default limit if not provided
	if limit <= 0 {
		limit = 8
	}

	// First, get the total count of friends' posts
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

		// Stage 4: Lookup posts from friends
		{{Key: "$lookup", Value: bson.M{
			"from": "posts",
			"let":  bson.M{"friendIds": "$friendIds"},
			"pipeline": mongo.Pipeline{
				// Match posts from friends that are public and not deleted
				{{Key: "$match", Value: bson.M{
					"$expr": bson.M{
						"$and": []bson.M{
							{"$in": []interface{}{
								bson.M{"$toObjectId": "$user._id"},
								"$$friendIds",
							}},
							{"$eq": []interface{}{"$metadata.isDeleted", false}},
							{"$eq": []interface{}{"$metadata.isPublic", true}},
						},
					},
				}}},
			},
			"as": "friendsPosts",
		}}},

		// Stage 5: Count the posts
		{{Key: "$project", Value: bson.M{
			"total": bson.M{"$size": "$friendsPosts"},
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

		// Stage 4: Lookup posts from friends
		{{Key: "$lookup", Value: bson.M{
			"from": "posts",
			"let":  bson.M{"friendIds": "$friendIds"},
			"pipeline": mongo.Pipeline{
				// Match posts from friends that are public and not deleted
				{{Key: "$match", Value: bson.M{
					"$expr": bson.M{
						"$and": []bson.M{
							{"$in": []interface{}{
								bson.M{"$toObjectId": "$user._id"},
								"$$friendIds",
							}},
							{"$eq": []interface{}{"$metadata.isDeleted", false}},
							{"$eq": []interface{}{"$metadata.isPublic", true}},
						},
					},
				}}},
				// Sort by creation date (newest first)
				{{Key: "$sort", Value: bson.M{"metadata.createdAt": -1}}},
				// Add pagination
				{{Key: "$skip", Value: offset}},
				{{Key: "$limit", Value: limit}},
			},
			"as": "friendsPosts",
		}}},

		// Stage 5: Unwind the posts array to get individual posts
		{{Key: "$unwind", Value: "$friendsPosts"}},

		// Stage 6: Replace root with the post document
		{{Key: "$replaceRoot", Value: bson.M{
			"newRoot": "$friendsPosts",
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
