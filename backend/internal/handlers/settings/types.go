package settings

import (
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/mongo"
)

// Get User Settings
type GetUserSettingsInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
}

type GetUserSettingsOutput struct {
	Body types.UserSettings `json:"body"`
}

// Update User Settings
type UpdateUserSettingsInput struct {
	Authorization string             `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	Body          types.UserSettings `json:"body"`
}

type UpdateUserSettingsOutput struct {
	Body struct {
		Message string `json:"message" example:"Settings updated successfully"`
	} `json:"body"`
}

// Update Personalization Settings
type UpdatePersonalizationInput struct {
	Authorization string                       `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	Body          UpdatePersonalizationRequest `json:"body"`
}

// UpdatePersonalizationRequest is a partial update: an omitted field is left
// alone. Both fields omitted is a no-op rather than an error, so a client can
// send the whole settings blob back without surprises.
type UpdatePersonalizationRequest struct {
	Enabled     *bool      `json:"enabled,omitempty" doc:"False turns personalization off; the worker stops deriving anything for this user. Setting it true also clears any pause."`
	PausedUntil *time.Time `json:"pausedUntil,omitempty" doc:"Pause personalization until this instant. The worker skips the user while it is in the future."`
	// A pointer like the others, and for a sharper reason: a bool would make
	// every request that omits the field an explicit `shareStruggles: false`
	// write — which is at least fail-safe — but it would equally make a client
	// echoing a stale blob able to flip it on. Only an explicit true in the
	// request body ever writes true.
	ShareStruggles *bool `json:"shareStruggles,omitempty" doc:"Opt in to letting close friends be prompted when you are stuck — a stalled task, a streak about to break. Defaults to false and stays false unless this is sent as true. Achievement-based kudos prompts do not depend on it."`
}

type UpdatePersonalizationOutput struct {
	Body types.PersonalizationSettings `json:"body"`
}

// Export Personalization Data
type ExportPersonalizationInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
}

type ExportPersonalizationOutput struct {
	Body ExportPersonalizationResponse `json:"body"`
}

type ExportPersonalizationResponse struct {
	UserID   string                        `json:"userId" doc:"The account this export belongs to"`
	Count    int                           `json:"count" doc:"Number of facts in the export"`
	Settings types.PersonalizationSettings `json:"settings" doc:"Consent state at export time"`
	Facts    []PersonalizationFact         `json:"facts" doc:"Everything currently held about this user"`
}

// PersonalizationFact is one `user_memory` row as the client is allowed to see
// it.
//
// `content` is deliberately absent. It is written as an instruction to a
// language model, not as a sentence about the user — the low-scorer branch of
// `deadline-adherence` literally reads "Deadlines read as aspiration rather
// than commitment", and showing that to the user is the exact failure the
// contract's rule 5 warns about. `evidence` carries the same information in
// structured form and is what user-facing surfaces are built from.
type PersonalizationFact struct {
	Key        string         `bson:"key" json:"key" doc:"Stable slug, e.g. peak-hours"`
	Kind       string         `bson:"kind" json:"kind" doc:"rhythm|reliability|pacing|focus|style|theme|social"`
	Confidence float64        `bson:"confidence" json:"confidence" doc:"0..1; stated answers are always 1"`
	Evidence   map[string]any `bson:"evidence" json:"evidence" doc:"The numbers the fact was computed from"`
	Source     string         `bson:"source" json:"source" doc:"derived (observed by the worker) or stated (the user told us)"`
	CreatedAt  time.Time      `bson:"createdAt" json:"createdAt"`
	UpdatedAt  time.Time      `bson:"updatedAt" json:"updatedAt"`
	ExpiresAt  *time.Time     `bson:"expiresAt,omitempty" json:"expiresAt,omitempty" doc:"When this expires on its own. Absent for stated answers, which never expire."`
}

// Delete Personalization Data
type DeletePersonalizationInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
}

type DeletePersonalizationOutput struct {
	Body struct {
		Message      string `json:"message" example:"Personalization data deleted"`
		DeletedCount int64  `json:"deletedCount" doc:"Number of facts removed"`
		Enabled      bool   `json:"enabled" doc:"Always false — deleting turns personalization off so the next nightly run does not rebuild what was erased"`
	} `json:"body"`
}

// Save Stated Preferences (onboarding)
type SaveStatedPreferencesInput struct {
	Authorization string                   `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	Body          StatedPreferencesRequest `json:"body"`
}

// StatedPreferencesRequest carries the four answers onboarding collects. Every
// field is optional so a partially completed onboarding still saves what it
// has; sending none of them is a no-op.
type StatedPreferencesRequest struct {
	PlanningStyle  string `json:"planningStyle,omitempty" enum:"detailed,flexible,spontaneous" doc:"How much structure they want up front"`
	Tone           string `json:"tone,omitempty" enum:"encouraging,direct,playful" doc:"How the assistant should talk to them"`
	NudgeFrequency string `json:"nudgeFrequency,omitempty" enum:"none,occasionally,regularly,frequently" doc:"How often they want to be nudged; matches the check-in frequency vocabulary"`
	PeakHours      string `json:"peakHours,omitempty" enum:"morning,afternoon,evening,night" doc:"When they say they focus best"`
}

type SaveStatedPreferencesOutput struct {
	Body struct {
		Message string   `json:"message" example:"Preferences saved"`
		Keys    []string `json:"keys" doc:"The user_memory keys written"`
	} `json:"body"`
}

// Update a single stated fact (settings screen: tap any row to correct it)
type UpdateStatedFactInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	Key           string `path:"key" enum:"planning-style,tone,nudge-frequency,peak-hours" doc:"Which stated answer to correct"`
	Body          struct {
		Value string `json:"value" required:"true" doc:"The new answer; valid values depend on the key"`
	} `json:"body"`
}

type UpdateStatedFactOutput struct {
	Body struct {
		Message string `json:"message" example:"Preference updated"`
		Key     string `json:"key"`
		Value   string `json:"value"`
	} `json:"body"`
}

// Service holds the MongoDB collections for settings operations
type Service struct {
	Users *mongo.Collection
	// UserMemory is the collection the productivity-agent worker owns. Kindred
	// only ever writes `source: "stated"` rows into it, plus the bulk delete
	// behind "delete all personalization data".
	UserMemory *mongo.Collection
}

// Handler holds the service for Huma operations
type Handler struct {
	service *Service
}
