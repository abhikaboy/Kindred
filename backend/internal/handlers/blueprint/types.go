package Blueprint

import (
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// Input/Output types for blueprint operations

// Create Blueprint
type CreateBlueprintInput struct {
	Authorization string                `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string                `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	Body          CreateBlueprintParams `json:"body"`
}

type CreateBlueprintOutput struct {
	Body BlueprintDocument `json:"body"`
}

// Get Blueprints (all)
type GetBlueprintsInput struct{}

type GetBlueprintsOutput struct {
	Body []BlueprintDocument `json:"body"`
}

// Get Blueprint by ID
type GetBlueprintInput struct {
	ID string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetBlueprintOutput struct {
	Body BlueprintDocument `json:"body"`
}

// Update Blueprint
type UpdateBlueprintInput struct {
	Authorization string                  `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string                  `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string                  `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          UpdateBlueprintDocument `json:"body"`
}

type UpdateBlueprintOutput struct {
	Body struct {
		Message string `json:"message" example:"Blueprint updated successfully"`
	}
}

// Delete Blueprint
type DeleteBlueprintInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type DeleteBlueprintOutput struct {
	Body struct {
		Message string `json:"message" example:"Blueprint deleted successfully"`
	}
}

// Subscribe to Blueprint
type SubscribeToBlueprintInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type SubscribeToBlueprintOutput struct {
	Body struct {
		Message string `json:"message" example:"Subscribed to blueprint successfully"`
	}
}

// Unsubscribe from Blueprint
type UnsubscribeFromBlueprintInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type UnsubscribeFromBlueprintOutput struct {
	Body struct {
		Message string `json:"message" example:"Unsubscribed from blueprint successfully"`
	}
}

type SearchBlueprintsInput struct {
	Query string `query:"query" example:"morning routine"`
}

type SearchBlueprintsOutput struct {
	Body []BlueprintDocument `json:"body"`
}

type AutocompleteBlueprintsInput struct {
	Query string `query:"query" example:"morn" minLength:"2"`
}

type AutocompleteBlueprintsOutput struct {
	Body []BlueprintDocument `json:"body"`
}

// Get User Subscribed Blueprints
type GetUserSubscribedBlueprintsInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
}

type GetUserSubscribedBlueprintsOutput struct {
	Body []BlueprintDocumentWithoutSubscribers `json:"body"`
}

// Get Blueprints By Category
type GetBlueprintByCategoryInput struct{}

type BlueprintCategoryGroup struct {
	Category   string              `bson:"_id" json:"category" example:"productivity" doc:"Category name (maps from aggregation _id)"`
	Blueprints []BlueprintDocument `bson:"blueprints" json:"blueprints" doc:"List of blueprints in this category"`
	Count      int64               `bson:"count" json:"count" example:"5" doc:"Number of blueprints in this category"`
}

type GetBlueprintByCategoryOutput struct {
	Body []BlueprintCategoryGroup `json:"body"`
}

// Get Blueprints by Creator
type GetBlueprintsByCreatorInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	CreatorID     string `path:"creatorId" example:"507f1f77bcf86cd799439011"`
}

type GetBlueprintsByCreatorOutput struct {
	Body []BlueprintDocumentWithoutSubscribers `json:"body"`
}

// Generate and Create Blueprint with AI
type GenerateAndCreateBlueprintInput struct {
	Authorization string                           `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string                           `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	Body          GenerateAndCreateBlueprintParams `json:"body"`
}

type GenerateAndCreateBlueprintParams struct {
	Description string `json:"description" example:"Morning routine for productivity" doc:"Description of what the blueprint should contain"`
}

type GenerateAndCreateBlueprintOutput struct {
	Body BlueprintDocument `json:"body"`
}

type CreateBlueprintParams struct {
	Banner      string                   `bson:"banner" json:"banner" example:"https://example.com/banner.jpg" doc:"Banner image URL for the blueprint"`
	Name        string                   `bson:"name" json:"name" example:"Morning Routine" doc:"Name of the blueprint"`
	Tags        []string                 `bson:"tags" json:"tags" example:"[\"productivity\",\"morning\"]" doc:"Tags associated with the blueprint"`
	Description string                   `bson:"description" json:"description" example:"A comprehensive morning routine to start your day right" doc:"Description of the blueprint"`
	Duration    string                   `bson:"duration" json:"duration" example:"30m" doc:"Expected duration to complete the blueprint"`
	Category    string                   `bson:"category" json:"category" example:"productivity" doc:"Category of the blueprint"`
	Categories  []types.CategoryDocument `bson:"categories" json:"categories" example:"[{\"id\":\"507f1f77bcf86cd799439011\",\"name\":\"Productivity\",\"workspaceName\":\"Personal\",\"lastEdited\":\"2023-01-01T00:00:00Z\",\"user\":\"507f1f77bcf86cd799439012\"}]" doc:"Categories associated with the blueprint"`
}

type BlueprintDocument struct {
	ID               string                       `bson:"_id,omitempty" json:"id" example:"507f1f77bcf86cd799439011" doc:"Unique identifier for the blueprint"`
	Banner           string                       `bson:"banner" json:"banner" example:"https://example.com/banner.jpg" doc:"Banner image URL"`
	Name             string                       `bson:"name" json:"name" example:"Morning Routine" doc:"Name of the blueprint"`
	Tags             []string                     `bson:"tags" json:"tags" example:"[\"productivity\",\"morning\"]" doc:"Tags associated with the blueprint"`
	Description      string                       `bson:"description" json:"description" example:"A comprehensive morning routine" doc:"Description of the blueprint"`
	Duration         string                       `bson:"duration" json:"duration" example:"30m" doc:"Expected duration"`
	Subscribers      []string                     `bson:"subscribers" json:"subscribers" example:"[\"507f1f77bcf86cd799439012\"]" doc:"List of subscriber user IDs"`
	Owner            *types.UserExtendedReference `bson:"owner" json:"owner" doc:"Owner information"`
	SubscribersCount int64                        `bson:"subscribersCount" json:"subscribersCount" example:"42" doc:"Number of subscribers"`
	Timestamp        time.Time                    `bson:"timestamp" json:"timestamp" example:"2023-01-01T00:00:00Z" doc:"Creation timestamp"`
	Categories       []types.CategoryDocument     `bson:"categories" json:"categories" example:"[{\"id\":\"507f1f77bcf86cd799439011\",\"name\":\"Productivity\",\"workspaceName\":\"Personal\",\"lastEdited\":\"2023-01-01T00:00:00Z\",\"user\":\"507f1f77bcf86cd799439012\"}]" doc:"Categories associated with the blueprint"`
	Category         string                       `bson:"category" json:"category" example:"productivity" doc:"Category of the blueprint"`
}

// BlueprintDocumentWithoutSubscribers is the same as BlueprintDocument but without the Subscribers field
type BlueprintDocumentWithoutSubscribers struct {
	ID               string                       `bson:"_id,omitempty" json:"id" example:"507f1f77bcf86cd799439011" doc:"Unique identifier for the blueprint"`
	Banner           string                       `bson:"banner" json:"banner" example:"https://example.com/banner.jpg" doc:"Banner image URL"`
	Name             string                       `bson:"name" json:"name" example:"Morning Routine" doc:"Name of the blueprint"`
	Tags             []string                     `bson:"tags" json:"tags" example:"[\"productivity\",\"morning\"]" doc:"Tags associated with the blueprint"`
	Description      string                       `bson:"description" json:"description" example:"A comprehensive morning routine" doc:"Description of the blueprint"`
	Duration         string                       `bson:"duration" json:"duration" example:"30m" doc:"Expected duration"`
	Owner            *types.UserExtendedReference `bson:"owner" json:"owner" doc:"Owner information"`
	SubscribersCount int64                        `bson:"subscribersCount" json:"subscribersCount" example:"42" doc:"Number of subscribers"`
	Timestamp        time.Time                    `bson:"timestamp" json:"timestamp" example:"2023-01-01T00:00:00Z" doc:"Creation timestamp"`
	Category         string                       `bson:"category" json:"category" example:"productivity" doc:"Category of the blueprint"`
	Categories       []types.CategoryDocument     `bson:"categories" json:"categories" example:"[{\"id\":\"507f1f77bcf86cd799439011\",\"name\":\"Productivity\"}]" doc:"Categories associated with the blueprint"`
}

// Internal struct for MongoDB operations (keeps primitive.ObjectID)
type BlueprintDocumentInternal struct {
	ID               primitive.ObjectID                   `bson:"_id,omitempty"`
	Banner           string                               `bson:"banner"`
	Name             string                               `bson:"name"`
	Tags             []string                             `bson:"tags"`
	Description      string                               `bson:"description"`
	Duration         string                               `bson:"duration"`
	Subscribers      []primitive.ObjectID                 `bson:"subscribers"`
	Owner            *types.UserExtendedReferenceInternal `bson:"owner"`
	SubscribersCount int64                                `bson:"subscribersCount"`
	Timestamp        time.Time                            `bson:"timestamp"`
	Category         string                               `bson:"category"`
	Categories       []types.CategoryDocument             `bson:"categories"`
}

type UpdateBlueprintDocument struct {
	Banner      *string                   `bson:"banner,omitempty" json:"banner,omitempty" example:"https://example.com/new-banner.jpg" doc:"New banner image URL"`
	Name        *string                   `bson:"name,omitempty" json:"name,omitempty" example:"Updated Morning Routine" doc:"New name for the blueprint"`
	Tags        *[]string                 `bson:"tags,omitempty" json:"tags,omitempty" example:"[\"productivity\",\"morning\",\"health\"]" doc:"Updated tags"`
	Description *string                   `bson:"description,omitempty" json:"description,omitempty" example:"An updated comprehensive morning routine" doc:"New description"`
	Duration    *string                   `bson:"duration,omitempty" json:"duration,omitempty" example:"45m" doc:"Updated expected duration"`
	Category    *string                   `bson:"category,omitempty" json:"category,omitempty" example:"productivity" doc:"Updated category of the blueprint"`
	Categories  *[]types.CategoryDocument `bson:"categories,omitempty" json:"categories,omitempty" example:"[{\"id\":\"507f1f77bcf86cd799439011\",\"name\":\"Productivity\",\"workspaceName\":\"Personal\",\"lastEdited\":\"2023-01-01T00:00:00Z\",\"user\":\"507f1f77bcf86cd799439012\"}]" doc:"Updated categories associated with the blueprint"`
	Subscribers *[]string                 `bson:"subscribers,omitempty" json:"subscribers,omitempty" example:"[\"507f1f77bcf86cd799439012\"]" doc:"Updated subscriber list"`
	Timestamp   *time.Time                `bson:"timestamp,omitempty" json:"timestamp,omitempty" example:"2023-01-02T00:00:00Z" doc:"Update timestamp"`
}

// Helper functions to convert between internal and API types
func (b *BlueprintDocumentInternal) ToAPI() *BlueprintDocument {
	subscribers := make([]string, len(b.Subscribers))
	for i, sub := range b.Subscribers {
		subscribers[i] = sub.Hex()
	}

	var owner *types.UserExtendedReference
	if b.Owner != nil {
		owner = b.Owner.ToAPI()
	}

	return &BlueprintDocument{
		ID:               b.ID.Hex(),
		Banner:           b.Banner,
		Name:             b.Name,
		Tags:             b.Tags,
		Description:      b.Description,
		Duration:         b.Duration,
		Subscribers:      subscribers,
		Owner:            owner,
		SubscribersCount: b.SubscribersCount,
		Timestamp:        b.Timestamp,
		Category:         b.Category,
		Categories:       b.Categories,
	}
}

// ToAPIWithoutSubscribers converts to API format but omits the subscribers field
func (b *BlueprintDocumentInternal) ToAPIWithoutSubscribers() *BlueprintDocumentWithoutSubscribers {
	var owner *types.UserExtendedReference
	if b.Owner != nil {
		owner = b.Owner.ToAPI()
	}

	return &BlueprintDocumentWithoutSubscribers{
		ID:               b.ID.Hex(),
		Banner:           b.Banner,
		Name:             b.Name,
		Tags:             b.Tags,
		Description:      b.Description,
		Duration:         b.Duration,
		Owner:            owner,
		SubscribersCount: b.SubscribersCount,
		Timestamp:        b.Timestamp,
		Category:         b.Category,
		Categories:       b.Categories,
	}
}

/*
	Blueprint Service to be used by Blueprint Handler to interact with the
	Database layer of the application
*/

type Service struct {
	Blueprints *mongo.Collection
	Users      *mongo.Collection
}
