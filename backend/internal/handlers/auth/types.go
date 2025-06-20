package auth

import (
	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/mongo"
)

type Service struct {
	users  *mongo.Collection
	config config.Config
}

func newService(collections map[string]*mongo.Collection, config config.Config) *Service {
	return &Service{collections["users"], config}
}

type Handler struct {
	service *Service
	config  config.Config
}

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	User         string `json:"user"`
}

type User = types.User
type SafeUser = types.SafeUser

type LoginRequest struct {
	Email    string `validate:"required,email" json:"email"`
	Password string `validate:"required,min=8" json:"password"`
}

type LoginRequestApple struct {
	AppleID string `validate:"required" json:"apple_id"`
}

type LoginRequestGoogle struct {
	GoogleID string `validate:"required" json:"google_id"`
}

type RegisterRequestApple struct {
	AppleID string `validate:"required" json:"apple_id"`
	Email   string `validate:"required,email" json:"email"`
}

type RegisterRequestGoogle struct {
	GoogleID string `validate:"required" json:"google_id"`
	Email    string `validate:"required,email" json:"email"`
}

type RegisterRequest struct {
	Email    string `validate:"required,email" json:"email"`
	Password string `validate:"required,min=8" json:"password"`
}

type UpdatePushTokenRequest struct {
	PushToken string `validate:"required" json:"push_token" bson:"push_token"`
}
