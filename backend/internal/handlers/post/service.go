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
)

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Posts:               collections["posts"],
		Users:               collections["users"],
		Blueprints:          collections["blueprints"],
		Categories:          collections["categories"],
		NotificationService: notifications.NewNotificationService(collections),
	}
}

// GetAllPosts fetches all Post documents from MongoDB
func (s *Service) GetAllPosts() ([]types.PostDocument, error) {
	ctx := context.Background()

	filter := bson.M{
		"metadata.isDeleted": false,
		"metadata.isPublic":  true,
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
func (s *Service) CreatePost(r *types.PostDocument) (*types.PostDocument, error) {
	ctx := context.Background()

	// Insert the document into the collection

	result, err := s.Posts.InsertOne(ctx, r)
	if err != nil {
		return nil, err
	}

	// Cast the inserted ID to ObjectID
	id := result.InsertedID.(primitive.ObjectID)
	r.ID = id
	return r, nil
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
		"user._id":           userID.Hex(),
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

		// Create notification in the database
		notificationContent := fmt.Sprintf("%s commented on your post: \"%s\"", comment.User.DisplayName, comment.Content)
		err = s.NotificationService.CreateNotification(post.User.ID, notificationContent, notifications.NotificationTypeComment, comment.ID)
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
