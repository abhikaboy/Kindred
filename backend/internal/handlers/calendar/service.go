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
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/oauth2"
)

type Service struct {
	connections     *mongo.Collection
	categories      *mongo.Collection
	processedEvents *mongo.Collection
	providers       map[CalendarProvider]Provider
	config          config.Config
}

func NewService(connections *mongo.Collection, categories *mongo.Collection, cfg config.Config) *Service {
	providers := map[CalendarProvider]Provider{
		ProviderGoogle: NewGoogleProvider(cfg.GoogleCalendar),
		// Future: ProviderOutlook: NewOutlookProvider(cfg.OutlookCalendar),
	}

	// Get processed events collection from the same database
	processedEvents := connections.Database().Collection("calendar_processed_events")

	return &Service{
		connections:     connections,
		categories:      categories,
		processedEvents: processedEvents,
		providers:       providers,
		config:          cfg,
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
	slog.Info("Successfully exchanged code for tokens",
		"provider", provider,
		"has_refresh_token", token.RefreshToken != "",
		"has_access_token", token.AccessToken != "",
		"token_expiry", token.Expiry,
		"token_type", token.TokenType)

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

		slog.Info("Calendar connection created successfully",
			"connection_id", connection.ID,
			"user_id", userID,
			"provider", provider,
			"has_access_token", connection.AccessToken != "",
			"has_refresh_token", connection.RefreshToken != "",
			"token_expiry", connection.TokenExpiry)

		// Workspace creation is now user-driven via the /setup endpoint.
		// The frontend will show a setup modal after OAuth completes.

		// Setup watch channels for real-time notifications (Google only for now)
		if provider == ProviderGoogle {
			err = s.SetupWatchChannels(ctx, &connection, token, s.config.GoogleCalendar.WebhookBaseURL)
			if err != nil {
				slog.Error("Failed to setup watch channels", "connection_id", connection.ID, "error", err)
				// Don't fail the connection creation, user can still manually sync
			}
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

	// Setup watch channels if not already set up (Google only for now)
	if provider == ProviderGoogle && len(existingConn.WatchChannels) == 0 {
		err = s.SetupWatchChannels(ctx, &existingConn, token, s.config.GoogleCalendar.WebhookBaseURL)
		if err != nil {
			slog.Error("Failed to setup watch channels", "connection_id", existingConn.ID, "error", err)
			// Don't fail the connection update
		}
	}

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

// ListCalendarsForConnection retrieves all calendars available for a connection
func (s *Service) ListCalendarsForConnection(ctx context.Context, connectionID, userID primitive.ObjectID) ([]CalendarInfo, error) {
	slog.Info("Listing calendars for connection", "connection_id", connectionID, "user_id", userID)

	var connection CalendarConnection
	err := s.connections.FindOne(ctx, bson.M{
		"_id":     connectionID,
		"user_id": userID,
	}).Decode(&connection)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("connection not found or does not belong to user")
		}
		return nil, fmt.Errorf("failed to find connection: %w", err)
	}

	provider, ok := s.providers[connection.Provider]
	if !ok {
		return nil, fmt.Errorf("unsupported provider: %s", connection.Provider)
	}

	token, err := s.getValidToken(ctx, &connection)
	if err != nil {
		return nil, err
	}

	calendars, err := provider.ListCalendars(ctx, token)
	if err != nil {
		slog.Error("Failed to list calendars", "connection_id", connectionID, "error", err)
		return nil, fmt.Errorf("failed to list calendars: %w", err)
	}

	slog.Info("Listed calendars for connection", "connection_id", connectionID, "count", len(calendars))
	return calendars, nil
}

// SetupWorkspacesForConnection creates workspaces and categories for selected calendars
func (s *Service) SetupWorkspacesForConnection(ctx context.Context, connectionID, userID primitive.ObjectID, calendarIDs []string, mergeIntoOne bool) error {
	slog.Info("Setting up workspaces for connection", "connection_id", connectionID, "user_id", userID, "calendar_count", len(calendarIDs), "merge_into_one", mergeIntoOne)

	var connection CalendarConnection
	err := s.connections.FindOne(ctx, bson.M{
		"_id":     connectionID,
		"user_id": userID,
	}).Decode(&connection)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return fmt.Errorf("connection not found or does not belong to user")
		}
		return fmt.Errorf("failed to find connection: %w", err)
	}

	provider, ok := s.providers[connection.Provider]
	if !ok {
		return fmt.Errorf("unsupported provider: %s", connection.Provider)
	}

	token, err := s.getValidToken(ctx, &connection)
	if err != nil {
		return err
	}

	// List all calendars and filter to selected ones
	allCalendars, err := provider.ListCalendars(ctx, token)
	if err != nil {
		return fmt.Errorf("failed to list calendars: %w", err)
	}

	// Build a set of selected calendar IDs for fast lookup
	selectedSet := make(map[string]bool, len(calendarIDs))
	for _, id := range calendarIDs {
		selectedSet[id] = true
	}

	now := time.Now()

	for _, cal := range allCalendars {
		if !selectedSet[cal.ID] {
			continue
		}

		// Determine workspace name
		workspaceName := "📅 Google Calendar"
		if !mergeIntoOne {
			workspaceName = cal.Name
		}

		integrationKey := fmt.Sprintf("gcal:%s:%s", connectionID.Hex(), cal.ID)

		// Skip if category already exists
		var existing struct {
			ID primitive.ObjectID `bson:"_id"`
		}
		err := s.categories.FindOne(ctx, bson.M{
			"user":        userID,
			"integration": integrationKey,
		}).Decode(&existing)

		if err == nil {
			slog.Info("Category already exists, skipping", "calendar_id", cal.ID, "category_id", existing.ID)
			continue
		} else if err != mongo.ErrNoDocuments {
			return fmt.Errorf("failed to check existing category for %s: %w", cal.Name, err)
		}

		category := bson.M{
			"_id":           primitive.NewObjectID(),
			"name":          cal.Name,
			"workspaceName": workspaceName,
			"lastEdited":    now,
			"tasks":         []bson.M{},
			"user":          userID,
			"integration":   integrationKey,
		}

		_, err = s.categories.InsertOne(ctx, category)
		if err != nil {
			return fmt.Errorf("failed to create category for calendar %s: %w", cal.Name, err)
		}

		slog.Info("Created category for calendar", "calendar_id", cal.ID, "calendar_name", cal.Name, "workspace", workspaceName)
	}

	slog.Info("Workspace setup complete", "connection_id", connectionID, "calendars_requested", len(calendarIDs))
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

	// First, get the connection to stop watch channels
	var connection CalendarConnection
	err := s.connections.FindOne(ctx, bson.M{
		"_id":     connectionID,
		"user_id": userID,
	}).Decode(&connection)

	if err == mongo.ErrNoDocuments {
		slog.Warn("Connection not found or doesn't belong to user", "user_id", userID, "connection_id", connectionID)
		return fmt.Errorf("connection not found or does not belong to user")
	} else if err != nil {
		slog.Error("Failed to find connection", "user_id", userID, "connection_id", connectionID, "error", err)
		return fmt.Errorf("failed to find connection: %w", err)
	}

	// Stop watch channels before deleting
	if len(connection.WatchChannels) > 0 {
		err = s.StopWatchChannels(ctx, &connection)
		if err != nil {
			slog.Error("Failed to stop watch channels", "connection_id", connectionID, "error", err)
			// Continue with deletion anyway
		}
	}

	// Delete the connection
	result, err := s.connections.DeleteOne(ctx, bson.M{
		"_id":     connectionID,
		"user_id": userID,
	})
	if err != nil {
		slog.Error("Failed to delete connection", "user_id", userID, "connection_id", connectionID, "error", err)
		return fmt.Errorf("failed to delete connection: %w", err)
	}

	if result.DeletedCount == 0 {
		slog.Warn("Connection not found during deletion", "user_id", userID, "connection_id", connectionID)
		return fmt.Errorf("connection not found during deletion")
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
	TasksDeleted     int
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

			// Check if this event has already been processed using the dedicated collection
			// We need to check if the event_id exists in the event_ids array
			count, err := s.processedEvents.CountDocuments(ctx, bson.M{
				"user_id":       userID,
				"connection_id": connectionID,
				"event_ids":     bson.M{"$in": []string{taskParams.Integration}},
			})

			if err != nil {
				slog.Error("Failed to check processed events", "event_id", event.ID, "error", err)
				return nil, fmt.Errorf("failed to check processed events: %w", err)
			}

			if count > 0 {
				// Event already processed, skip it
				slog.Debug("Event already processed, skipping", "event_id", event.ID, "integration", taskParams.Integration)
				tasksSkipped++
				continue
			}

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

			// Add task to category
			_, err = s.categories.UpdateOne(
				ctx,
				bson.M{"_id": category.ID},
				bson.M{"$push": bson.M{"tasks": taskDoc}},
			)

			if err != nil {
				slog.Error("Failed to create task", "event_id", event.ID, "category_id", category.ID, "error", err)
				return nil, fmt.Errorf("failed to create task: %w", err)
			}

			// Mark event as processed in the dedicated collection
			now := time.Now()
			_, err = s.processedEvents.UpdateOne(
				ctx,
				bson.M{
					"user_id":       userID,
					"connection_id": connectionID,
				},
				bson.M{
					"$addToSet": bson.M{"event_ids": taskParams.Integration},
					"$set":      bson.M{"updated_at": now},
					"$setOnInsert": bson.M{
						"created_at": now,
					},
				},
				options.Update().SetUpsert(true),
			)

			if err != nil {
				slog.Error("Failed to mark event as processed", "event_id", event.ID, "integration", taskParams.Integration, "error", err)
				// Don't fail the sync, just log the error
			}

			slog.Debug("Task created", "event_id", event.ID, "category_id", category.ID, "task_content", taskParams.Content)
			tasksCreated++
		}

		result.TasksCreated += tasksCreated
		result.TasksSkipped += tasksSkipped
		result.CategoriesSynced[category.Name] = tasksCreated

		slog.Info("Finished processing calendar", "calendar_id", calendarID, "category_name", category.Name, "created", tasksCreated, "skipped", tasksSkipped)
	}

	// Detect and delete tasks for events that no longer exist
	tasksDeleted, err := s.deleteTasksForMissingEvents(ctx, connectionID, userID, events)
	if err != nil {
		slog.Error("Failed to delete tasks for missing events", "connection_id", connectionID, "error", err)
		// Don't fail the sync, just log the error
	} else {
		result.TasksDeleted = tasksDeleted
		slog.Info("Deleted tasks for missing events", "connection_id", connectionID, "tasks_deleted", tasksDeleted)
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

	slog.Info("Sync completed", "connection_id", connectionID, "tasks_created", result.TasksCreated, "tasks_skipped", result.TasksSkipped, "tasks_deleted", result.TasksDeleted, "events_total", result.EventsTotal)
	return result, nil
}

