package Post

import (
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/mongo"
)

// Create Post
type CreatePostInput struct {
	Authorization string           `header:"Authorization" required:"true"`
	Body          CreatePostParams `json:"body"`
}

type CreatePostOutput struct {
	Body types.PostDocumentAPI `json:"body"`
}

type CreatePostParams struct {
	Images      []string                         `json:"images" validate:"omitempty,dive,url"`
	Caption     string                           `json:"caption" validate:"required"`
	Task        *types.PostTaskExtendedReference `json:"task,omitempty"`
	BlueprintID *string                          `json:"blueprintId,omitempty"`
	IsPublic    bool                             `json:"isPublic"`
}

// Get Posts (all)
type GetPostsInput struct {
	Authorization string `header:"Authorization" required:"true"`
}

type GetPostsOutput struct {
	Body []types.PostDocumentAPI `json:"body"`
}

// Get Post by ID
type GetPostInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetPostOutput struct {
	Body types.PostDocument `json:"body"`
}

// Get User's posts
type GetUserPostsInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetUserPostsOutput struct {
	Body []types.PostDocument `json:"body"`
}

// Update Post
type UpdatePostInput struct {
	Authorization string           `header:"Authorization" required:"true"`
	ID            string           `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          UpdatePostParams `json:"body"`
}

type UpdatePostOutput struct {
	Body struct {
		Message string `json:"message" example:"Post updated successfully"`
	}
}

type UpdatePostParams struct {
	Caption  *string `json:"caption,omitempty"`
	IsPublic *bool   `json:"isPublic,omitempty"`
}

// Delete Post
type DeletePostInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type DeletePostOutput struct {
	Body struct {
		Message string `json:"message" example:"Post deleted successfully"`
	}
}

// Add comment to post
type AddCommentInput struct {
	Authorization string           `header:"Authorization" required:"true"`
	PostID        string           `path:"postId" example:"507f1f77bcf86cd799439011"`
	Body          AddCommentParams `json:"body"`
}

type AddCommentParams struct {
	Content  string  `json:"content" validate:"required,min=1"`
	ParentID *string `json:"parentId,omitempty"`
}

type AddCommentOutput struct {
	Body struct {
		Message string                `json:"message" example:"Comment added successfully"`
		Comment types.CommentDocument `json:"comment"`
	} `json:"body"`
}

type AddReactionInput struct {
	Authorization string            `header:"Authorization" required:"true"`
	PostID        string            `path:"postId" example:"507f1f77bcf86cd799439011"`
	Body          AddReactionParams `json:"body"`
}

type AddReactionParams struct {
	Emoji string `json:"emoji" validate:"required"`
}

type AddReactionOutput struct {
	Body struct {
		Message string `json:"message"`
	}
}

type Enumeration string

const (
	Option1 Enumeration = "Option1"
	Option2 Enumeration = "Option2"
	Option3 Enumeration = "Option3"
)

/*
Post Service to be used by Post Handler to interact with the
Database layer of the application
*/

type Service struct {
	Posts      *mongo.Collection
	Users      *mongo.Collection
	Categories *mongo.Collection
	Blueprints *mongo.Collection
}
