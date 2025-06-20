package s3bucket

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
	bucketName := h.config.AWS.BucketName
	if bucketName == "" {
		return nil, huma.Error500InternalServerError("S3_BUCKET environment variable is not set", fmt.Errorf("bucket name not configured"))
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

	bucketName := h.config.AWS.BucketName
	if bucketName == "" {
		return nil, huma.Error500InternalServerError("S3_BUCKET environment variable is not set", fmt.Errorf("bucket name not configured"))
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