// SetupWatchChannels creates watch channels for all calendars in a connection
func (s *Service) SetupWatchChannels(ctx context.Context, connection *CalendarConnection, token *oauth2.Token, webhookBaseURL string) error {
	slog.Info("Setting up watch channels", "connection_id", connection.ID, "provider", connection.Provider)

	p, ok := s.providers[connection.Provider]
	if !ok {
		return fmt.Errorf("unsupported provider: %s", connection.Provider)
	}

	// Get list of calendars
	calendars, err := p.ListCalendars(ctx, token)
	if err != nil {
		slog.Error("Failed to list calendars for watch setup", "connection_id", connection.ID, "error", err)
		return fmt.Errorf("failed to list calendars: %w", err)
	}

	slog.Info("Setting up watches for calendars", "connection_id", connection.ID, "calendar_count", len(calendars))

	// Build webhook URL with connection ID
	webhookURL := fmt.Sprintf("%s/%s", webhookBaseURL, connection.ID.Hex())

	watchChannels := make([]WatchChannel, 0, len(calendars))

	// Create watch channel for each calendar
	for _, cal := range calendars {
		// Generate UUID for channel ID
		channelID := primitive.NewObjectID().Hex()

		slog.Info("Creating watch channel", "connection_id", connection.ID, "calendar_id", cal.ID, "calendar_name", cal.Name, "channel_id", channelID)

		watchResp, err := p.WatchCalendar(ctx, token, cal.ID, channelID, webhookURL)
		if err != nil {
			slog.Error("Failed to create watch channel, continuing with other calendars", "connection_id", connection.ID, "calendar_id", cal.ID, "error", err)
			continue
		}

		watchChannel := WatchChannel{
			CalendarID: cal.ID,
			ChannelID:  watchResp.ChannelID,
			ResourceID: watchResp.ResourceID,
			Expiration: watchResp.Expiration,
			CreatedAt:  time.Now(),
		}

		watchChannels = append(watchChannels, watchChannel)
		slog.Info("Watch channel created successfully", "connection_id", connection.ID, "calendar_id", cal.ID, "channel_id", watchResp.ChannelID, "expiration", watchResp.Expiration)
	}

	// Update connection with watch channels
	if len(watchChannels) > 0 {
		_, err = s.connections.UpdateOne(
			ctx,
			bson.M{"_id": connection.ID},
			bson.M{
				"$set": bson.M{
					"watch_channels": watchChannels,
					"updated_at":     time.Now(),
				},
			},
		)
		if err != nil {
			slog.Error("Failed to update connection with watch channels", "connection_id", connection.ID, "error", err)
			return fmt.Errorf("failed to update connection: %w", err)
		}

		slog.Info("Watch channels saved to database", "connection_id", connection.ID, "watch_count", len(watchChannels))
	}

	return nil
}

