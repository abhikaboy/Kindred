package auth

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/internal/repository"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

// Test account for Apple App Store review — bypasses Sinch SMS verification
const (
	testReviewPhone = "+15551234567"
	testReviewOTP   = "1234"
)

/*
Health Service to be used by Health Handler to interact with the
Database layer of the application
*/

func (s *Service) GenerateToken(id string, exp int64, count float64, timezone string) (string, error) {
	t := jwt.NewWithClaims(jwt.SigningMethodHS256,
		jwt.MapClaims{
			"iss":      "dev-server",
			"sub":      "",
			"user_id":  id,
			"role":     "user",
			"iat":      time.Now().Unix(),
			"exp":      exp,
			"count":    count,
			"timezone": timezone,
		})
	// configure to use config in /internal/config/config.go
	return t.SignedString([]byte(s.config.Auth.Secret))
}

func (s *Service) GenerateAccessToken(id string, count float64, timezone string) (string, error) {
	return s.GenerateToken(id, time.Now().Add(time.Hour*1).Unix(), count, timezone)
}

func (s *Service) GetUserCount(id primitive.ObjectID) (float64, error) {
	return s.users.CheckTokenCount(context.Background(), id)
}

func (s *Service) ValidateToken(token string) (string, float64, string, error) {
	t, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fiber.NewError(400, "Not Authorized")
		}
		return []byte(s.config.Auth.Secret), nil
	})

	if err != nil {
		return "", 0, "", err
	}
	claims, ok := t.Claims.(jwt.MapClaims)
	if !ok || !t.Valid {
		return "", 0, "", fiber.NewError(400, "Not Authorized, Invalid Token")
	}

	fmt.Println(claims)

	idString, ok := claims["user_id"].(string)
	if !ok {
		return "", 0, "", fiber.NewError(400, "Not Authorized, Invalid user_id in token")
	}

	id, err := primitive.ObjectIDFromHex(idString)
	if err != nil {
		return "", 0, "", err
	}
	// count matches the count in the database
	db_count, err := s.GetUserCount(id)
	if err != nil {
		return "", 0, "", err
	}

	tokenCount, ok := claims["count"].(float64)
	if !ok {
		return "", 0, "", fiber.NewError(400, "Not Authorized, Invalid count in token")
	}

	if tokenCount != db_count {
		return "", 0, "", fiber.NewError(400, "Not Authorized, Revoked Token")
	}

	// Extract timezone from token (optional for backward compatibility)
	timezone := ""
	if tz, ok := claims["timezone"].(string); ok {
		timezone = tz
	}

	return idString, tokenCount, timezone, nil
}

func (s *Service) LoginFromCredentials(email string, password string) (*primitive.ObjectID, *float64, *User, error) {
	user, err := s.users.GetUserByEmail(context.Background(), email)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, nil, nil, fiber.NewError(404, "Account does not exist")
		}
		return nil, nil, nil, err
	}
	// Compare the hashed password with the provided password
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return nil, nil, nil, fiber.NewError(400, "Not Authorized, Invalid Credentials")
	}
	return &user.ID, &user.Count, user, nil
}

func (s *Service) LoginFromPhone(phoneNumber string, password string) (*primitive.ObjectID, *float64, *User, error) {
	user, err := s.users.GetUserByPhone(context.Background(), phoneNumber)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, nil, nil, fiber.NewError(404, "Account does not exist")
		}
		return nil, nil, nil, err
	}
	// Compare the hashed password with the provided password
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return nil, nil, nil, fiber.NewError(400, "Not Authorized, Invalid Credentials")
	}
	return &user.ID, &user.Count, user, nil
}

func (s *Service) LoginFromApple(apple_id string) (*primitive.ObjectID, *float64, *User, error) {
	user, err := s.users.GetUserByAppleID(context.Background(), apple_id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, nil, nil, fiber.NewError(404, "Account does not exist")
		}
		return nil, nil, nil, err
	}
	return &user.ID, &user.Count, user, nil
}

func (s *Service) LoginFromGoogle(google_id string) (*primitive.ObjectID, *float64, *User, error) {
	user, err := s.users.GetUserByGoogleID(context.Background(), google_id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, nil, nil, fiber.NewError(404, "Account does not exist")
		}
		return nil, nil, nil, err
	}
	return &user.ID, &user.Count, user, nil
}

