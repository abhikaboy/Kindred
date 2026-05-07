package auth

import (
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/stretchr/testify/assert"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestTimezoneOrDefault_Empty(t *testing.T) {
	assert.Equal(t, "UTC", timezoneOrDefault(""))
}

func TestTimezoneOrDefault_Set(t *testing.T) {
	assert.Equal(t, "America/New_York", timezoneOrDefault("America/New_York"))
}

func TestBuildSafeUserResponse(t *testing.T) {
	userID := primitive.NewObjectID()
	user := &User{
		ID:              userID,
		DisplayName:     "Test User",
		Handle:          "testuser",
		ProfilePicture:  "https://example.com/pic.jpg",
		Categories:      []types.CategoryDocument{{Name: "Work"}},
		Friends:         []primitive.ObjectID{primitive.NewObjectID()},
		TasksComplete:   5,
		RecentActivity:  []types.ActivityDocument{},
		Encouragements:  2,
		Congratulations: 2,
		Streak:          3,
		StreakEligible:  true,
		Points:          100,
		PostsMade:       10,
	}

	result := buildSafeUserResponse(user)

	assert.Equal(t, userID, result.ID)
	assert.Equal(t, "Test User", result.DisplayName)
	assert.Equal(t, "testuser", result.Handle)
	assert.Equal(t, "https://example.com/pic.jpg", result.ProfilePicture)
	assert.Equal(t, 1, len(result.Categories))
	assert.Equal(t, 1, len(result.Friends))
	assert.Equal(t, float64(5), result.TasksComplete)
	assert.Equal(t, 2, result.Encouragements)
	assert.Equal(t, 2, result.Congratulations)
	assert.Equal(t, 3, result.Streak)
	assert.True(t, result.StreakEligible)
	assert.Equal(t, 100, result.Points)
	assert.Equal(t, 10, result.PostsMade)
}
