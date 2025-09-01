package Group

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Operation registrations

func RegisterCreateGroupOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "create-group",
		Method:      http.MethodPost,
		Path:        "/v1/user/groups",
		Summary:     "Create a new group",
		Description: "Create a new group with the provided details",
		Tags:        []string{"groups"},
	}, handler.CreateGroupHuma)
}

func RegisterGetGroupsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-groups",
		Method:      http.MethodGet,
		Path:        "/v1/user/groups",
		Summary:     "Get all user groups",
		Description: "Retrieve all groups where user is creator or member",
		Tags:        []string{"groups"},
	}, handler.GetGroupsHuma)
}

func RegisterGetGroupOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-group",
		Method:      http.MethodGet,
		Path:        "/v1/user/groups/{id}",
		Summary:     "Get group by ID",
		Description: "Retrieve a specific group by its ID",
		Tags:        []string{"groups"},
	}, handler.GetGroupHuma)
}

func RegisterUpdateGroupOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-group",
		Method:      http.MethodPatch,
		Path:        "/v1/user/groups/{id}",
		Summary:     "Update group",
		Description: "Update an existing group (creator only)",
		Tags:        []string{"groups"},
	}, handler.UpdateGroupHuma)
}

func RegisterDeleteGroupOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "delete-group",
		Method:      http.MethodDelete,
		Path:        "/v1/user/groups/{id}",
		Summary:     "Delete group",
		Description: "Delete an existing group (creator only)",
		Tags:        []string{"groups"},
	}, handler.DeleteGroupHuma)
}

func RegisterAddMemberOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "add-group-member",
		Method:      http.MethodPost,
		Path:        "/v1/user/groups/{id}/members",
		Summary:     "Add member to group",
		Description: "Add a member to an existing group (creator only)",
		Tags:        []string{"groups"},
	}, handler.AddMemberHuma)
}

func RegisterRemoveMemberOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "remove-group-member",
		Method:      http.MethodDelete,
		Path:        "/v1/user/groups/{id}/members",
		Summary:     "Remove member from group",
		Description: "Remove a member from an existing group (creator only or self)",
		Tags:        []string{"groups"},
	}, handler.RemoveMemberHuma)
}

// Register all group operations
func RegisterGroupOperations(api huma.API, handler *Handler) {
	RegisterCreateGroupOperation(api, handler)
	RegisterGetGroupsOperation(api, handler)
	RegisterGetGroupOperation(api, handler)
	RegisterUpdateGroupOperation(api, handler)
	RegisterDeleteGroupOperation(api, handler)
	RegisterAddMemberOperation(api, handler)
	RegisterRemoveMemberOperation(api, handler)
}
