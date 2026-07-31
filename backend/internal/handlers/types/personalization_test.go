package types

import (
	"testing"
	"time"
)

func timePtr(t time.Time) *time.Time { return &t }

// TestMayShareStruggles is the consent gate for disclosing one user's
// difficulties to another person. Every case that is not an explicit, current,
// enabled `shareStruggles: true` has to answer false — the interesting rows are
// the ones that look like consent and are not.
func TestMayShareStruggles(t *testing.T) {
	now := time.Date(2026, 7, 30, 12, 0, 0, 0, time.UTC)
	past := now.Add(-24 * time.Hour)
	future := now.Add(24 * time.Hour)

	tests := []struct {
		name     string
		settings UserSettings
		want     bool
	}{
		{
			// The case that matters most: an account that predates the field.
			// Absent is not consent.
			name:     "no personalization document at all",
			settings: UserSettings{},
			want:     false,
		},
		{
			name:     "personalization on, shareStruggles never set",
			settings: UserSettings{Personalization: &PersonalizationSettings{Enabled: true}},
			want:     false,
		},
		{
			name:     "shareStruggles explicitly false",
			settings: UserSettings{Personalization: &PersonalizationSettings{Enabled: true, ShareStruggles: false}},
			want:     false,
		},
		{
			name:     "opted in",
			settings: UserSettings{Personalization: &PersonalizationSettings{Enabled: true, ShareStruggles: true}},
			want:     true,
		},
		{
			// Opted in once, then turned personalization off. Consent to be
			// learned about is a precondition for consent to be talked about.
			name:     "opted in but personalization disabled",
			settings: UserSettings{Personalization: &PersonalizationSettings{Enabled: false, ShareStruggles: true}},
			want:     false,
		},
		{
			name: "opted in but currently paused",
			settings: UserSettings{Personalization: &PersonalizationSettings{
				Enabled: true, ShareStruggles: true, PausedUntil: timePtr(future),
			}},
			want: false,
		},
		{
			name: "opted in, pause has expired",
			settings: UserSettings{Personalization: &PersonalizationSettings{
				Enabled: true, ShareStruggles: true, PausedUntil: timePtr(past),
			}},
			want: true,
		},
		{
			name: "disabled and paused and not opted in",
			settings: UserSettings{Personalization: &PersonalizationSettings{
				Enabled: false, ShareStruggles: false, PausedUntil: timePtr(future),
			}},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.settings.MayShareStruggles(now); got != tt.want {
				t.Errorf("MayShareStruggles() = %v, want %v", got, tt.want)
			}
		})
	}
}

// TestPersonalizationOrDefault_DoesNotDefaultShareStruggles pins the asymmetry
// between the two flags. Enabled defaults on so that shipping it does not
// silently opt every existing account out of personalization; ShareStruggles
// must not inherit that reasoning, because the thing it governs is disclosure
// to someone else.
func TestPersonalizationOrDefault_DoesNotDefaultShareStruggles(t *testing.T) {
	tests := []struct {
		name               string
		settings           UserSettings
		wantEnabled        bool
		wantShareStruggles bool
	}{
		{
			name:               "absent document",
			settings:           UserSettings{},
			wantEnabled:        true,
			wantShareStruggles: false,
		},
		{
			name:               "present and opted in",
			settings:           UserSettings{Personalization: &PersonalizationSettings{Enabled: true, ShareStruggles: true}},
			wantEnabled:        true,
			wantShareStruggles: true,
		},
		{
			name:               "present and opted out of everything",
			settings:           UserSettings{Personalization: &PersonalizationSettings{}},
			wantEnabled:        false,
			wantShareStruggles: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.settings.PersonalizationOrDefault()
			if got.Enabled != tt.wantEnabled {
				t.Errorf("Enabled = %v, want %v", got.Enabled, tt.wantEnabled)
			}
			if got.ShareStruggles != tt.wantShareStruggles {
				t.Errorf("ShareStruggles = %v, want %v", got.ShareStruggles, tt.wantShareStruggles)
			}
		})
	}
}

// TestDefaultUserSettings_ShareStrugglesOff makes sure a brand new account is
// created opted out. Every other flag in DefaultUserSettings is true, so this
// one is easy to "fix" by accident.
func TestDefaultUserSettings_ShareStrugglesOff(t *testing.T) {
	defaults := DefaultUserSettings()

	if defaults.Personalization == nil {
		t.Fatal("DefaultUserSettings must set Personalization")
	}
	if !defaults.Personalization.Enabled {
		t.Error("Enabled must default to true")
	}
	if defaults.Personalization.ShareStruggles {
		t.Error("ShareStruggles must default to false")
	}
	if defaults.MayShareStruggles(time.Now()) {
		t.Error("a new account must not disclose struggles")
	}
}
