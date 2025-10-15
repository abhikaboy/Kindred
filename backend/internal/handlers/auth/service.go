package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

/*
Health Service to be used by Health Handler to interact with the
Database layer of the application
*/

func (s *Service) GenerateToken(id string, exp int64, count float64) (string, error) {
	t := jwt.NewWithClaims(jwt.SigningMethodHS256,
		jwt.MapClaims{
			"iss":     "dev-server",
			"sub":     "",
			"user_id": id,
			"role":    "user",
			"iat":     time.Now().Unix(),
			"exp":     exp,
			"count":   count,
		})
	// configure to use config in /internal/config/config.go
	return t.SignedString([]byte(s.config.Auth.Secret))
}

func (s *Service) GenerateAccessToken(id string, count float64) (string, error) {
	return s.GenerateToken(id, time.Now().Add(time.Hour*1).Unix(), count)
}

func (s *Service) GetUserCount(id primitive.ObjectID) (float64, error) {
	var user User

	err := s.users.FindOne(context.Background(), bson.M{"_id": id}).Decode(&user)
	if err != nil {
		return 0, err
	}
	return user.Count, nil
}

func (s *Service) ValidateToken(token string) (string, float64, error) {
	t, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fiber.NewError(400, "Not Authorized")
		}
		return []byte(s.config.Auth.Secret), nil
	})

	if err != nil {
		return "", 0, err
	}
	claims, ok := t.Claims.(jwt.MapClaims)

	fmt.Println(claims)
	idString := claims["user_id"].(string)

	id, err := primitive.ObjectIDFromHex(idString)
	if err != nil {
		return "", 0, err
	}
	// count matches the count in the database
	db_count, err := s.GetUserCount(id)
	if err != nil {
		return "", 0, err
	}
	if claims["count"].(float64) != db_count {
		return "", 0, fiber.NewError(400, "Not Authorized, Revoked Token")
	}

	if !ok || !t.Valid {
		return claims["user_id"].(string), 0, fiber.NewError(400, "Not Authorized, Invalid Token")
	}
	return claims["user_id"].(string), claims["count"].(float64), nil
}

func (s *Service) LoginFromCredentials(email string, password string) (*primitive.ObjectID, *float64, *User, error) {

	var user User
	err := s.users.FindOne(context.Background(), bson.M{"email": email}).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil, nil, fiber.NewError(404, "Account does not exist")
	}
	if err != nil {
		return nil, nil, nil, err
	}

	// Compare the hashed password with the provided password
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return nil, nil, nil, fiber.NewError(400, "Not Authorized, Invalid Credentials")
	}

	return &user.ID, &user.Count, &user, nil
}

func (s *Service) LoginFromPhone(phoneNumber string, password string) (*primitive.ObjectID, *float64, *User, error) {

	var user User
	err := s.users.FindOne(context.Background(), bson.M{"phone": phoneNumber}).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil, nil, fiber.NewError(404, "Account does not exist")
	}
	if err != nil {
		return nil, nil, nil, err
	}

	// Compare the hashed password with the provided password
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return nil, nil, nil, fiber.NewError(400, "Not Authorized, Invalid Credentials")
	}

	return &user.ID, &user.Count, &user, nil
}

func (s *Service) LoginFromApple(apple_id string) (*primitive.ObjectID, *float64, *User, error) {

	var user User
	err := s.users.FindOne(context.Background(), bson.M{"apple_id": apple_id}).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil, nil, fiber.NewError(404, "Account does not exist, Try to register")
	}
	if err != nil {
		return nil, nil, nil, err
	}
	return &user.ID, &user.Count, &user, nil
}

func (s *Service) LoginFromGoogle(google_id string) (*primitive.ObjectID, *float64, *User, error) {

	var user User
	err := s.users.FindOne(context.Background(), bson.M{"google_id": google_id}).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil, nil, fiber.NewError(404, "Account does not exist, Try to register")
	}
	if err != nil {
		return nil, nil, nil, err
	}
	return &user.ID, &user.Count, &user, nil
}