// StopWatchChannels stops all watch channels for a connection
func (s *Service) StopWatchChannels(ctx context.Context, connection *CalendarConnection) error {
	slog.Info("Stopping watch channels", "connection_id", connection.ID, "watch_count", len(connection.WatchChannels))

	if len(connection.WatchChannels) == 0 {
		slog.Info("No watch channels to stop", "connection_id", connection.ID)
		return nil
	}

	p, ok := s.providers[connection.Provider]
	if !ok {
		return fmt.Errorf("unsupported provider: %s", connection.Provider)
	}

	// Get fresh token
	token := &oauth2.Token{
		AccessToken:  connection.AccessToken,
		RefreshToken: connection.RefreshToken,
		Expiry:       connection.TokenExpiry,
	}

	// Refresh if needed
	if time.Now().After(connection.TokenExpiry) {
		slog.Info("Refreshing token before stopping watches", "connection_id", connection.ID)
		newToken, err := p.RefreshToken(ctx, connection.RefreshToken)
		if err != nil {
			slog.Error("Failed to refresh token for stopping watches", "connection_id", connection.ID, "error", err)
			// Continue anyway, try to stop with existing token
		} else {
			token = newToken
		}
	}

	// Stop each watch channel
	for _, watch := range connection.WatchChannels {
		slog.Info("Stopping watch channel", "connection_id", connection.ID, "channel_id", watch.ChannelID, "calendar_id", watch.CalendarID)

		err := p.StopWatch(ctx, token, watch.ChannelID, watch.ResourceID)
		if err != nil {
			slog.Error("Failed to stop watch channel, continuing", "connection_id", connection.ID, "channel_id", watch.ChannelID, "error", err)
			// Continue with other channels
			continue
		}

		slog.Info("Watch channel stopped successfully", "connection_id", connection.ID, "channel_id", watch.ChannelID)
	}

	slog.Info("All watch channels processed", "connection_id", connection.ID)
	return nil
}

