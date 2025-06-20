package s3bucket

import (
	"log"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/danielgtaylor/huma/v2"
)

type Service struct {
	Presigner *s3.PresignClient
}

func newService(presigner *s3.PresignClient) *Service {
	return &Service{
		Presigner: presigner,
	}
}

func Routes(api huma.API, presigner *s3.PresignClient) {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	service := newService(presigner)
	handler := &Handler{
		service: service,
		config:  cfg,
	}

	RegisterS3BucketOperations(api, handler)
}
