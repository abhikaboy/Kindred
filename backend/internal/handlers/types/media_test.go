package types

import (
	"testing"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func basePost() PostDocument {
	return PostDocument{
		ID:        primitive.NewObjectID(),
		User:      UserExtendedReferenceInternal{ID: primitive.NewObjectID()},
		Caption:   "hi",
		Reactions: map[string][]primitive.ObjectID{},
		Comments:  []CommentDocument{},
		Metadata:  NewPostMetadata(),
	}
}

func TestToAPI_DerivesMediaFromLegacyImages(t *testing.T) {
	p := basePost()
	p.Images = []string{"https://cdn/a.jpg", "https://cdn/b.jpg"}

	api := p.ToAPI()

	if len(api.Media) != 2 {
		t.Fatalf("expected 2 media items, got %d", len(api.Media))
	}
	if api.Media[0].Type != "image" || api.Media[0].URL != "https://cdn/a.jpg" {
		t.Fatalf("unexpected media[0]: %+v", api.Media[0])
	}
	// legacy Images must still be present for old clients
	if len(api.Images) != 2 {
		t.Fatalf("expected Images preserved, got %d", len(api.Images))
	}
}

func TestToAPI_CarriesStoredMediaThrough(t *testing.T) {
	p := basePost()
	thumb := "https://cdn/thumb.jpg"
	p.Media = []MediaItem{
		{Type: "image", URL: "https://cdn/a.jpg", Width: 100, Height: 100},
		{Type: "video", URL: "https://cdn/v.mp4", ThumbnailURL: &thumb, Width: 720, Height: 1280},
	}

	api := p.ToAPI()

	if len(api.Media) != 2 {
		t.Fatalf("expected 2 media items, got %d", len(api.Media))
	}
	if api.Media[1].Type != "video" || api.Media[1].ThumbnailURL == nil {
		t.Fatalf("video media not carried through: %+v", api.Media[1])
	}
}