// RenewWatchChannel renews a single watch channel before it expires
func (s *Service) RenewWatchChannel(ctx context.Context, connection *CalendarConnection, oldChannel WatchChannel, webhookBaseURL string) error {
	slog.Info("Renewing watch channel", "connection_id", connection.ID, "channel_id", oldChannel.ChannelID, "calendar_id", oldChannel.CalendarID)

	p, ok := s.providers[connection.Provider]
	if !ok {
		return fmt.Errorf("unsupported provider: %s", connection.Provider)
	}

	// Get fresh token
	token := &oauth2.Token{
		AccessToken:  connection.AccessToken,
		RefreshToken: connection.RefreshToken,
		Expiry:       connection.TokenExpiry,
	}

	// Refresh if needed
	if time.Now().After(connection.TokenExpiry) {
		slog.Info("Refreshing token for watch renewal", "connection_id", connection.ID)
		newToken, err := p.RefreshToken(ctx, connection.RefreshToken)
		if err != nil {
			slog.Error("Failed to refresh token for watch renewal", "connection_id", connection.ID, "error", err)
			return fmt.Errorf("failed to refresh token: %w", err)
		}
		token = newToken

		// Update connection with new token
		_, err = s.connections.UpdateOne(
			ctx,
			bson.M{"_id": connection.ID},
			bson.M{
				"$set": bson.M{
					"access_token":  newToken.AccessToken,
					"refresh_token": newToken.RefreshToken,
					"token_expiry":  newToken.Expiry,
					"updated_at":    time.Now(),
				},
			},
		)
		if err != nil {
			slog.Error("Failed to update connection with new token", "connection_id", connection.ID, "error", err)
		}
	}

	// Stop old channel
	slog.Info("Stopping old watch channel", "connection_id", connection.ID, "channel_id", oldChannel.ChannelID)
	err := p.StopWatch(ctx, token, oldChannel.ChannelID, oldChannel.ResourceID)
	if err != nil {
		slog.Error("Failed to stop old watch channel", "connection_id", connection.ID, "channel_id", oldChannel.ChannelID, "error", err)
		// Continue anyway to create new channel
	}

	// Create new watch channel
	newChannelID := primitive.NewObjectID().Hex()
	webhookURL := fmt.Sprintf("%s/%s", webhookBaseURL, connection.ID.Hex())

	slog.Info("Creating new watch channel", "connection_id", connection.ID, "new_channel_id", newChannelID, "calendar_id", oldChannel.CalendarID)
	watchResp, err := p.WatchCalendar(ctx, token, oldChannel.CalendarID, newChannelID, webhookURL)
	if err != nil {
		slog.Error("Failed to create new watch channel", "connection_id", connection.ID, "calendar_id", oldChannel.CalendarID, "error", err)
		return fmt.Errorf("failed to create new watch channel: %w", err)
	}

	// Update the watch channel in the database
	newChannel := WatchChannel{
		CalendarID: oldChannel.CalendarID,
		ChannelID:  watchResp.ChannelID,
		ResourceID: watchResp.ResourceID,
		Expiration: watchResp.Expiration,
		CreatedAt:  time.Now(),
	}

	// Replace the old channel with the new one in the array
	_, err = s.connections.UpdateOne(
		ctx,
		bson.M{
			"_id":                       connection.ID,
			"watch_channels.channel_id": oldChannel.ChannelID,
		},
		bson.M{
			"$set": bson.M{
				"watch_channels.$": newChannel,
				"updated_at":       time.Now(),
			},
		},
	)
	if err != nil {
		slog.Error("Failed to update connection with new watch channel", "connection_id", connection.ID, "error", err)
		return fmt.Errorf("failed to update connection: %w", err)
	}

	slog.Info("Watch channel renewed successfully", "connection_id", connection.ID, "new_channel_id", watchResp.ChannelID, "expiration", watchResp.Expiration)
	return nil
}

