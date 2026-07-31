package task

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func strPtr(s string) *string     { return &s }
func intPtr(i int) *int           { return &i }
func floatPtr(f float64) *float64 { return &f }

func TestSanitizeTaskSuggestion_KeepsOwnedCategory(t *testing.T) {
	owned := primitive.NewObjectID().Hex()

	clean := sanitizeTaskSuggestion(TaskFieldSuggestionLocal{CategoryID: strPtr(owned)}, []string{owned})

	assert.Equal(t, owned, *clean.CategoryID)
}

func TestSanitizeTaskSuggestion_DropsForeignCategory(t *testing.T) {
	owned := primitive.NewObjectID().Hex()
	foreign := primitive.NewObjectID().Hex()

	clean := sanitizeTaskSuggestion(TaskFieldSuggestionLocal{CategoryID: strPtr(foreign)}, []string{owned})

	assert.Nil(t, clean.CategoryID)
}

func TestSanitizeTaskSuggestion_DropsInventedCategory(t *testing.T) {
	clean := sanitizeTaskSuggestion(TaskFieldSuggestionLocal{CategoryID: strPtr("Fitness")}, []string{primitive.NewObjectID().Hex()})

	assert.Nil(t, clean.CategoryID)
}

func TestSanitizeTaskSuggestion_DropsCategoryWhenUserHasNone(t *testing.T) {
	clean := sanitizeTaskSuggestion(TaskFieldSuggestionLocal{CategoryID: strPtr(primitive.NewObjectID().Hex())}, nil)

	assert.Nil(t, clean.CategoryID)
}

func TestSanitizeTaskSuggestion_ClampsPriority(t *testing.T) {
	cases := []struct {
		name string
		in   *int
		want *int
	}{
		{"omitted stays omitted", nil, nil},
		{"zero is unusable", intPtr(0), nil},
		{"negative is unusable", intPtr(-4), nil},
		{"in range is kept", intPtr(2), intPtr(2)},
		{"low bound is kept", intPtr(1), intPtr(1)},
		{"high bound is kept", intPtr(3), intPtr(3)},
		{"above range clamps to 3", intPtr(9), intPtr(3)},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			clean := sanitizeTaskSuggestion(TaskFieldSuggestionLocal{Priority: tc.in}, nil)
			assert.Equal(t, tc.want, clean.Priority)
		})
	}
}

func TestSanitizeTaskSuggestion_ClampsValue(t *testing.T) {
	cases := []struct {
		name string
		in   *float64
		want *float64
	}{
		{"omitted stays omitted", nil, nil},
		{"zero is unusable", floatPtr(0), nil},
		{"negative is unusable", floatPtr(-2), nil},
		{"in range is kept", floatPtr(3), floatPtr(3)},
		{"low bound is kept", floatPtr(1), floatPtr(1)},
		{"high bound is kept", floatPtr(5), floatPtr(5)},
		{"above range clamps to 5", floatPtr(10), floatPtr(5)},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			clean := sanitizeTaskSuggestion(TaskFieldSuggestionLocal{Value: tc.in}, nil)
			assert.Equal(t, tc.want, clean.Value)
		})
	}
}

func TestSanitizeTaskSuggestion_EmptyInputStaysEmpty(t *testing.T) {
	clean := sanitizeTaskSuggestion(TaskFieldSuggestionLocal{}, []string{primitive.NewObjectID().Hex()})

	assert.Nil(t, clean.CategoryID)
	assert.Nil(t, clean.Priority)
	assert.Nil(t, clean.Value)
}