func (s *Service) LoginFromPhoneOTP(phone_number string) (*primitive.ObjectID, *float64, *User, error) {
	user, err := s.users.GetUserByPhone(context.Background(), phone_number)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, nil, nil, fiber.NewError(404, "Account does not exist")
		}
		return nil, nil, nil, err
	}
	return &user.ID, &user.Count, user, nil
}

func (s *Service) InvalidateTokens(user_id string) error {
	id, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return err
	}
	return s.users.IncrementUserCount(context.Background(), id)
}

func (s *Service) GenerateRefreshToken(id string, count float64, timezone string) (string, error) {
	const toMonth = 24 * 7 * 30
	return s.GenerateToken(id, time.Now().Add(time.Hour*toMonth).Unix(), count, timezone)
}

func (s *Service) UseToken(user_id string) error {
	id, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return err
	}
	return s.users.MarkTokenUsed(context.Background(), id)
}

func (s *Service) CheckIfTokenUsed(user_id primitive.ObjectID) (bool, error) {
	return s.users.CheckIfTokenUsed(context.Background(), user_id)
}

func (s *Service) GenerateTokens(id string, count float64, timezone string) (string, string, error) {
	access, err := s.GenerateAccessToken(id, count, timezone)
	if err != nil {
		return "", "", err
	}
	refresh, err := s.GenerateRefreshToken(id, count, timezone)
	if err != nil {
		return "", "", err
	}
	return access, refresh, err
}

func (s *Service) GetUser(user_id string) (*SafeUser, error) {
	// convert the user_id to a primitive.ObjectID
	user_id_object, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, err
	}
	user, err := s.users.GetUserByID(context.Background(), user_id_object)
	if err != nil {
		return nil, err
	}
	safeUser := SafeUser{
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
		Credits:         user.Credits,
		KudosRewards:    user.KudosRewards,
		Subscription:    user.Subscription,
		Timezone:        user.Timezone,
		Settings:        user.Settings,
		TermsAcceptedAt: user.TermsAcceptedAt,
		TermsVersion:    user.TermsVersion,
	}
	return &safeUser, nil
}

/*
Create a new user in the database
*/

func (s *Service) CreateUser(user User) error {
	return s.users.CreateUser(context.Background(), &user)
}

/*
Setup default workspace with starter tasks for a new user
*/

