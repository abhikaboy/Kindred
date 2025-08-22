package Post

import (
	"context"
	"fmt"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Posts:      collections["posts"],
		Users:      collections["users"],
		Blueprints: collections["blueprints"],
		Categories: collections["categories"],
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

	_, err := s.Posts.UpdateOne(ctx, filter, update)
	return err
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
