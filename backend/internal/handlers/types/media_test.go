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

	api := p.ToAPI(p.User.ID)

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

func TestToAPI_AnonymizesPrivateKudosForNonOwner(t *testing.T) {
	p := basePost()
	sender := KudosSender{ID: primitive.NewObjectID(), Name: "Beaker", Icon: "https://cdn/beak.jpg"}
	p.Kudos = []PostKudos{
		{CongratulationID: primitive.NewObjectID(), Sender: sender, Message: "public one", Type: "message"},
		{CongratulationID: primitive.NewObjectID(), Sender: sender, Message: "secret", Type: "message", Private: true},
	}

	// Owner sees everything, including the private sender + message.
	ownerView := p.ToAPI(p.User.ID)
	if len(ownerView.Kudos) != 2 {
		t.Fatalf("owner: expected 2 kudos, got %d", len(ownerView.Kudos))
	}
	if ownerView.Kudos[1].Sender.Name != "Beaker" || ownerView.Kudos[1].Message != "secret" {
		t.Fatalf("owner should see private kudos identity + message: %+v", ownerView.Kudos[1])
	}

	// A non-owner gets the private kudos anonymized: no sender, no message.
	otherView := p.ToAPI(primitive.NewObjectID())
	if len(otherView.Kudos) != 2 {
		t.Fatalf("other: expected 2 kudos, got %d", len(otherView.Kudos))
	}
	if otherView.Kudos[0].Sender.Name != "Beaker" || otherView.Kudos[0].Message != "public one" {
		t.Fatalf("public kudos should be intact for non-owner: %+v", otherView.Kudos[0])
	}
	priv := otherView.Kudos[1]
	if !priv.Private {
		t.Fatalf("expected private flag preserved")
	}
	if priv.Sender.Name != "" || !priv.Sender.ID.IsZero() || priv.Message != "" {
		t.Fatalf("private kudos should be anonymized for non-owner: %+v", priv)
	}
}

func TestToAPI_CarriesStoredMediaThrough(t *testing.T) {
	p := basePost()
	thumb := "https://cdn/thumb.jpg"
	p.Media = []MediaItem{
		{Type: "image", URL: "https://cdn/a.jpg", Width: 100, Height: 100},
		{Type: "video", URL: "https://cdn/v.mp4", ThumbnailURL: &thumb, Width: 720, Height: 1280},
	}

	api := p.ToAPI(p.User.ID)

	if len(api.Media) != 2 {
		t.Fatalf("expected 2 media items, got %d", len(api.Media))
	}
	if api.Media[1].Type != "video" || api.Media[1].ThumbnailURL == nil {
		t.Fatalf("video media not carried through: %+v", api.Media[1])
	}
}
