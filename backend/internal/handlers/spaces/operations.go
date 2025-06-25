package spaces

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Input/Output types for s3bucket operations

// Get Presigned URL
type GetPresignedUrlInput struct {
	Key string `path:"key" example:"profile-pictures/user123.jpg"`
}

type GetPresignedUrlOutput struct {
	Body interface{} `json:"body"` // Spaces URL response structure
}

// Create Presigned URL for Upload
type CreatePresignedUrlInput struct {
	FileType string `query:"fileType" required:"true" example:"image/jpeg"`
}

type CreatePresignedUrlOutput struct {
	Body interface{} `json:"body"` // Spaces URL and key response structure
}

// Generate Image Upload URL
type GenerateImageUploadURLInput struct {
	ResourceType string `path:"resource_type" example:"profile" description:"Type of resource (profile, post, etc.)"`
	ResourceID   string `path:"resource_id" example:"507f1f77bcf86cd799439011" description:"ID of the resource"`
	FileType     string `query:"file_type" required:"true" example:"image/jpeg" description:"MIME type of the image"`
}

type GenerateImageUploadURLOutput struct {
	Body struct {
		UploadURL string `json:"upload_url" example:"https://presigned-upload-url..."`
		Key       string `json:"key" example:"profiles/507f1f77bcf86cd799439011/uuid.jpg"`
		PublicURL string `json:"public_url" example:"https://kindred.nyc3.digitaloceanspaces.com/profiles/507f1f77bcf86cd799439011/uuid.jpg"`
		Message   string `json:"message" example:"Upload URL generated successfully"`
	}
}

// Confirm Image Upload
type ConfirmImageUploadInput struct {
	ResourceType string `path:"resource_type" example:"profile" description:"Type of resource (profile, post, etc.)"`
	ResourceID   string `path:"resource_id" example:"507f1f77bcf86cd799439011" description:"ID of the resource"`
	Body         struct {
		PublicURL string `json:"public_url" required:"true" example:"https://kindred.nyc3.digitaloceanspaces.com/profiles/507f1f77bcf86cd799439011/uuid.jpg"`
	}
}

type ConfirmImageUploadOutput struct {
	Body struct {
		Message string `json:"message" example:"Image upload confirmed successfully"`
	}
}

// Operation registrations

func RegisterGetPresignedUrlOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-presigned-url",
		Method:      http.MethodGet,
		Path:        "/v1/assets/{key}/url",
		Summary:     "Get presigned URL for asset download",
		Description: "Get a presigned URL to download an asset from S3",
		Tags:        []string{"assets"},
	}, handler.GetPresignedUrlHuma)
}

func RegisterCreatePresignedUrlOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "create-presigned-url",
		Method:      http.MethodPost,
		Path:        "/v1/assets/upload",
		Summary:     "Create presigned URL for asset upload",
		Description: "Create a presigned URL to upload an asset to S3",
		Tags:        []string{"assets"},
	}, handler.CreatePresignedUrlHuma)
}

func RegisterGenerateImageUploadURLOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "generate-image-upload-url",
		Method:      http.MethodGet,
		Path:        "/v1/uploads/{resource_type}/{resource_id}/url",
		Summary:     "Generate presigned URL for image upload",
		Description: "Generate a presigned URL for uploading images to Digital Ocean Spaces",
		Tags:        []string{"uploads", "images"},
	}, handler.GenerateImageUploadURL)
}

func RegisterConfirmImageUploadOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "confirm-image-upload",
		Method:      http.MethodPost,
		Path:        "/v1/uploads/{resource_type}/{resource_id}/confirm",
		Summary:     "Confirm image upload",
		Description: "Confirm that an image has been successfully uploaded and update the resource",
		Tags:        []string{"uploads", "images"},
	}, handler.ConfirmImageUpload)
}

// Register all s3bucket operations
func RegisterS3BucketOperations(api huma.API, handler *Handler) {
	RegisterGetPresignedUrlOperation(api, handler)
	RegisterCreatePresignedUrlOperation(api, handler)
	RegisterGenerateImageUploadURLOperation(api, handler)
	RegisterConfirmImageUploadOperation(api, handler)
} 