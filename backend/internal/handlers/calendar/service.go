package calendar

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/oauth2"
)

type Service struct {
	connections *mongo.Collection
	categories  *mongo.Collection
	providers   map[CalendarProvider]Provider
}

func NewService(connections *mongo.Collection, categories *mongo.Collection, cfg config.Config) *Service {
	providers := map[CalendarProvider]Provider{
		ProviderGoogle: NewGoogleProvider(cfg.GoogleCalendar),
		// Future: ProviderOutlook: NewOutlookProvider(cfg.OutlookCalendar),
	}

	return &Service{
		connections: connections,
		categories:  categories,
		providers:   providers,
	}
}

// InitiateOAuth generates OAuth URL for a provider
func (s *Service) InitiateOAuth(provider CalendarProvider, userID string) (string, error) {
	slog.Info("Initiating OAuth", "provider", provider, "user_id", userID)

	p, ok := s.providers[provider]
	if !ok {
		slog.Error("Unsupported calendar provider", "provider", provider)
		return "", fmt.Errorf("unsupported provider: %s", provider)
	}

	authURL := p.GenerateAuthURL(userID)
	slog.Info("OAuth URL generated", "provider", provider, "user_id", userID)
	return authURL, nil
}

// HandleCallback processes OAuth callback and stores connection
func (s *Service) HandleCallback(ctx context.Context, provider CalendarProvider, code, state string) (*CalendarConnection, error) {
	slog.Info("Handling OAuth callback", "provider", provider, "state", state)

	p, ok := s.providers[provider]
	if !ok {
		slog.Error("Unsupported calendar provider in callback", "provider", provider)
		return nil, fmt.Errorf("unsupported provider: %s", provider)
	}

	// Exchange code for tokens
	slog.Info("Exchanging authorization code for tokens", "provider", provider)
	token, err := p.ExchangeCode(ctx, code)
	if err != nil {
		slog.Error("Failed to exchange code", "provider", provider, "error", err)
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}
	slog.Info("Successfully exchanged code for tokens", "provider", provider, "has_refresh_token", token.RefreshToken != "")

	// Get account info
	slog.Info("Fetching account info", "provider", provider)
	accountInfo, err := p.GetAccountInfo(ctx, token)
	if err != nil {
		slog.Error("Failed to get account info", "provider", provider, "error", err)
		return nil, fmt.Errorf("failed to get account info: %w", err)
	}
	slog.Info("Account info retrieved", "provider", provider, "email", accountInfo.Email)

	// Parse user ID from state
	userID, err := primitive.ObjectIDFromHex(state)
	if err != nil {
		slog.Error("Invalid state parameter", "state", state, "error", err)
		return nil, fmt.Errorf("invalid state: %w", err)
	}

	// Check if connection already exists
	slog.Info("Checking for existing connection", "user_id", userID, "provider", provider, "account", accountInfo.Email)
	var existingConn CalendarConnection
	err = s.connections.FindOne(ctx, bson.M{
		"user_id":             userID,
		"provider":            provider,
		"provider_account_id": accountInfo.Email,
	}).Decode(&existingConn)

	now := time.Now()

	if err == mongo.ErrNoDocuments {
		// Create new connection
		slog.Info("Creating new calendar connection", "user_id", userID, "provider", provider, "account", accountInfo.Email)
		connection := CalendarConnection{
			ID:                primitive.NewObjectID(),
			UserID:            userID,
			Provider:          provider,
			ProviderAccountID: accountInfo.Email,
			AccessToken:       token.AccessToken,
			RefreshToken:      token.RefreshToken,
			TokenExpiry:       token.Expiry,
			Scopes:            []string{}, // TODO: Extract from token
			IsPrimary:         false,      // User can set this later
			CreatedAt:         now,
			UpdatedAt:         now,
		}

		_, err = s.connections.InsertOne(ctx, connection)
		if err != nil {
			slog.Error("Failed to store connection", "user_id", userID, "provider", provider, "error", err)
			return nil, fmt.Errorf("failed to store connection: %w", err)
		}

		slog.Info("Calendar connection created successfully", "connection_id", connection.ID, "user_id", userID, "provider", provider)

		// Create workspace and categories for this connection
		err = s.CreateWorkspaceAndCategories(ctx, &connection, token)
		if err != nil {
			slog.Error("Failed to create workspace and categories", "connection_id", connection.ID, "error", err)
			// Don't fail the connection creation, just log the error
			// User can manually sync later
		}

		return &connection, nil
	} else if err != nil {
		slog.Error("Failed to check existing connection", "user_id", userID, "provider", provider, "error", err)
		return nil, fmt.Errorf("failed to check existing connection: %w", err)
	}

	// Update existing connection
	slog.Info("Updating existing calendar connection", "connection_id", existingConn.ID, "user_id", userID, "provider", provider)
	update := bson.M{
		"$set": bson.M{
			"access_token":  token.AccessToken,
			"refresh_token": token.RefreshToken,
			"token_expiry":  token.Expiry,
			"updated_at":    now,
		},
	}

	_, err = s.connections.UpdateOne(ctx, bson.M{"_id": existingConn.ID}, update)
	if err != nil {
		slog.Error("Failed to update connection", "connection_id", existingConn.ID, "error", err)
		return nil, fmt.Errorf("failed to update connection: %w", err)
	}

	existingConn.AccessToken = token.AccessToken
	existingConn.RefreshToken = token.RefreshToken
	existingConn.TokenExpiry = token.Expiry
	existingConn.UpdatedAt = now

	slog.Info("Calendar connection updated successfully", "connection_id", existingConn.ID, "user_id", userID, "provider", provider)
	return &existingConn, nil
}

