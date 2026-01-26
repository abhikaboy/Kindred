package Post

import (
	"github.com/abhikaboy/Kindred/internal/handlers/notifications"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/mongo"
)

// Create Post
type CreatePostInput struct {
	Authorization string           `header:"Authorization" required:"true"`
	Body          CreatePostParams `json:"body"`
}

type CreatePostOutput struct {
	Body      types.PostDocumentAPI `json:"body"`
	UserStats struct {
		PostsMade int `json:"posts_made"`
		Points    int `json:"points"`
	} `json:"user_stats"`
}

type CreatePostParams struct {
	Images            []string                         `json:"images" validate:"omitempty,dive,url"`
	Dual              *string                          `json:"dual,omitempty" validate:"omitempty,url"`
	Caption           string                           `json:"caption" validate:"required"`
	Size              *types.ImageSize                 `json:"size,omitempty"`
	Task              *types.PostTaskExtendedReference `json:"task,omitempty"`
	BlueprintID       *string                          `json:"blueprintId,omitempty"`
	BlueprintIsPublic *bool                            `json:"blueprintIsPublic,omitempty"`
	Groups            []string                         `json:"groups,omitempty" validate:"omitempty,dive,len=24"`
	IsPublic          bool                             `json:"isPublic"`
}

// Get Posts (all)
type GetPostsInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Limit         int    `query:"limit" default:"8" minimum:"1" maximum:"50" doc:"Number of posts to return (default: 8)"`
	Offset        int    `query:"offset" default:"0" minimum:"0" doc:"Number of posts to skip (default: 0)"`
}

type GetPostsOutput struct {
	Body struct {
		Posts      []types.PostDocumentAPI `json:"posts"`
		Total      int                     `json:"total" doc:"Total number of posts available"`
		HasMore    bool                    `json:"hasMore" doc:"Whether there are more posts to fetch"`
		NextOffset int                     `json:"nextOffset" doc:"Offset for the next page"`
	} `json:"body"`
}

// Get Friends Posts
type GetFriendsPostsInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Limit         int    `query:"limit" default:"8" minimum:"1" maximum:"50" doc:"Number of posts to return (default: 8)"`
	Offset        int    `query:"offset" default:"0" minimum:"0" doc:"Number of posts to skip (default: 0)"`
}

type GetFriendsPostsOutput struct {
	Body struct {
		Posts      []types.PostDocumentAPI `json:"posts"`
		Total      int                     `json:"total" doc:"Total number of posts available"`
		HasMore    bool                    `json:"hasMore" doc:"Whether there are more posts to fetch"`
		NextOffset int                     `json:"nextOffset" doc:"Offset for the next page"`
	} `json:"body"`
}

// Get Feed (unified feed endpoint for posts and activities)
type GetFeedInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Limit         int    `query:"limit" default:"20" minimum:"1" maximum:"50" doc:"Number of feed items to return (default: 20)"`
	Offset        int    `query:"offset" default:"0" minimum:"0" doc:"Number of feed items to skip (default: 0)"`
}

type FeedItem struct {
	Type string                 `json:"type" doc:"Type of feed item: 'post' or 'task'"`
	Post *types.PostDocumentAPI `json:"post,omitempty" doc:"Post data (only present if type is 'post')"`
	Task *FeedTaskData          `json:"task,omitempty" doc:"Task data (only present if type is 'task')"`
}

type FeedTaskData struct {
	ID            string                       `json:"id"`
	Content       string                       `json:"content"`
	Priority      int                          `json:"priority"`
	Value         float64                      `json:"value"`
	Public        bool                         `json:"public"`
	Timestamp     string                       `json:"timestamp"`
	CategoryID    string                       `json:"categoryId"`
	CategoryName  string                       `json:"categoryName"`
	WorkspaceName string                       `json:"workspaceName"`
	User          *types.UserExtendedReference `json:"user" doc:"User who created the task"`
}

type GetFeedOutput struct {
	Body struct {
		Items      []FeedItem `json:"items" doc:"Mixed feed items containing posts and tasks"`
		Total      int        `json:"total" doc:"Total number of feed items available"`
		HasMore    bool       `json:"hasMore" doc:"Whether there are more feed items to fetch"`
		NextOffset int        `json:"nextOffset" doc:"Offset for the next page"`
	} `json:"body"`
}

// Get Post by ID
type GetPostInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetPostOutput struct {
	Body types.PostDocumentAPI `json:"body"`
}

// Get User's posts
type GetUserPostsInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"userId" example:"507f1f77bcf86cd799439011"`
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
	Caption  *string          `json:"caption,omitempty"`
	IsPublic *bool            `json:"isPublic,omitempty"`
	Size     *types.ImageSize `json:"size,omitempty"`
}

// Get User Groups (for posts)
type GetUserGroupsInput struct {
	Authorization string `header:"Authorization" required:"true"`
}

type GetUserGroupsOutput struct {
	Body struct {
		Groups []types.GroupDocumentAPI `json:"groups"`
	} `json:"body"`
}

// Get Posts by Blueprint
type GetPostsByBlueprintInput struct {
	Authorization string `header:"Authorization" required:"true"`
	BlueprintID   string `path:"blueprintId" example:"507f1f77bcf86cd799439011"`
}

type GetPostsByBlueprintOutput struct {
	Body struct {
		Posts []types.PostDocumentAPI `json:"posts"`
	} `json:"body"`
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
	Content  string         `json:"content" validate:"required,min=1"`
	ParentID *string        `json:"parentId,omitempty"`
	Mentions []MentionInput `json:"mentions,omitempty"`
}

type MentionInput struct {
	ID     string `json:"id" validate:"required"`
	Handle string `json:"handle" validate:"required"`
}

type AddCommentOutput struct {
	Body struct {
		Message string                   `json:"message" example:"Comment added successfully"`
		Comment types.CommentDocumentAPI `json:"comment"`
	} `json:"body"`
}

type DeleteCommentInput struct {
	Authorization string `header:"Authorization" required:"true"`
	PostID        string `path:"postId" doc:"Post ID"`
	CommentID     string `path:"commentId" doc:"Comment ID"`
}

type DeleteCommentOutput struct {
	Body struct {
		Message string `json:"message"`
	}
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
		Message string `json:"message" example:"Reaction added successfully"`
		Added   bool   `json:"added" example:"true"`
	} `json:"body"`
}

/*
Post Service to be used by Post Handler to interact with the
Database layer of the application
*/

type Service struct {
	Posts               *mongo.Collection
	Users               *mongo.Collection
	Categories          *mongo.Collection
	Blueprints          *mongo.Collection
	Groups              *mongo.Collection
	Connections         *mongo.Collection
	NotificationService *notifications.Service
}
