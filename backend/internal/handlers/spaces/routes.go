package spaces

import (
	"context"
	"log"

	internalConfig "github.com/abhikaboy/Kindred/internal/config"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

type Service struct {
	Presigner *s3.PresignClient
	S3Client  *s3.Client
}

func newService(presigner *s3.PresignClient, s3Client *s3.Client) *Service {
	return &Service{
		Presigner: presigner,
		S3Client:  s3Client,
	}
}

// NewPresigner creates a new S3 presigner client configured for Digital Ocean Spaces
func NewPresigner() (*s3.PresignClient, *s3.Client) {
	// Load application configuration
	cfg, err := internalConfig.Load()
	if err != nil {
		log.Fatalf("Failed to load application config: %v", err)
	}

	// Check if we have DO Spaces configuration
	if cfg.DO.SpacesAccessKey == "" || cfg.DO.SpacesSecretKey == "" {
		log.Fatalf("Digital Ocean Spaces credentials not configured. Please set SPACES_ACCESS_KEY and SPACES_SECRET_KEY environment variables")
	}

	// Create custom credentials for Digital Ocean Spaces
	creds := credentials.NewStaticCredentialsProvider(
		cfg.DO.SpacesAccessKey,
		cfg.DO.SpacesSecretKey,
		"", // session token (empty for DO Spaces)
	)

	// Construct Digital Ocean Spaces endpoint
	// Format: https://{region}.digitaloceanspaces.com
	endpoint := "https://" + cfg.DO.SpacesRegion + ".digitaloceanspaces.com"

	// Load AWS configuration with custom endpoint resolver
	awsCfg, err := awsconfig.LoadDefaultConfig(context.TODO(),
		awsconfig.WithCredentialsProvider(creds),
		awsconfig.WithRegion(cfg.DO.SpacesRegion),
		awsconfig.WithEndpointResolverWithOptions(aws.EndpointResolverWithOptionsFunc(
			func(service, region string, options ...interface{}) (aws.Endpoint, error) {
				if service == s3.ServiceID {
					return aws.Endpoint{
						URL:               endpoint,
						HostnameImmutable: true,
					}, nil
				}
				return aws.Endpoint{}, &aws.EndpointNotFoundError{}
			})),
	)
	if err != nil {
		log.Fatalf("Failed to load AWS config: %v", err)
	}

	// Create S3 client with Digital Ocean Spaces configuration
	s3Client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = false // Digital Ocean Spaces uses virtual-hosted-style URLs
	})

	// Create presigner client
	return s3.NewPresignClient(s3Client), s3Client
}

func Routes(api huma.API, presigner *s3.PresignClient, s3Client *s3.Client, collections map[string]*mongo.Collection) {
	cfg, err := internalConfig.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	service := newService(presigner, s3Client)
	processor := NewImageProcessor()
	handler := &Handler{
		service:     service,
		config:      cfg,
		collections: collections,
		processor:   processor,
	}

	RegisterS3BucketOperations(api, handler)
}