// deleteTasksForMissingEvents finds and deletes tasks for events that are no longer returned by the API
func (s *Service) deleteTasksForMissingEvents(ctx context.Context, connectionID, userID primitive.ObjectID, currentEvents []ProviderEvent) (int, error) {
	slog.Info("Checking for deleted events", "connection_id", connectionID, "user_id", userID)

	// Get all processed events for this connection
	var processedDoc ProcessedEvents
	err := s.processedEvents.FindOne(ctx, bson.M{
		"user_id":       userID,
		"connection_id": connectionID,
	}).Decode(&processedDoc)

	if err == mongo.ErrNoDocuments {
		// No processed events yet, nothing to delete
		slog.Info("No processed events found, skipping deletion check", "connection_id", connectionID)
		return 0, nil
	} else if err != nil {
		slog.Error("Failed to get processed events", "connection_id", connectionID, "error", err)
		return 0, fmt.Errorf("failed to get processed events: %w", err)
	}

	// Build a set of current event integration IDs
	currentEventIDs := make(map[string]bool)
	for _, event := range currentEvents {
		integrationID := fmt.Sprintf("gcal:%s:%s", event.CalendarID, event.ID)
		currentEventIDs[integrationID] = true
	}

	// Find events that were processed but are no longer in the current events
	missingEventIDs := make([]string, 0)
	for _, processedID := range processedDoc.EventIDs {
		if !currentEventIDs[processedID] {
			missingEventIDs = append(missingEventIDs, processedID)
		}
	}

	if len(missingEventIDs) == 0 {
		slog.Info("No deleted events detected", "connection_id", connectionID)
		return 0, nil
	}

	slog.Info("Detected deleted events", "connection_id", connectionID, "count", len(missingEventIDs), "event_ids", missingEventIDs)

	// Delete tasks with these integration IDs from all categories
	tasksDeleted := 0
	for _, integrationID := range missingEventIDs {
		// Find and remove tasks with this integration ID
		result, err := s.categories.UpdateMany(
			ctx,
			bson.M{
				"user":              userID,
				"tasks.integration": integrationID,
			},
			bson.M{
				"$pull": bson.M{
					"tasks": bson.M{"integration": integrationID},
				},
			},
		)

		if err != nil {
			slog.Error("Failed to delete task for missing event", "integration_id", integrationID, "error", err)
			continue
		}

		if result.ModifiedCount > 0 {
			tasksDeleted += int(result.ModifiedCount)
			slog.Info("Deleted task for missing event", "integration_id", integrationID, "categories_modified", result.ModifiedCount)
		}
	}

	// Remove the missing event IDs from the processed events collection
	if len(missingEventIDs) > 0 {
		_, err = s.processedEvents.UpdateOne(
			ctx,
			bson.M{
				"user_id":       userID,
				"connection_id": connectionID,
			},
			bson.M{
				"$pull": bson.M{
					"event_ids": bson.M{"$in": missingEventIDs},
				},
				"$set": bson.M{"updated_at": time.Now()},
			},
		)

		if err != nil {
			slog.Error("Failed to remove missing events from processed list", "connection_id", connectionID, "error", err)
			// Don't fail, just log
		}
	}

	slog.Info("Finished deleting tasks for missing events", "connection_id", connectionID, "tasks_deleted", tasksDeleted)
	return tasksDeleted, nil
}
