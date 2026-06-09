package spaces

import "testing"

func TestValidateVideoType(t *testing.T) {
	if !ValidateVideoType("video/mp4") {
		t.Fatal("video/mp4 should be valid")
	}
	if !ValidateVideoType("video/quicktime") {
		t.Fatal("video/quicktime should be valid")
	}
	if ValidateVideoType("image/jpeg") {
		t.Fatal("image/jpeg should not be a valid video type")
	}
}

func TestValidateMediaType(t *testing.T) {
	if !ValidateMediaType("image/png") {
		t.Fatal("image/png should be valid media")
	}
	if !ValidateMediaType("video/mp4") {
		t.Fatal("video/mp4 should be valid media")
	}
	if ValidateMediaType("application/pdf") {
		t.Fatal("application/pdf should not be valid media")
	}
}

func TestGetFileExtension_Video(t *testing.T) {
	if got := getFileExtension("video/mp4"); got != ".mp4" {
		t.Fatalf("expected .mp4, got %s", got)
	}
	if got := getFileExtension("video/quicktime"); got != ".mov" {
		t.Fatalf("expected .mov, got %s", got)
	}
}