// CreateWorkspaceAndCategories creates a workspace and categories for each calendar
func (s *Service) CreateWorkspaceAndCategories(ctx context.Context, connection *CalendarConnection, token *oauth2.Token) error {
	slog.Info("Creating workspace and categories", "connection_id", connection.ID, "user_id", connection.UserID)

	// Get provider
	provider, ok := s.providers[connection.Provider]
	if !ok {
		return fmt.Errorf("unsupported provider: %s", connection.Provider)
	}

	// List all calendars
	calendars, err := provider.ListCalendars(ctx, token)
	if err != nil {
		slog.Error("Failed to list calendars", "connection_id", connection.ID, "error", err)
		return fmt.Errorf("failed to list calendars: %w", err)
	}
	slog.Info("Listed calendars", "connection_id", connection.ID, "count", len(calendars))

	// Workspace name with calendar emoji
	workspaceName := "📅 Google Calendar"
	now := time.Now()

	// Create categories for each calendar
	for _, cal := range calendars {
		// Check if category already exists
		integrationKey := fmt.Sprintf("gcal:%s:%s", connection.ID.Hex(), cal.ID)

		var existingCategory struct {
			ID primitive.ObjectID `bson:"_id"`
		}
		err := s.categories.FindOne(ctx, bson.M{
			"user":        connection.UserID,
			"integration": integrationKey,
		}).Decode(&existingCategory)

		if err == nil {
			slog.Info("Category already exists", "calendar_id", cal.ID, "category_id", existingCategory.ID)
			continue
		} else if err != mongo.ErrNoDocuments {
			slog.Error("Failed to check existing category", "calendar_id", cal.ID, "error", err)
			return fmt.Errorf("failed to check existing category: %w", err)
		}

		// Create new category
		category := bson.M{
			"_id":           primitive.NewObjectID(),
			"name":          cal.Name,
			"workspaceName": workspaceName,
			"lastEdited":    now,
			"tasks":         []bson.M{},
			"user":          connection.UserID,
			"integration":   integrationKey,
		}

		_, err = s.categories.InsertOne(ctx, category)
		if err != nil {
			slog.Error("Failed to create category", "calendar_id", cal.ID, "calendar_name", cal.Name, "error", err)
			return fmt.Errorf("failed to create category for calendar %s: %w", cal.Name, err)
		}

		slog.Info("Created category", "calendar_id", cal.ID, "calendar_name", cal.Name, "workspace", workspaceName)
	}

	slog.Info("Workspace and categories created successfully", "connection_id", connection.ID, "workspace", workspaceName, "categories_count", len(calendars))
	return nil
}

// GetConnections retrieves all calendar connections for a user
func (s *Service) GetConnections(ctx context.Context, userID primitive.ObjectID) ([]CalendarConnection, error) {
	slog.Info("Fetching calendar connections", "user_id", userID)

	cursor, err := s.connections.Find(ctx, bson.M{"user_id": userID})
	if err != nil {
		slog.Error("Failed to query connections", "user_id", userID, "error", err)
		return nil, err
	}
	defer cursor.Close(ctx)

	var connections []CalendarConnection
	if err := cursor.All(ctx, &connections); err != nil {
		slog.Error("Failed to decode connections", "user_id", userID, "error", err)
		return nil, err
	}

	slog.Info("Retrieved calendar connections", "user_id", userID, "count", len(connections))
	return connections, nil
}

// DisconnectProvider removes a calendar connection
func (s *Service) DisconnectProvider(ctx context.Context, userID, connectionID primitive.ObjectID) error {
	slog.Info("Disconnecting calendar", "user_id", userID, "connection_id", connectionID)

	result, err := s.connections.DeleteOne(ctx, bson.M{
		"_id":     connectionID,
		"user_id": userID,
	})
	if err != nil {
		slog.Error("Failed to delete connection", "user_id", userID, "connection_id", connectionID, "error", err)
		return fmt.Errorf("failed to delete connection: %w", err)
	}

	if result.DeletedCount == 0 {
		slog.Warn("Connection not found or doesn't belong to user", "user_id", userID, "connection_id", connectionID)
		return fmt.Errorf("connection not found or does not belong to user")
	}

	slog.Info("Calendar disconnected successfully", "user_id", userID, "connection_id", connectionID)
	return nil
}

