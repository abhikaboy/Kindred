package Post

import (
	"encoding/json"

	"github.com/abhikaboy/Kindred/internal/handlers/encouragement"
	"github.com/abhikaboy/Kindred/internal/handlers/notifications"
	"github.com/abhikaboy/Kindred/internal/handlers/rings"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/mongo"
)

// maxTaggedUsers caps tag fanout now that the validate=max guard is gone.
const maxTaggedUsers = 20

// coerceMentions best-effort parses a permissive tagged-user / mention array.
// The field is typed `any` so no validation layer (Huma schema or go-playground)
// can reject it: a non-array value yields nil, and malformed elements are
// dropped. A bad "@" tag can never fail the whole request — bad entries are
// simply stripped (the handler then ObjectID- and friend-gates what's left).
func coerceMentions(v any) []MentionInput {
	if v == nil {
		return nil
	}
	data, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	var raw []json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil // not an array → drop the whole thing
	}
	out := make([]MentionInput, 0, len(raw))
	for _, r := range raw {
		var mi MentionInput
		if err := json.Unmarshal(r, &mi); err == nil {
			out = append(out, mi)
		}
	}
	return out
}

// Create Post
type CreatePostInput struct {
	Authorization string           `header:"Authorization" required:"true"`
	Body          CreatePostParams `json:"body"`
}

type CreatePostOutput struct {
	Body struct {
		types.PostDocumentAPI
		RingDelta *rings.RingDelta `json:"ringDelta,omitempty" doc:"Describes the Share ring increment triggered by this post so the client can render feedback"`
	} `json:"body"`
	UserStats struct {
		PostsMade int `json:"posts_made"`
		Points    int `json:"points"`
	} `json:"user_stats"`
}

type MediaItemInput struct {
	Type         string  `json:"type" validate:"required,oneof=image video"`
	URL          string  `json:"url" validate:"required,url"`
	ThumbnailURL *string `json:"thumbnailUrl,omitempty" validate:"omitempty,url"`
	Width        int     `json:"width"`
	Height       int     `json:"height"`
	DurationMs   *int    `json:"durationMs,omitempty"`
	Bytes        int     `json:"bytes,omitempty"`
}

type CreatePostParams struct {
	Images            []string                         `json:"images" validate:"omitempty,dive,url"`
	Media             []MediaItemInput                 `json:"media,omitempty" validate:"omitempty,max=10,dive"`
	Dual              *string                          `json:"dual,omitempty" validate:"omitempty,url"`
	Caption           string                           `json:"caption" validate:"required"`
	Size              *types.ImageSize                 `json:"size,omitempty"`
	Task              *types.PostTaskExtendedReference `json:"task,omitempty"`
	BlueprintID       *string                          `json:"blueprintId,omitempty"`
	BlueprintIsPublic *bool                            `json:"blueprintIsPublic,omitempty"`
	Groups            []string                         `json:"groups,omitempty" validate:"omitempty,dive,len=24"`
	IsPublic          bool                             `json:"isPublic"`
	// Permissive on purpose: malformed tags (a bare "@", missing fields, wrong
	// types, a non-array) are dropped via coerceMentions instead of failing the
	// post. Shape is [{id, handle}]; the handler ObjectID- and friend-gates.
	TaggedUsers any         `json:"taggedUsers,omitempty" doc:"Tagged user references as [{id, handle}]; malformed entries are dropped, never rejected"`
	Song        *types.Song `json:"song,omitempty"`
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
	Type        string                 `json:"type" doc:"Type of feed item: 'post', 'task', or 'rings_closed'"`
	Post        *types.PostDocumentAPI `json:"post,omitempty" doc:"Post data (only present if type is 'post')"`
	Task        *FeedTaskData          `json:"task,omitempty" doc:"Task data (only present if type is 'task')"`
	RingsClosed *FeedRingsClosedData   `json:"ringsClosed,omitempty" doc:"Rings closed data (only present if type is 'rings_closed')"`
}

type FeedRingsClosedData struct {
	ID        string                       `json:"id"`
	Timestamp string                       `json:"timestamp"`
	Content   string                       `json:"content"`
	User      *types.UserExtendedReference `json:"user" doc:"User who closed their rings"`
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
	Limit         int    `query:"limit" default:"18" minimum:"1" maximum:"50" doc:"Number of posts to return (default: 18)"`
	Offset        int    `query:"offset" default:"0" minimum:"0" doc:"Number of posts to skip (default: 0)"`
}

type GetUserPostsOutput struct {
	Body struct {
		Posts      []types.PostDocumentAPI `json:"posts"`
		Total      int                     `json:"total" doc:"Total number of posts available"`
		HasMore    bool                    `json:"hasMore" doc:"Whether there are more posts to fetch"`
		NextOffset int                     `json:"nextOffset" doc:"Offset for the next page"`
	} `json:"body"`
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
	// Pointer so absent vs. provided is distinguishable; element type is `any`
	// so malformed tags are dropped (coerceMentions), never rejected.
	TaggedUsers *[]any `json:"taggedUsers,omitempty" doc:"Tagged user references as [{id, handle}]; malformed entries are dropped, never rejected"`
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
	Posts                *mongo.Collection
	Users                *mongo.Collection
	Categories           *mongo.Collection
	Blueprints           *mongo.Collection
	Groups               *mongo.Collection
	Connections          *mongo.Collection
	Reports              *mongo.Collection
	NotificationService  *notifications.Service
	RingService          *rings.RingService
	EncouragementService *encouragement.Service
}
