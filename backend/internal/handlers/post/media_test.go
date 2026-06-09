package Post

import (
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
)

func TestToMediaItems(t *testing.T) {
	thumb := "https://cdn/t.jpg"
	in := []MediaItemInput{
		{Type: "image", URL: "https://cdn/a.jpg", Width: 100, Height: 200},
		{Type: "video", URL: "https://cdn/v.mp4", ThumbnailURL: &thumb, Width: 720, Height: 1280},
	}
	out := ToMediaItems(in)
	if len(out) != 2 || out[1].Type != "video" || out[1].ThumbnailURL == nil {
		t.Fatalf("unexpected conversion: %+v", out)
	}
}

func TestDeriveImagesFromMedia(t *testing.T) {
	media := []types.MediaItem{
		{Type: "image", URL: "https://cdn/a.jpg"},
		{Type: "video", URL: "https://cdn/v.mp4"},
		{Type: "image", URL: "https://cdn/b.jpg"},
	}
	imgs := DeriveImagesFromMedia(media)
	if len(imgs) != 2 || imgs[0] != "https://cdn/a.jpg" || imgs[1] != "https://cdn/b.jpg" {
		t.Fatalf("expected only image URLs, got %v", imgs)
	}
}

func TestPrimarySizeFromMedia(t *testing.T) {
	media := []types.MediaItem{
		{Type: "video", URL: "https://cdn/v.mp4", Width: 720, Height: 1280, Bytes: 999},
	}
	size := PrimarySizeFromMedia(media)
	if size == nil || size.Width != 720 || size.Height != 1280 {
		t.Fatalf("unexpected size: %+v", size)
	}
}
