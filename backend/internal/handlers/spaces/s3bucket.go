package spaces

import (
	"context"
	"fmt"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/danielgtaylor/huma/v2"
)

type GetParams struct {
	Bucket string
	Key    string
}

type PostParams struct {
	Bucket   string
	Filetype string
}

type Handler struct {
	service *Service
	config  config.Config
}

func (h *Handler) GetPresignedUrlHuma(ctx context.Context, input *GetPresignedUrlInput) (*GetPresignedUrlOutput, error) {
	key := input.Key

	// get the name of the bucket
	bucketName := h.config.DO.SpacesBucket
	if bucketName == "" {
		return nil, huma.Error500InternalServerError("SPACES_BUCKET environment variable is not set", fmt.Errorf("bucket name not configured"))
	}

	object := &GetParams{
		Bucket: bucketName,
		Key:    key,
	}
	
	url, err := h.service.GetPresignedUrl(object)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to generate presigned URL", err)
	}
	
	return &GetPresignedUrlOutput{Body: url}, nil
}

func (h *Handler) CreatePresignedUrlHuma(ctx context.Context, input *CreatePresignedUrlInput) (*CreatePresignedUrlOutput, error) {
	fileType := input.FileType
	if fileType == "" {
		return nil, huma.Error400BadRequest("fileType query parameter is required", nil)
	}

	bucketName := h.config.DO.SpacesBucket
	if bucketName == "" {
		return nil, huma.Error500InternalServerError("SPACES_BUCKET environment variable is not set", fmt.Errorf("bucket name not configured"))
	}

	object := &PostParams{
		Bucket:   bucketName,
		Filetype: fileType,
	}

	urlAndKey, err := h.service.CreateUrlAndKey(object)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to create presigned URL", err)
	}
	
	return &CreatePresignedUrlOutput{Body: urlAndKey}, nil
}

func (h *Handler) GenerateImageUploadURL(ctx context.Context, input *GenerateImageUploadURLInput) (*GenerateImageUploadURLOutput, error) {
	// Validate file type
	if !ValidateImageType(input.FileType) {
		return nil, huma.Error400BadRequest("Invalid file type. Supported types: image/jpeg, image/png, image/gif, image/webp", nil)
	}

	// Get bucket name from configuration
	bucketName := h.config.DO.SpacesBucket
	if bucketName == "" {
		bucketName = h.config.DO.SpacesBucket
	}
	if bucketName == "" {
		return nil, huma.Error500InternalServerError("No bucket configured", fmt.Errorf("neither Spaces nor DO Spaces bucket is configured"))
	}

	// Get spaces URL for public URL generation
	spacesURL := h.config.DO.SpacesURL

	// Create upload parameters
	params := &ImageUploadParams{
		ResourceType: input.ResourceType,
		ResourceID:   input.ResourceID,
		FileType:     input.FileType,
	}

	// Generate presigned URL
	result, err := h.service.GenerateImageUploadURL(ctx, params, bucketName, spacesURL)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to generate upload URL", err)
	}

	resp := &GenerateImageUploadURLOutput{}
	resp.Body.UploadURL = result.UploadURL
	resp.Body.Key = result.Key
	resp.Body.PublicURL = result.PublicURL
	resp.Body.Message = "Upload URL generated successfully"

	return resp, nil
}

func (h *Handler) ConfirmImageUpload(ctx context.Context, input *ConfirmImageUploadInput) (*ConfirmImageUploadOutput, error) {
	// For now, this is a placeholder that confirms the upload
	// In a real implementation, you'd need to import and call the appropriate service
	// based on the ResourceType to update the database record
	
	switch input.ResourceType {
	case "profile":
		// TODO: Import profile service and update profile picture
		// profileService.UpdateProfilePicture(input.ResourceID, input.Body.PublicURL)
		break
	case "post":
		// TODO: Import post service and update post image
		// postService.UpdatePostImage(input.ResourceID, input.Body.PublicURL)
		break
	default:
		return nil, huma.Error400BadRequest("Unsupported resource type", fmt.Errorf("resource type '%s' is not supported", input.ResourceType))
	}

	resp := &ConfirmImageUploadOutput{}
	resp.Body.Message = fmt.Sprintf("Image upload confirmed for %s %s", input.ResourceType, input.ResourceID)

	return resp, nil
}