func (s *Service) SetupDefaultWorkspace(ctx context.Context, userID primitive.ObjectID) error {
	// Import the task package to create tasks
	workspaceName := "🌺 Kindred Guide"
	now := time.Now().UTC()

	// Define categories with their respective tasks
	categoriesData := []struct {
		name  string
		tasks []types.TaskDocument
	}{
		{
			name: "Starting",
			tasks: []types.TaskDocument{
				{
					ID:         primitive.NewObjectID(),
					Content:    "Swipe to mark a task as complete",
					Priority:   1,
					Value:      1,
					Active:     true,
					Public:     false,
					Recurring:  false,
					Timestamp:  now,
					LastEdited: now,
					StartDate:  &now,
					UserID:     userID,
				},
				{
					ID:         primitive.NewObjectID(),
					Content:    "Tap to view details about a task",
					Priority:   1,
					Value:      1,
					Active:     true,
					Public:     false,
					Recurring:  false,
					Timestamp:  now,
					LastEdited: now,
					StartDate:  &now,
					UserID:     userID,
				},
				{
					ID:         primitive.NewObjectID(),
					Content:    "Click the plus sign next to category to create a new task",
					Priority:   1,
					Value:      1,
					Active:     true,
					Public:     false,
					Recurring:  false,
					Timestamp:  now,
					LastEdited: now,
					StartDate:  &now,
					UserID:     userID,
				},
			},
		},
		{
			name: "Tasks",
			tasks: []types.TaskDocument{
				{
					ID:         primitive.NewObjectID(),
					Content:    "Set a task with a deadline",
					Priority:   2,
					Value:      2,
					Active:     true,
					Public:     false,
					Recurring:  false,
					Timestamp:  now,
					LastEdited: now,
					StartDate:  &now,
					UserID:     userID,
				},
				{
					ID:         primitive.NewObjectID(),
					Content:    "Create a task with a reminder",
					Priority:   2,
					Value:      2,
					Active:     true,
					Public:     false,
					Recurring:  false,
					Timestamp:  now,
					LastEdited: now,
					StartDate:  &now,
					UserID:     userID,
				},
				{
					ID:         primitive.NewObjectID(),
					Content:    "Swipe to make your first post",
					Priority:   2,
					Value:      2,
					Active:     true,
					Public:     true,
					Recurring:  false,
					Timestamp:  now,
					LastEdited: now,
					StartDate:  &now,
					UserID:     userID,
				},
			},
		},
		{
			name: "Blueprint",
			tasks: []types.TaskDocument{
				{
					ID:         primitive.NewObjectID(),
					Content:    "Explore Blueprints to find pre-made habit routines",
					Priority:   2,
					Value:      2,
					Active:     true,
					Public:     false,
					Recurring:  false,
					Timestamp:  now,
					LastEdited: now,
					StartDate:  &now,
					UserID:     userID,
				},
				{
					ID:         primitive.NewObjectID(),
					Content:    "Subscribe to a Blueprint to add it to your workspaces",
					Priority:   2,
					Value:      2,
					Active:     true,
					Public:     false,
					Recurring:  false,
					Timestamp:  now,
					LastEdited: now,
					StartDate:  &now,
					UserID:     userID,
				},
			},
		},
		{
			name: "Social",
			tasks: []types.TaskDocument{
				{
					ID:         primitive.NewObjectID(),
					Content:    "Add your friends!",
					Priority:   3,
					Value:      3,
					Active:     true,
					Public:     false,
					Recurring:  false,
					Timestamp:  now,
					LastEdited: now,
					StartDate:  &now,
					UserID:     userID,
				},
				{
					ID:         primitive.NewObjectID(),
					Content:    "Share Kindred!",
					Priority:   3,
					Value:      3,
					Active:     true,
					Public:     false,
					Recurring:  false,
					Timestamp:  now,
					LastEdited: now,
					StartDate:  &now,
					UserID:     userID,
				},
			},
		},
	}

	// Create each category with its tasks
	for _, cat := range categoriesData {
		categoryDoc := types.CategoryDocument{
			ID:            primitive.NewObjectID(),
			Name:          cat.name,
			WorkspaceName: workspaceName,
			User:          userID,
			Tasks:         cat.tasks,
			LastEdited:    now,
		}

		// Set CategoryID for all tasks in this category
		for i := range categoryDoc.Tasks {
			categoryDoc.Tasks[i].CategoryID = categoryDoc.ID
		}

		_, err := s.categories.InsertOne(ctx, categoryDoc)
		if err != nil {
			// Log error but continue creating other categories
			slog.LogAttrs(ctx, slog.LevelError, "Failed to create category during workspace setup",
				slog.String("categoryName", cat.name),
				slog.String("userId", userID.Hex()),
				slog.String("error", err.Error()))
			continue
		}
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Default workspace setup completed",
		slog.String("userId", userID.Hex()),
		slog.String("workspace", workspaceName))

	return nil
}

/*
Update the push token for a user
*/

func (s *Service) UpdatePushToken(user_id primitive.ObjectID, push_token string) error {
	ctx := context.Background()

	slog.Info("🔄 [Service] UpdatePushToken starting",
		"user_id", user_id.Hex(),
		"push_token_length", len(push_token),
		"push_token_prefix", push_token[:min(10, len(push_token))])

	err := s.users.UpdatePushToken(ctx, user_id, push_token)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			slog.Error("❌ [Service] User not found", "user_id", user_id.Hex())
			return fmt.Errorf("user not found")
		}
		slog.Error("❌ [Service] Error updating push token", "user_id", user_id.Hex(), "error", err)
		return fmt.Errorf("failed to update push token in database: %w", err)
	}

	slog.Info("🎉 [Service] UpdatePushToken completed successfully", "user_id", user_id.Hex())
	return nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

/*
Send OTP via Sinch SMS verification API
This method makes an async/non-blocking HTTP request to Sinch
*/

func (s *Service) SendOTP(ctx context.Context, phoneNumber string) (string, error) {
	if phoneNumber == testReviewPhone {
		slog.Info("Test review phone detected, skipping Sinch OTP send", "phone", phoneNumber)
		return "test-verification-id", nil
	}
	return s.sendOTPAsync(ctx, phoneNumber)
}