// getValidToken gets a valid access token, refreshing if necessary
func (s *Service) getValidToken(ctx context.Context, connection *CalendarConnection) (*oauth2.Token, error) {
	slog.Info("Checking token validity", "connection_id", connection.ID, "expiry", connection.TokenExpiry)

	token := &oauth2.Token{
		AccessToken:  connection.AccessToken,
		RefreshToken: connection.RefreshToken,
		Expiry:       connection.TokenExpiry,
	}

	// Check if token is expired or about to expire (within 5 minutes)
	if time.Until(connection.TokenExpiry) < 5*time.Minute {
		slog.Info("Token expired or expiring soon, refreshing", "connection_id", connection.ID)

		provider, ok := s.providers[connection.Provider]
		if !ok {
			return nil, fmt.Errorf("unsupported provider: %s", connection.Provider)
		}

		// Refresh the token
		newToken, err := provider.RefreshToken(ctx, connection.RefreshToken)
		if err != nil {
			slog.Error("Failed to refresh token", "connection_id", connection.ID, "error", err)
			return nil, fmt.Errorf("failed to refresh token: %w", err)
		}

		// Update stored token
		update := bson.M{
			"$set": bson.M{
				"access_token": newToken.AccessToken,
				"token_expiry": newToken.Expiry,
				"updated_at":   time.Now(),
			},
		}
		_, err = s.connections.UpdateOne(ctx, bson.M{"_id": connection.ID}, update)
		if err != nil {
			slog.Error("Failed to update refreshed token", "connection_id", connection.ID, "error", err)
			return nil, fmt.Errorf("failed to update token: %w", err)
		}

		slog.Info("Token refreshed successfully", "connection_id", connection.ID, "new_expiry", newToken.Expiry)
		return newToken, nil
	}

	slog.Info("Token is still valid", "connection_id", connection.ID)
	return token, nil
}

// FetchEvents fetches calendar events from a connection
func (s *Service) FetchEvents(ctx context.Context, connectionID primitive.ObjectID, timeMin, timeMax time.Time) ([]ProviderEvent, error) {
	slog.Info("Fetching calendar events", "connection_id", connectionID, "time_min", timeMin, "time_max", timeMax)

	// Get connection
	var connection CalendarConnection
	err := s.connections.FindOne(ctx, bson.M{"_id": connectionID}).Decode(&connection)
	if err != nil {
		slog.Error("Connection not found", "connection_id", connectionID, "error", err)
		return nil, fmt.Errorf("connection not found: %w", err)
	}

	// Get provider
	provider, ok := s.providers[connection.Provider]
	if !ok {
		return nil, fmt.Errorf("unsupported provider: %s", connection.Provider)
	}

	// Get valid token (refresh if needed)
	token, err := s.getValidToken(ctx, &connection)
	if err != nil {
		return nil, err
	}

	// Fetch events from provider
	events, err := provider.FetchEvents(ctx, token, timeMin, timeMax)
	if err != nil {
		slog.Error("Failed to fetch events", "connection_id", connectionID, "provider", connection.Provider, "error", err)
		return nil, fmt.Errorf("failed to fetch events: %w", err)
	}

	slog.Info("Events fetched successfully", "connection_id", connectionID, "count", len(events))
	return events, nil
}

// SyncResult contains statistics about a sync operation
type SyncResult struct {
	TasksCreated     int
	TasksSkipped     int
	EventsTotal      int
	CategoriesSynced map[string]int // category_name -> task_count
	WorkspaceName    string
}

