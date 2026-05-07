package auth

import "github.com/abhikaboy/Kindred/internal/handlers/types"

// timezoneOrDefault returns the timezone string, defaulting to "UTC" if empty.
func timezoneOrDefault(tz string) string {
	if tz == "" {
		return "UTC"
	}
	return tz
}

// completeLogin generates tokens and builds the auth response for a successful login.
// This is the shared tail for all LoginWith* handler methods.
func completeLogin(service *Service, userID string, count float64, user *User) (*AuthResult, error) {
	timezone := timezoneOrDefault(user.Timezone)

	access, refresh, err := service.GenerateTokens(userID, count, timezone)
	if err != nil {
		return nil, err
	}

	return &AuthResult{
		AccessToken:  access,
		RefreshToken: refresh,
		User:         buildSafeUserResponse(user),
	}, nil
}

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
