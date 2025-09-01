package spaces

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"log"

	"github.com/disintegration/imaging"
)

// ImageVariant defines the processing parameters for different image sizes
type ImageVariant struct {
	MaxWidth  int
	MaxHeight int
	Quality   int
	Format    string // "webp", "jpeg", "png"
}

// Standard image variants for different use cases
var ImageVariants = map[string]ImageVariant{
	"thumbnail": {MaxWidth: 300, MaxHeight: 300, Quality: 80, Format: "jpeg"},
	"medium":    {MaxWidth: 800, MaxHeight: 800, Quality: 85, Format: "jpeg"},
	"large":     {MaxWidth: 1200, MaxHeight: 1200, Quality: 90, Format: "jpeg"},
	"original":  {MaxWidth: 0, MaxHeight: 0, Quality: 95, Format: "jpeg"}, // Only convert format
}

// ProcessedImage contains the result of image processing
type ProcessedImage struct {
	Data        []byte
	ContentType string
	Width       int
	Height      int
	Size        int64
}

// ImageProcessor handles image processing operations
type ImageProcessor struct{}

// NewImageProcessor creates a new image processor
func NewImageProcessor() *ImageProcessor {
	return &ImageProcessor{}
}

// ProcessImage processes an image according to the specified variant
func (p *ImageProcessor) ProcessImage(ctx context.Context, imageData []byte, variant string) (*ProcessedImage, error) {
	// Get variant configuration
	config, exists := ImageVariants[variant]
	if !exists {
		config = ImageVariants["medium"] // Default fallback
	}

	// Decode the original image
	img, format, err := image.Decode(bytes.NewReader(imageData))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	log.Printf("Original image: %dx%d, format: %s", img.Bounds().Dx(), img.Bounds().Dy(), format)

	// Resize if needed
	processedImg := img
	if config.MaxWidth > 0 || config.MaxHeight > 0 {
		processedImg = p.resizeImage(img, config.MaxWidth, config.MaxHeight)
	}

	// Convert to desired format
	processedData, contentType, err := p.encodeImage(processedImg, config.Format, config.Quality)
	if err != nil {
		return nil, fmt.Errorf("failed to encode image: %w", err)
	}

	bounds := processedImg.Bounds()
	result := &ProcessedImage{
		Data:        processedData,
		ContentType: contentType,
		Width:       bounds.Dx(),
		Height:      bounds.Dy(),
		Size:        int64(len(processedData)),
	}

	log.Printf("Processed image: %dx%d, size: %d bytes, format: %s",
		result.Width, result.Height, result.Size, contentType)

	return result, nil
}

// resizeImage resizes an image while maintaining aspect ratio
func (p *ImageProcessor) resizeImage(img image.Image, maxWidth, maxHeight int) image.Image {
	bounds := img.Bounds()
	originalWidth := bounds.Dx()
	originalHeight := bounds.Dy()

	// If no resizing needed, return original
	if (maxWidth == 0 || originalWidth <= maxWidth) && (maxHeight == 0 || originalHeight <= maxHeight) {
		return img
	}

	// Calculate new dimensions while maintaining aspect ratio
	newWidth := maxWidth
	newHeight := maxHeight

	if maxWidth > 0 && maxHeight > 0 {
		// Both dimensions specified - fit within bounds
		return imaging.Fit(img, newWidth, newHeight, imaging.Lanczos)
	} else if maxWidth > 0 {
		// Only width specified
		return imaging.Resize(img, newWidth, 0, imaging.Lanczos)
	} else if maxHeight > 0 {
		// Only height specified
		return imaging.Resize(img, 0, newHeight, imaging.Lanczos)
	}

	return img
}

// encodeImage encodes an image to the specified format
func (p *ImageProcessor) encodeImage(img image.Image, format string, quality int) ([]byte, string, error) {
	var buf bytes.Buffer

	switch format {
	case "jpeg", "jpg":
		err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality})
		if err != nil {
			return nil, "", fmt.Errorf("failed to encode JPEG: %w", err)
		}
		return buf.Bytes(), "image/jpeg", nil

	case "png":
		err := png.Encode(&buf, img)
		if err != nil {
			return nil, "", fmt.Errorf("failed to encode PNG: %w", err)
		}
		return buf.Bytes(), "image/png", nil

	default:
		// Default to JPEG for compatibility
		err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality})
		if err != nil {
			return nil, "", fmt.Errorf("failed to encode JPEG (default): %w", err)
		}
		return buf.Bytes(), "image/jpeg", nil
	}
}

// GetOptimalVariant determines the best variant based on image dimensions and use case
func (p *ImageProcessor) GetOptimalVariant(width, height int, resourceType string) string {
	// Determine optimal variant based on use case and image size
	switch resourceType {
	case "profile":
		// Profile pictures are usually small
		if width <= 300 && height <= 300 {
			return "thumbnail"
		}
		return "medium"

	case "post":
		// Posts can be larger but should be optimized for mobile
		if width >= 1200 || height >= 1200 {
			return "large"
		} else if width >= 800 || height >= 800 {
			return "medium"
		}
		return "medium" // Default for posts

	case "blueprint":
		// Blueprints might need higher quality
		if width >= 1200 || height >= 1200 {
			return "large"
		}
		return "medium"

	default:
		return "medium"
	}
}

// ProcessImageStream processes an image from an io.Reader
func (p *ImageProcessor) ProcessImageStream(ctx context.Context, reader io.Reader, variant string) (*ProcessedImage, error) {
	// Read all data
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read image data: %w", err)
	}

	return p.ProcessImage(ctx, data, variant)
}
