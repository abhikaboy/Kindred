package spaces

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	Profile "github.com/abhikaboy/Kindred/internal/handlers/profile"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
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
	service     *Service
	config      config.Config
	collections map[string]*mongo.Collection
	processor   *ImageProcessor
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
	resp.Body.PublicURL = result.CDNUrl // Use CDN URL as the public URL
	resp.Body.Message = "Upload URL generated successfully"

	return resp, nil
}

func (h *Handler) ConfirmImageUpload(ctx context.Context, input *ConfirmImageUploadInput) (*ConfirmImageUploadOutput, error) {
	switch input.ResourceType {
	case "profile":
		// Convert string ID to ObjectID
		objectID, err := primitive.ObjectIDFromHex(input.ResourceID)
		if err != nil {
			return nil, huma.Error400BadRequest("Invalid profile ID format", err)
		}

		// Update profile picture in database
		err = h.updateProfilePicture(objectID, input.Body.PublicURL)
		if err != nil {
			return nil, huma.Error500InternalServerError("Failed to update profile picture", err)
		}

	case "blueprint":
		// For blueprint images, we just confirm the upload without updating the database
		// The blueprint will be updated when the blueprint is created/updated
		// This allows for temporary IDs during blueprint creation
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

func (h *Handler) ProcessAndUploadImage(ctx context.Context, input *ProcessAndUploadImageInput) (*ProcessAndUploadImageOutput, error) {
	// Decode base64 image data
	imageData, err := base64.StdEncoding.DecodeString(input.Body.ImageData)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid base64 image data", err)
	}

	// Determine variant based on resource type if not specified
	variant := input.Variant
	if variant == "" {
		variant = h.processor.GetOptimalVariant(0, 0, input.ResourceType) // We'll get dimensions during processing
	}

	// Process the image
	processedImage, err := h.processor.ProcessImage(ctx, imageData, variant)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to process image", err)
	}

	// Get bucket configuration
	bucketName := h.config.DO.SpacesBucket
	if bucketName == "" {
		return nil, huma.Error500InternalServerError("Spaces bucket not configured", fmt.Errorf("bucket name not configured"))
	}

	// Generate key for the processed image
	fileExt := getFileExtensionFromContentType(processedImage.ContentType)
	key := fmt.Sprintf("%ss/%s/%s%s", input.ResourceType, input.ResourceID, generateUUID(), fileExt)

	// Upload processed image directly to S3
	_, err = h.service.S3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucketName),
		Key:         aws.String(key),
		Body:        bytes.NewReader(processedImage.Data),
		ContentType: aws.String(processedImage.ContentType),
		ACL:         "public-read",
	})

	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to upload processed image", err)
	}

	// Generate URLs using auto-CDN logic
	spacesURL := h.config.DO.SpacesURL

	var publicURL string
	if spacesURL != "" {
		if !strings.HasSuffix(spacesURL, "/") {
			spacesURL += "/"
		}

		// Auto-generate CDN URL from spaces URL
		if strings.Contains(spacesURL, ".digitaloceanspaces.com") && !strings.Contains(spacesURL, ".cdn.") {
			// Convert to CDN URL: example.digitaloceanspaces.com -> example.cdn.digitaloceanspaces.com
			publicURL = strings.Replace(spacesURL, ".digitaloceanspaces.com", ".cdn.digitaloceanspaces.com", 1) + key
		} else {
			// If it's already a custom CDN domain or already has .cdn., use as-is
			publicURL = spacesURL + key
		}
	}

	// Update database based on resource type
	switch input.ResourceType {
	case "profile":
		objectID, err := primitive.ObjectIDFromHex(input.ResourceID)
		if err != nil {
			return nil, huma.Error400BadRequest("Invalid profile ID format", err)
		}
		err = h.updateProfilePicture(objectID, publicURL)
		if err != nil {
			return nil, huma.Error500InternalServerError("Failed to update profile picture", err)
		}
	case "blueprint":
		// For blueprints, no immediate database update needed
		break
	case "post":
		// TODO: Update post image when post service is available
		break
	}

	// Return response
	resp := &ProcessAndUploadImageOutput{}
	resp.Body.PublicURL = publicURL
	resp.Body.ProcessedAt = time.Now().UTC().Format(time.RFC3339)
	resp.Body.Width = processedImage.Width
	resp.Body.Height = processedImage.Height
	resp.Body.Size = processedImage.Size
	resp.Body.Format = strings.TrimPrefix(processedImage.ContentType, "image/")
	resp.Body.Message = "Image processed and uploaded successfully"

	return resp, nil
}

// updateProfilePicture updates the profile picture for a user
func (h *Handler) updateProfilePicture(userID primitive.ObjectID, pictureURL string) error {
	// Create profile service with the collections from the handler
	profileService := Profile.NewService(h.collections)
	return profileService.UpdateProfilePicture(userID, pictureURL)
}

// Helper functions
func getFileExtensionFromContentType(contentType string) string {
	switch contentType {
	case "image/webp":
		return ".webp"
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/gif":
		return ".gif"
	default:
		return ".webp" // Default to WebP
	}
}

func generateUUID() string {
	// Use the existing UUID generation from the service
	return "processed-" + fmt.Sprintf("%d", time.Now().UnixNano())
}
