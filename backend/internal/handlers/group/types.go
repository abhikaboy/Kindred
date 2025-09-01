package Group

import (
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/mongo"
)

// Create Group
type CreateGroupInput struct {
	Authorization string            `header:"Authorization" required:"true"`
	Body          CreateGroupParams `json:"body"`
}

type CreateGroupOutput struct {
	Body types.GroupDocumentAPI `json:"body"`
}

type CreateGroupParams struct {
	Name    string   `json:"name" validate:"required,min=1,max=100"`
	Members []string `json:"members,omitempty" validate:"omitempty,dive,len=24"`
}

// Get Groups
type GetGroupsInput struct {
	Authorization string `header:"Authorization" required:"true"`
}

type GetGroupsOutput struct {
	Body struct {
		Groups []types.GroupDocumentAPI `json:"groups"`
	} `json:"body"`
}

// Get Group by ID
type GetGroupInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetGroupOutput struct {
	Body types.GroupDocumentAPI `json:"body"`
}

// Update Group
type UpdateGroupInput struct {
	Authorization string            `header:"Authorization" required:"true"`
	ID            string            `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          UpdateGroupParams `json:"body"`
}

type UpdateGroupOutput struct {
	Body struct {
		Message string `json:"message" example:"Group updated successfully"`
	} `json:"body"`
}

type UpdateGroupParams struct {
	Name *string `json:"name,omitempty" validate:"omitempty,min=1,max=100"`
}

// Delete Group
type DeleteGroupInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type DeleteGroupOutput struct {
	Body struct {
		Message string `json:"message" example:"Group deleted successfully"`
	} `json:"body"`
}

// Add Member to Group
type AddMemberInput struct {
	Authorization string          `header:"Authorization" required:"true"`
	ID            string          `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          AddMemberParams `json:"body"`
}

type AddMemberOutput struct {
	Body struct {
		Message string `json:"message" example:"Member added successfully"`
	} `json:"body"`
}

type AddMemberParams struct {
	UserID string `json:"userId" validate:"required,len=24"`
}

// Remove Member from Group
type RemoveMemberInput struct {
	Authorization string             `header:"Authorization" required:"true"`
	ID            string             `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          RemoveMemberParams `json:"body"`
}

type RemoveMemberOutput struct {
	Body struct {
		Message string `json:"message" example:"Member removed successfully"`
	} `json:"body"`
}

type RemoveMemberParams struct {
	UserID string `json:"userId" validate:"required,len=24"`
}

// Service
type Service struct {
	Groups *mongo.Collection
	Users  *mongo.Collection
}
