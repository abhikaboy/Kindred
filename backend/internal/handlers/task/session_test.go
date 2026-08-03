package task

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestDeriveSessionTrackable(t *testing.T) {
	soon := time.Now().Add(2 * 24 * time.Hour)
	far := time.Now().Add(30 * 24 * time.Hour)

	assert.False(t, deriveSessionTrackable(nil, nil, 0), "one-and-done errand should not be trackable")
	assert.True(t, deriveSessionTrackable([]ChecklistItem{{Content: "step 1"}}, nil, 0), "checklist present")
	assert.False(t, deriveSessionTrackable(nil, &soon, 0), "deadline within the 7-day window")
	assert.True(t, deriveSessionTrackable(nil, &far, 0), "deadline more than 7 days out")
	assert.True(t, deriveSessionTrackable(nil, nil, highValueThreshold), "high value")
	assert.False(t, deriveSessionTrackable(nil, nil, highValueThreshold-1), "just below high value")
}