func (s *Service) InvalidateTokens(user_id string) error {
	// increase the count by one
	_, err := s.users.UpdateOne(context.Background(), bson.M{"_id": user_id}, bson.M{"$inc": bson.M{"count": 1}})
	return err
}

func (s *Service) GenerateRefreshToken(id string, count float64) (string, error) {
	const toMonth = 24 * 7 * 30
	return s.GenerateToken(id, time.Now().Add(time.Hour*toMonth).Unix(), count)
}

func (s *Service) UseToken(user_id string) error {
	_, err := s.users.UpdateOne(context.Background(), bson.M{"_id": user_id}, bson.M{"$set": bson.M{"token_used": true}})
	return err
}

func (s *Service) CheckIfTokenUsed(user_id primitive.ObjectID) (bool, error) {
	var user User

	err := s.users.FindOne(context.Background(), bson.M{"_id": user_id}).Decode(&user)
	if err != nil {
		return false, err
	}
	return user.TokenUsed, nil
}

func (s *Service) GenerateTokens(id string, count float64) (string, string, error) {
	access, err := s.GenerateAccessToken(id, count)
	if err != nil {
		return "", "", err
	}
	refresh, err := s.GenerateRefreshToken(id, count)
	if err != nil {
		return "", "", err
	}
	return access, refresh, err
}

func (s *Service) GetUser(user_id string) (*SafeUser, error) {
	var user SafeUser
	// convert the user_id to a primitive.ObjectID
	user_id_object, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, err
	}
	err = s.users.FindOne(context.Background(), bson.M{"_id": user_id_object}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

/*
	Create a new user in the database
*/

func (s *Service) CreateUser(user User) error {
	_, err := s.users.InsertOne(context.Background(), user)
	return err
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
	_, err := s.users.UpdateOne(context.Background(), bson.M{"_id": user_id}, bson.M{"$set": bson.M{"push_token": push_token}})
	return err
}

/*
	Send OTP via Sinch SMS verification API
	This method makes an async/non-blocking HTTP request to Sinch
*/

func (s *Service) SendOTP(ctx context.Context, phoneNumber string) (string, error) {
	return s.sendOTPAsync(ctx, phoneNumber)
}

/*
	Verify OTP via Sinch SMS verification API
	This method makes an async/non-blocking HTTP request to Sinch
	Returns: valid (bool), status (string), error
*/

func (s *Service) VerifyOTP(ctx context.Context, phoneNumber string, code string) (bool, string, error) {
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
	_, err := s.users.UpdateMany(
		ctx,
		bson.M{"friends": userID},
		bson.M{"$pull": bson.M{"friends": userID}},
	)
	if err != nil {
		return fmt.Errorf("failed to remove user from friends lists: %w", err)
	}

	// 2. Delete all connection documents where user is involved
	connectionsCollection := s.users.Database().Collection("friend-requests")
	_, err = connectionsCollection.DeleteMany(
		ctx,
		bson.M{"users": userID},
	)
	if err != nil {
		return fmt.Errorf("failed to delete connection documents: %w", err)
	}

	// 3. Delete all categories (and their tasks) belonging to the user
	categoriesCollection := s.users.Database().Collection("categories")
	_, err = categoriesCollection.DeleteMany(
		ctx,
		bson.M{"user": userID},
	)
	if err != nil {
		return fmt.Errorf("failed to delete user categories: %w", err)
	}

	// 4. Delete all template tasks belonging to the user
	templateTasksCollection := s.users.Database().Collection("template-tasks")
	_, err = templateTasksCollection.DeleteMany(
		ctx,
		bson.M{"user": userID},
	)
	if err != nil {
		return fmt.Errorf("failed to delete user template tasks: %w", err)
	}

	// 5. Delete the user document itself
	result, err := s.users.DeleteOne(
		ctx,
		bson.M{"_id": userID},
	)
	if err != nil {
		return fmt.Errorf("failed to delete user account: %w", err)
	}

	if result.DeletedCount == 0 {
		return fmt.Errorf("user not found")
	}

	return nil
}
