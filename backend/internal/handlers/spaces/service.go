package spaces

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

type DownloadUrl struct {
	URL string `json:"download_url"`
}

type UploadUrl struct {
	URL       string `json:"upload_url"`
	Key       string `json:"key"`
	PublicURL string `json:"public_url,omitempty"`
}

type ImageUploadResult struct {
	UploadURL string `json:"upload_url"`
	Key       string `json:"key"`
	PublicURL string `json:"public_url"`
	CDNUrl    string `json:"cdn_url,omitempty"`
}

type ImageUploadParams struct {
	ResourceType string // "profile", "post", etc.
	ResourceID   string // user ID, post ID, etc.
	FileType     string // "image/jpeg", etc.
}

func (s *Service) GetPresignedUrl(inputs *GetParams) (*DownloadUrl, error) {
	// generate a presigned URL
	req, err := s.Presigner.PresignGetObject(context.Background(), &s3.GetObjectInput{
		Bucket: aws.String(inputs.Bucket),
		Key:    aws.String(inputs.Key),
	})
	if err != nil {
		return nil, err
	}

	return &DownloadUrl{
		URL: req.URL,
	}, nil
}

func (s *Service) CreateUrlAndKey(inputs *PostParams) (*UploadUrl, error) {
	// generate uuid
	fileUUID := uuid.New().String()
	fileKey := fileUUID + "." + inputs.Filetype

	req, err := s.Presigner.PresignPutObject(context.Background(), &s3.PutObjectInput{
		Bucket: aws.String(inputs.Bucket),
		Key:    aws.String(fileKey),
	})
	if err != nil {
		return nil, err
	}
	urlAndKey := &UploadUrl{
		URL: req.URL,
		Key: fileKey,
	}
	return urlAndKey, nil
}

// GenerateImageUploadURL creates a presigned URL for image uploads with organized folder structure
func (s *Service) GenerateImageUploadURL(ctx context.Context, params *ImageUploadParams, bucketName, spacesURL string) (*ImageUploadResult, error) {
	// Generate unique filename with proper extension
	fileExt := getFileExtension(params.FileType)
	fileUUID := uuid.New().String()
	
	// Create organized key structure: resource-type/resource-id/uuid.ext
	key := fmt.Sprintf("%ss/%s/%s%s", params.ResourceType, params.ResourceID, fileUUID, fileExt)

	// Create presigned URL
	req, err := s.Presigner.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucketName),
		Key:         aws.String(key),
		ContentType: aws.String(params.FileType),
		ACL:         "public-read", // Make publicly accessible
	}, func(opts *s3.PresignOptions) {
		opts.Expires = time.Duration(15 * time.Minute) // 15 minutes expiry
	})

	if err != nil {
		return nil, fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	// Generate public URL
	publicURL := ""
	if spacesURL != "" {
		if !strings.HasSuffix(spacesURL, "/") {
			spacesURL += "/"
		}
		publicURL = spacesURL + key
	}

	return &ImageUploadResult{
		UploadURL: req.URL,
		Key:       key,
		PublicURL: publicURL,
		CDNUrl:    publicURL,
	}, nil
}

// Helper function to get file extension from content type
func getFileExtension(contentType string) string {
	switch contentType {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	default:
		return ".jpg" // Default to jpg
	}
}

// ValidateImageType checks if the content type is a valid image type
func ValidateImageType(contentType string) bool {
	validTypes := []string{
		"image/jpeg",
		"image/jpg", 
		"image/png",
		"image/gif",
		"image/webp",
	}
	
	for _, validType := range validTypes {
		if contentType == validType {
			return true
		}
	}
	return false
}
