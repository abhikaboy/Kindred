package Post

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Input/Output types for post operations

// Create Post
type CreatePostInput struct {
	Authorization string           `header:"Authorization" required:"true"`
	Body          CreatePostParams `json:"body"`
}

type CreatePostOutput struct {
	Body PostDocument `json:"body"`
}

// Get Posts (all)
type GetPostsInput struct {
	Authorization string `header:"Authorization" required:"true"`
}

type GetPostsOutput struct {
	Body []PostDocument `json:"body"`
}

// Get Post by ID
type GetPostInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetPostOutput struct {
	Body PostDocument `json:"body"`
}

// Update Post
type UpdatePostInput struct {
	Authorization string             `header:"Authorization" required:"true"`
	ID            string             `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          UpdatePostDocument `json:"body"`
}

type UpdatePostOutput struct {
	Body struct {
		Message string `json:"message" example:"Post updated successfully"`
	}
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

// Operation registrations

func RegisterCreatePostOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "create-post",
		Method:      http.MethodPost,
		Path:        "/v1/user/posts",
		Summary:     "Create a new post",
		Description: "Create a new post with the provided details",
		Tags:        []string{"posts"},
	}, handler.CreatePostHuma)
}

func RegisterGetPostsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-posts",
		Method:      http.MethodGet,
		Path:        "/v1/user/posts",
		Summary:     "Get all posts",
		Description: "Retrieve all posts",
		Tags:        []string{"posts"},
	}, handler.GetPostsHuma)
}

func RegisterGetPostOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-post",
		Method:      http.MethodGet,
		Path:        "/v1/user/posts/{id}",
		Summary:     "Get post by ID",
		Description: "Retrieve a specific post by its ID",
		Tags:        []string{"posts"},
	}, handler.GetPostHuma)
}

func RegisterUpdatePostOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-post",
		Method:      http.MethodPatch,
		Path:        "/v1/user/posts/{id}",
		Summary:     "Update post",
		Description: "Update an existing post",
		Tags:        []string{"posts"},
	}, handler.UpdatePostHuma)
}

func RegisterDeletePostOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "delete-post",
		Method:      http.MethodDelete,
		Path:        "/v1/user/posts/{id}",
		Summary:     "Delete post",
		Description: "Delete an existing post",
		Tags:        []string{"posts"},
	}, handler.DeletePostHuma)
}

// Register all post operations
func RegisterPostOperations(api huma.API, handler *Handler) {
	RegisterCreatePostOperation(api, handler)
	RegisterGetPostsOperation(api, handler)
	RegisterGetPostOperation(api, handler)
	RegisterUpdatePostOperation(api, handler)
	RegisterDeletePostOperation(api, handler)
}