/*
Verify OTP via Sinch SMS verification API
This method makes an async/non-blocking HTTP request to Sinch
Returns: valid (bool), status (string), error
*/

func (s *Service) VerifyOTP(ctx context.Context, phoneNumber string, code string) (bool, string, error) {
	if phoneNumber == testReviewPhone && code == testReviewOTP {
		slog.Info("Test review phone OTP verified via bypass", "phone", phoneNumber)
		return true, "SUCCESSFUL", nil
	}
	return s.verifyOTPAsync(ctx, phoneNumber, code)
}

/*
Delete a user account and all associated data
This includes:
  - Removing user from friends lists of all their friends
  - Deleting all connection documents where user is involved
  - Deleting all categories (and their tasks) belonging to the user
  - Deleting all template tasks belonging to the user
  - Finally, deleting the user document itself
*/

func (s *Service) DeleteAccount(ctx context.Context, userID primitive.ObjectID) error {
	// 1. Remove user from friends lists of all users
	err := s.users.RemoveFromFriendsLists(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to remove user from friends lists: %w", err)
	}

	// 2. Delete all connection documents where user is involved
	connectionsCollection := s.categories.Database().Collection("friend-requests")
	_, err = connectionsCollection.DeleteMany(
		ctx,
		bson.M{"users": userID},
	)
	if err != nil {
		return fmt.Errorf("failed to delete connection documents: %w", err)
	}

	// 3. Delete all categories (and their tasks) belonging to the user
	categoriesCollection := s.categories.Database().Collection("categories")
	_, err = categoriesCollection.DeleteMany(
		ctx,
		bson.M{"user": userID},
	)
	if err != nil {
		return fmt.Errorf("failed to delete user categories: %w", err)
	}

	// 4. Delete all template tasks belonging to the user
	templateTasksCollection := s.categories.Database().Collection("template-tasks")
	_, err = templateTasksCollection.DeleteMany(
		ctx,
		bson.M{"user": userID},
	)
	if err != nil {
		return fmt.Errorf("failed to delete user template tasks: %w", err)
	}

	// 5. Delete the user document itself
	err = s.users.DeleteUser(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("user not found")
		}
		return fmt.Errorf("failed to delete user account: %w", err)
	}

	return nil
}

/*
CreateReferralDocumentForUser creates a referral document for a newly registered user
*/
func (s *Service) CreateReferralDocumentForUser(ctx context.Context, userID primitive.ObjectID) error {
	// Only create if referrals collection exists
	if s.referrals == nil {
		slog.LogAttrs(ctx, slog.LevelWarn, "Referrals collection not available, skipping referral document creation")
		return nil
	}

	// Generate referral code using crypto/rand
	bytes := make([]byte, 6)
	if _, err := rand.Read(bytes); err != nil {
		return fmt.Errorf("failed to generate random bytes: %w", err)
	}

	// Encode to base32 and take first 8 characters
	code := strings.ToUpper(base32.StdEncoding.EncodeToString(bytes)[:8])

	// Remove ambiguous characters
	code = strings.Map(func(r rune) rune {
		switch r {
		case '0', 'O':
			return '8'
		case 'I', '1':
			return '7'
		default:
			return r
		}
	}, code)

	now := time.Now()
	referralDoc := bson.M{
		"_id":              primitive.NewObjectID(),
		"userId":           userID,
		"referralCode":     code,
		"unlocksRemaining": 0,
		"referredUsers":    []interface{}{},
		"unlockedFeatures": []interface{}{},
		"referredBy":       nil,
		"metadata": bson.M{
			"createdAt":     now,
			"updatedAt":     now,
			"totalReferred": 0,
		},
	}

	_, err := s.referrals.InsertOne(ctx, referralDoc)
	if err != nil {
		return fmt.Errorf("failed to create referral document: %w", err)
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Created referral document for new user",
		slog.String("userId", userID.Hex()),
		slog.String("referralCode", code))

	return nil
}

// AcceptTerms records the user's acceptance of Terms of Service
func (s *Service) AcceptTerms(ctx context.Context, userID primitive.ObjectID, termsVersion string) (*time.Time, error) {
	return s.users.AcceptTerms(ctx, userID, termsVersion)
}