// SyncEventsToTasks fetches events and creates tasks in appropriate categories
func (s *Service) SyncEventsToTasks(ctx context.Context, connectionID, userID primitive.ObjectID, timeMin, timeMax time.Time) (*SyncResult, error) {
	slog.Info("Starting event sync", "connection_id", connectionID, "user_id", userID, "time_min", timeMin, "time_max", timeMax)

	// Get connection
	var connection CalendarConnection
	err := s.connections.FindOne(ctx, bson.M{
		"_id":     connectionID,
		"user_id": userID,
	}).Decode(&connection)
	if err != nil {
		slog.Error("Connection not found", "connection_id", connectionID, "user_id", userID, "error", err)
		return nil, fmt.Errorf("connection not found: %w", err)
	}

	// Get provider
	provider, ok := s.providers[connection.Provider]
	if !ok {
		return nil, fmt.Errorf("unsupported provider: %s", connection.Provider)
	}

	// Get valid token
	token, err := s.getValidToken(ctx, &connection)
	if err != nil {
		return nil, err
	}

	// Fetch events from all calendars
	events, err := provider.FetchEvents(ctx, token, timeMin, timeMax)
	if err != nil {
		slog.Error("Failed to fetch events", "connection_id", connectionID, "error", err)
		return nil, fmt.Errorf("failed to fetch events: %w", err)
	}
	slog.Info("Fetched events", "connection_id", connectionID, "count", len(events))

	// Group events by calendar
	eventsByCalendar := make(map[string][]ProviderEvent)
	for _, event := range events {
		eventsByCalendar[event.CalendarID] = append(eventsByCalendar[event.CalendarID], event)
	}

	result := &SyncResult{
		EventsTotal:      len(events),
		CategoriesSynced: make(map[string]int),
		WorkspaceName:    "📅 Google Calendar",
	}

	// Process events for each calendar
	for calendarID, calEvents := range eventsByCalendar {
		// Find category by integration field
		integrationKey := fmt.Sprintf("gcal:%s:%s", connectionID.Hex(), calendarID)

		var category struct {
			ID   primitive.ObjectID `bson:"_id"`
			Name string             `bson:"name"`
		}
		err := s.categories.FindOne(ctx, bson.M{
			"user":        userID,
			"integration": integrationKey,
		}).Decode(&category)

		if err != nil {
			if err == mongo.ErrNoDocuments {
				slog.Warn("Category not found for calendar", "calendar_id", calendarID, "integration", integrationKey)
				// Skip events from calendars without categories
				result.TasksSkipped += len(calEvents)
				continue
			}
			slog.Error("Failed to find category", "calendar_id", calendarID, "error", err)
			return nil, fmt.Errorf("failed to find category: %w", err)
		}

		slog.Info("Processing events for calendar", "calendar_id", calendarID, "category_id", category.ID, "category_name", category.Name, "event_count", len(calEvents))

		// Convert and create tasks for this calendar
		tasksCreated := 0
		tasksSkipped := 0

		for _, event := range calEvents {
			// Convert event to task params
			taskParams := ConvertEventToTaskParams(event, userID, category.ID)

			// Create task document
			taskDoc := bson.M{
				"_id":         primitive.NewObjectID(),
				"priority":    taskParams.Priority,
				"content":     taskParams.Content,
				"value":       taskParams.Value,
				"recurring":   taskParams.Recurring,
				"public":      taskParams.Public,
				"active":      taskParams.Active,
				"notes":       taskParams.Notes,
				"integration": taskParams.Integration,
				"checklist":   taskParams.Checklist,
				"reminders":   taskParams.Reminders,
			}

			// Add optional time fields
			if taskParams.StartTime != nil {
				taskDoc["startTime"] = taskParams.StartTime
			}
			if taskParams.StartDate != nil {
				taskDoc["startDate"] = taskParams.StartDate
			}
			if taskParams.Deadline != nil {
				taskDoc["deadline"] = taskParams.Deadline
			}

			// Try to add task to category
			_, err := s.categories.UpdateOne(
				ctx,
				bson.M{"_id": category.ID},
				bson.M{"$push": bson.M{"tasks": taskDoc}},
			)

			if err != nil {
				// Check if it's a duplicate key error
				if mongo.IsDuplicateKeyError(err) {
					slog.Debug("Task already exists, skipping", "event_id", event.ID, "integration", taskParams.Integration)
					tasksSkipped++
				} else {
					slog.Error("Failed to create task", "event_id", event.ID, "category_id", category.ID, "error", err)
					return nil, fmt.Errorf("failed to create task: %w", err)
				}
			} else {
				slog.Debug("Task created", "event_id", event.ID, "category_id", category.ID, "task_content", taskParams.Content)
				tasksCreated++
			}
		}

		result.TasksCreated += tasksCreated
		result.TasksSkipped += tasksSkipped
		result.CategoriesSynced[category.Name] = tasksCreated

		slog.Info("Finished processing calendar", "calendar_id", calendarID, "category_name", category.Name, "created", tasksCreated, "skipped", tasksSkipped)
	}

	// Update last sync time
	_, err = s.connections.UpdateOne(
		ctx,
		bson.M{"_id": connectionID},
		bson.M{"$set": bson.M{"last_sync": time.Now()}},
	)
	if err != nil {
		slog.Error("Failed to update last sync time", "connection_id", connectionID, "error", err)
		// Don't fail the sync, just log the error
	}

	slog.Info("Sync completed", "connection_id", connectionID, "tasks_created", result.TasksCreated, "tasks_skipped", result.TasksSkipped, "events_total", result.EventsTotal)
	return result, nil
}
