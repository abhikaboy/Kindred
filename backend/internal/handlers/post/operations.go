package Post

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

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

func RegisterGetFriendsPostsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-friends-posts",
		Method:      http.MethodGet,
		Path:        "/v1/user/posts/friends",
		Summary:     "Get friends posts",
		Description: "Retrieve posts from user's friends, ordered chronologically",
		Tags:        []string{"posts"},
	}, handler.GetFriendsPostsHuma)
}

func RegisterGetUserGroupsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-user-groups",
		Method:      http.MethodGet,
		Path:        "/v1/user/posts/groups",
		Summary:     "Get user groups",
		Description: "Retrieve all groups where user is creator or member",
		Tags:        []string{"posts"},
	}, handler.GetUserGroupsHuma)
}

func RegisterGetPostsByBlueprintOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-posts-by-blueprint",
		Method:      http.MethodGet,
		Path:        "/v1/user/posts/blueprint/{blueprintId}",
		Summary:     "Get posts by blueprint",
		Description: "Retrieve all posts associated with a specific blueprint",
		Tags:        []string{"posts"},
	}, handler.GetPostsByBlueprintHuma)
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

func RegisterAddCommentOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "add-comment",
		Method:      http.MethodPost,
		Path:        "/v1/user/posts/{postId}/comment",
		Summary:     "Add comment to post",
		Description: "Add a comment to an existing post",
		Tags:        []string{"posts"},
	}, handler.AddCommentHuma)
}

func RegisterDeleteCommentOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "delete-comment",
		Method:      http.MethodDelete,
		Path:        "/v1/user/posts/{postId}/comment/{commentId}",
		Summary:     "Delete comment from post",
		Description: "Delete comment from an existing post",
		Tags:        []string{"posts"},
	}, handler.DeleteCommentHuma)
}

func RegisterGetUserPosts(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-user-posts",
		Method:      http.MethodGet,
		Path:        "/v1/{userId}/posts",
		Summary:     "Get User's posts",
		Description: "Get posts of a user",
		Tags:        []string{"posts"},
	}, handler.GetUserPostsHuma)
}

func RegisterToggleReaction(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "add-reaction",
		Method:      http.MethodPost,
		Path:        "/v1/user/posts/{postId}/reaction",
		Summary:     "React to a post",
		Description: "Adds a reaction to a post",
		Tags:        []string{"posts"},
	}, handler.ToggleReactionHuma)
}

// Register all post operations
func RegisterPostOperations(api huma.API, handler *Handler) {
	RegisterCreatePostOperation(api, handler)
	RegisterGetPostsOperation(api, handler)
	RegisterGetFriendsPostsOperation(api, handler)
	RegisterGetUserGroupsOperation(api, handler)
	RegisterGetPostsByBlueprintOperation(api, handler)
	RegisterGetPostOperation(api, handler)
	RegisterGetUserPosts(api, handler)
	RegisterUpdatePostOperation(api, handler)
	RegisterDeletePostOperation(api, handler)
	RegisterAddCommentOperation(api, handler)
	RegisterToggleReaction(api, handler)
	RegisterDeleteCommentOperation(api, handler)
}
