package Group

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type Handler struct {
	service *Service
}

func NewHandler(collections map[string]*mongo.Collection) *Handler {
	return &Handler{
		service: newService(collections),
	}
}

func (h *Handler) CreateGroupHuma(ctx context.Context, input *CreateGroupInput) (*CreateGroupOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Please check your group details", fmt.Errorf("validation errors: %v", errs))
	}

	// Extract user_id from context (set by auth middleware)
	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	// Convert string to ObjectID
	userObjID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	// Create group document
	group := types.GroupDocument{
		ID:       primitive.NewObjectID(),
		Name:     input.Body.Name,
		Creator:  userObjID,
		Members:  []types.UserExtendedReferenceInternal{},
		Metadata: types.NewGroupMetadata(),
	}

	// Add initial members if provided
	if len(input.Body.Members) > 0 {
		for _, memberIDStr := range input.Body.Members {
			memberID, err := primitive.ObjectIDFromHex(memberIDStr)
			if err != nil {
				return nil, huma.Error400BadRequest("Invalid member ID format", err)
			}

			// Get user info
			var user types.User
			err = h.service.Users.FindOne(context.Background(), bson.M{"_id": memberID}).Decode(&user)
			if err != nil {
				return nil, huma.Error404NotFound("Member not found", err)
			}

			// Add to members array
			userRef := types.UserExtendedReferenceInternal{
				ID:             user.ID,
				DisplayName:    user.DisplayName,
				Handle:         user.Handle,
				ProfilePicture: user.ProfilePicture,
			}
			group.Members = append(group.Members, userRef)
		}
	}

	createdGroup, err := h.service.CreateGroup(&group)
	if err != nil {
		slog.Error("Failed to create group", "userId", userObjID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to create group due to a database error. Please try again.", err)
	}

	return &CreateGroupOutput{Body: *createdGroup.ToAPI()}, nil
}

func (h *Handler) GetGroupsHuma(ctx context.Context, input *GetGroupsInput) (*GetGroupsOutput, error) {
	// Extract user_id from context for authorization
	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	groups, err := h.service.GetAllGroups(userID)
	if err != nil {
		slog.Error("Failed to fetch groups", "userId", userID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to load your groups. Please try again.", err)
	}

	var apiGroups []types.GroupDocumentAPI
	for _, group := range groups {
		apiGroups = append(apiGroups, *group.ToAPI())
	}

	output := &GetGroupsOutput{}
	output.Body.Groups = apiGroups

	return output, nil
}

func (h *Handler) GetGroupHuma(ctx context.Context, input *GetGroupInput) (*GetGroupOutput, error) {
	// Extract user_id from context for authorization
	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid group ID format", err)
	}

	group, err := h.service.GetGroupByID(id)
	if err != nil {
		return nil, huma.Error404NotFound("Group not found", err)
	}

	// Check if user has access to this group
	hasAccess, err := h.service.IsUserInGroup(id, userID)
	if err != nil {
		slog.Error("Failed to check group membership", "groupId", id.Hex(), "userId", userID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to verify group access. Please try again.", err)
	}

	if !hasAccess {
		return nil, huma.Error403Forbidden("You do not have access to this group", fmt.Errorf("user not in group"))
	}

	return &GetGroupOutput{Body: *group.ToAPI()}, nil
}

func (h *Handler) UpdateGroupHuma(ctx context.Context, input *UpdateGroupInput) (*UpdateGroupOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Please check your group details", fmt.Errorf("validation errors: %v", errs))
	}

	// Extract user_id from context for authorization
	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid group ID format", err)
	}

	err = h.service.UpdateGroup(id, input.Body, userID)
	if err != nil {
		slog.Error("Failed to update group", "groupId", id.Hex(), "userId", userID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to update group. Please try again.", err)
	}

	return &UpdateGroupOutput{
		Body: struct {
			Message string `json:"message" example:"Group updated successfully"`
		}{Message: "Group updated successfully"},
	}, nil
}

func (h *Handler) DeleteGroupHuma(ctx context.Context, input *DeleteGroupInput) (*DeleteGroupOutput, error) {
	// Extract user_id from context for authorization
	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid group ID format", err)
	}

	err = h.service.DeleteGroup(id, userID)
	if err != nil {
		slog.Error("Failed to delete group", "groupId", id.Hex(), "userId", userID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to delete group. You may not have permission or the group may not exist.", err)
	}

	return &DeleteGroupOutput{
		Body: struct {
			Message string `json:"message" example:"Group deleted successfully"`
		}{Message: "Group deleted successfully"},
	}, nil
}

func (h *Handler) AddMemberHuma(ctx context.Context, input *AddMemberInput) (*AddMemberOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Please check your group details", fmt.Errorf("validation errors: %v", errs))
	}

	// Extract user_id from context for authorization
	requesterIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	requesterID, err := primitive.ObjectIDFromHex(requesterIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid requester ID format", err)
	}

	groupID, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid group ID format", err)
	}

	userID, err := primitive.ObjectIDFromHex(input.Body.UserID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	err = h.service.AddMember(groupID, userID, requesterID)
	if err != nil {
		slog.Error("Failed to add member to group", "groupId", groupID.Hex(), "memberId", userID.Hex(), "requesterId", requesterID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to add member to group. The user may already be a member or you may not have permission.", err)
	}

	return &AddMemberOutput{
		Body: struct {
			Message string `json:"message" example:"Member added successfully"`
		}{Message: "Member added successfully"},
	}, nil
}

func (h *Handler) RemoveMemberHuma(ctx context.Context, input *RemoveMemberInput) (*RemoveMemberOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Please check your group details", fmt.Errorf("validation errors: %v", errs))
	}

	// Extract user_id from context for authorization
	requesterIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	requesterID, err := primitive.ObjectIDFromHex(requesterIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid requester ID format", err)
	}

	groupID, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid group ID format", err)
	}

	userID, err := primitive.ObjectIDFromHex(input.Body.UserID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	err = h.service.RemoveMember(groupID, userID, requesterID)
	if err != nil {
		slog.Error("Failed to remove member from group", "groupId", groupID.Hex(), "memberId", userID.Hex(), "requesterId", requesterID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to remove member from group. You may not have permission.", err)
	}

	return &RemoveMemberOutput{
		Body: struct {
			Message string `json:"message" example:"Member removed successfully"`
		}{Message: "Member removed successfully"},
	}, nil
}
