package s3bucket

import (
	"log"

	"github.com/abhikaboy/GERM-template/internal/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gofiber/fiber/v2"
)

type Service struct {
	Presigner *s3.PresignClient
}

func newService(presigner *s3.PresignClient) *Service {
	return &Service{
		Presigner: presigner,
	}
}

func Routes(app *fiber.App, presigner *s3.PresignClient) {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	service := newService(presigner)
	handler := &Handler{
		service: service,
		config:  cfg,
	}

	assets := app.Group("/api/v1/assets")

	assets.Get("/:key/url", handler.GetPresignedUrlHandler)
	assets.Post("/upload", handler.PostPresignedUrlHandler)
}
