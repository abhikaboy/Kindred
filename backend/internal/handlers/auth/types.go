package auth

import (
	"github.com/abhikaboy/SocialToDo/internal/config"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"

	activity "github.com/abhikaboy/SocialToDo/internal/handlers/activity"
	categories "github.com/abhikaboy/SocialToDo/internal/handlers/category"
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

type User struct {
	ID             primitive.ObjectID            `bson:"_id" json:"_id"`
	Email          string                        `bson:"email" json:"email"`
	Phone          string                        `bson:"phone" json:"phone"`
	Password       string                        `bson:"password" json:"password"`
	AppleID        string                        `bson:"apple_id,omitempty" json:"apple_id,omitempty"`
	GoogleID       string                        `bson:"google_id,omitempty" json:"google_id,omitempty"`
	RefreshToken   string                        `bson:"refresh_token" json:"refresh_token"`
	TokenUsed      bool                          `bson:"token_used" json:"token_used"`
	Count          float64                       `bson:"count" json:"count"`
	Categories     []categories.CategoryDocument `bson:"categories" json:"categories"`
	Friends        []primitive.ObjectID          `bson:"friends" json:"friends"`
	TasksComplete  float64                       `bson:"tasks_complete" json:"tasks_complete"`
	RecentActivity []activity.ActivityDocument   `bson:"recent_activity" json:"recent_activity"`

	DisplayName    string `bson:"display_name" json:"display_name"`
	Handle         string `bson:"handle" json:"handle"`
	ProfilePicture string `bson:"profile_picture" json:"profile_picture"`
}

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
