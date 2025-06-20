package s3bucket

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
	Body interface{} `json:"body"` // AWS URL response structure
}

// Create Presigned URL for Upload
type CreatePresignedUrlInput struct {
	FileType string `query:"fileType" required:"true" example:"image/jpeg"`
}

type CreatePresignedUrlOutput struct {
	Body interface{} `json:"body"` // AWS URL and key response structure
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

// Register all s3bucket operations
func RegisterS3BucketOperations(api huma.API, handler *Handler) {
	RegisterGetPresignedUrlOperation(api, handler)
	RegisterCreatePresignedUrlOperation(api, handler)
} 