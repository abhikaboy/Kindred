package settings_test

import (
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/settings"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/suite"
)

// SettingsServiceTestSuite is the test suite for Settings service
type SettingsServiceTestSuite struct {
	testpkg.BaseSuite
	service *settings.Service
}

// SetupTest runs before each test
func (s *SettingsServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = settings.NewService(s.Collections)
}

// TestSettingsService runs the test suite
func TestSettingsService(t *testing.T) {
	suite.Run(t, new(SettingsServiceTestSuite))
}

// ========================================
// GetUserSettings Tests
// ========================================

func (s *SettingsServiceTestSuite) TestGetUserSettings_Success() {
	user := s.GetUser(0)
	
	settings, err := s.service.GetUserSettings(user.ID)
	
	s.NoError(err)
	s.NotNil(settings)
}

func (s *SettingsServiceTestSuite) TestGetUserSettings_UserNotFound() {
	nonExistentID := testpkg.NewObjectID()
	
	settings, err := s.service.GetUserSettings(nonExistentID)
	
	s.Error(err)
	s.Nil(settings)
}

// ========================================
// UpdateUserSettings Tests
// ========================================

func (s *SettingsServiceTestSuite) TestUpdateUserSettings_Success() {
	user := s.GetUser(0)
	
	newSettings := types.UserSettings{
		Notifications: types.NotificationSettings{
			FriendActivity: true,
			NearDeadlines:  true,
		},
		Display: types.DisplaySettings{
			ShowTaskDetails: true,
		},
	}
	
	err := s.service.UpdateUserSettings(user.ID, newSettings)
	
	s.NoError(err)
	
	// Verify settings were updated
	updatedSettings, err := s.service.GetUserSettings(user.ID)
	s.NoError(err)
	s.True(updatedSettings.Notifications.FriendActivity)
	s.True(updatedSettings.Display.ShowTaskDetails)
}

func (s *SettingsServiceTestSuite) TestUpdateUserSettings_PartialUpdate() {
	user := s.GetUser(0)
	
	// Update only notifications
	partialSettings := types.UserSettings{
		Notifications: types.NotificationSettings{
			FriendPosts: true,
		},
	}
	
	err := s.service.UpdateUserSettings(user.ID, partialSettings)
	
	s.NoError(err)
	
	// Verify notifications were updated
	updatedSettings, err := s.service.GetUserSettings(user.ID)
	s.NoError(err)
	s.True(updatedSettings.Notifications.FriendPosts)
}

func (s *SettingsServiceTestSuite) TestUpdateUserSettings_MultipleFields() {
	user := s.GetUser(0)
	
	newSettings := types.UserSettings{
		Notifications: types.NotificationSettings{
			FriendActivity: true,
			NearDeadlines:  true,
			FriendPosts:    true,
		},
		Display: types.DisplaySettings{
			ShowTaskDetails:     true,
			RecentWorkspaces:    true,
			FriendActivityFeed:  true,
		},
	}
	
	err := s.service.UpdateUserSettings(user.ID, newSettings)
	
	s.NoError(err)
	
	// Verify all settings were updated
	updatedSettings, err := s.service.GetUserSettings(user.ID)
	s.NoError(err)
	s.True(updatedSettings.Notifications.FriendActivity)
	s.True(updatedSettings.Notifications.NearDeadlines)
	s.True(updatedSettings.Display.ShowTaskDetails)
	s.True(updatedSettings.Display.RecentWorkspaces)
}
