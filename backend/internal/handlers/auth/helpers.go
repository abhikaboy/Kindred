package auth

import "github.com/abhikaboy/Kindred/internal/handlers/types"

// buildSafeUserResponse converts a full User to a SafeUser for API responses.
// This is the single source of truth for the user fields exposed in login/register responses.
func buildSafeUserResponse(user *User) types.SafeUser {
	return types.SafeUser{
		ID:              user.ID,
		DisplayName:     user.DisplayName,
		Handle:          user.Handle,
		ProfilePicture:  user.ProfilePicture,
		Categories:      user.Categories,
		Friends:         user.Friends,
		TasksComplete:   user.TasksComplete,
		RecentActivity:  user.RecentActivity,
		Encouragements:  user.Encouragements,
		Congratulations: user.Congratulations,
		Streak:          user.Streak,
		StreakEligible:  user.StreakEligible,
		Points:          user.Points,
		PostsMade:       user.PostsMade,
	}
}
