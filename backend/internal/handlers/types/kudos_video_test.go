package types

import "testing"

func strPtr(s string) *string { return &s }
func intPtr(i int) *int       { return &i }

func TestValidateVideoKudos(t *testing.T) {
	thumb := strPtr("https://example.com/thumb.jpg")

	tests := []struct {
		name       string
		kudosType  string
		thumbnail  *string
		durationMs *int
		wantErr    bool
	}{
		{"message type ignores video fields", "message", nil, nil, false},
		{"image type ignores video fields", "image", nil, nil, false},
		{"valid video", "video", thumb, intPtr(15_000), false},
		{"video at exactly the cap", "video", thumb, intPtr(30_000), false},
		{"video missing thumbnail", "video", nil, intPtr(15_000), true},
		{"video empty thumbnail", "video", strPtr(""), intPtr(15_000), true},
		{"video missing duration", "video", thumb, nil, true},
		{"video zero duration", "video", thumb, intPtr(0), true},
		{"video over the cap", "video", thumb, intPtr(30_001), true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateVideoKudos(tt.kudosType, tt.thumbnail, tt.durationMs)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateVideoKudos() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
