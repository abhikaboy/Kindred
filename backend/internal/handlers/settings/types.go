package settings

import (
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/mongo"
)

// Get User Settings
type GetUserSettingsInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
}

type GetUserSettingsOutput struct {
	Body types.UserSettings `json:"body"`
}

// Update User Settings
type UpdateUserSettingsInput struct {
	Authorization string             `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	Body          types.UserSettings `json:"body"`
}

type UpdateUserSettingsOutput struct {
	Body struct {
		Message string `json:"message" example:"Settings updated successfully"`
	} `json:"body"`
}

// Service holds the MongoDB collections for settings operations
type Service struct {
	Users *mongo.Collection
}

// Handler holds the service for Huma operations
type Handler struct {
	service *Service
}
