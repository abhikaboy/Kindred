package calendar

import (
	"context"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
)

type GoogleProvider struct {
	config *oauth2.Config
}

func NewGoogleProvider(cfg config.GoogleCalendar) *GoogleProvider {
	return &GoogleProvider{
		config: &oauth2.Config{
			ClientID:     cfg.ClientID,
			ClientSecret: cfg.ClientSecret,
			RedirectURL:  cfg.RedirectURL,
			Scopes: []string{
				calendar.CalendarReadonlyScope,
				calendar.CalendarEventsScope,
			},
			Endpoint: google.Endpoint,
		},
	}
}

func (p *GoogleProvider) GenerateAuthURL(userID string) string {
	return p.config.AuthCodeURL(userID, oauth2.AccessTypeOffline, oauth2.SetAuthURLParam("prompt", "consent"))
}

func (p *GoogleProvider) ExchangeCode(ctx context.Context, code string) (*oauth2.Token, error) {
	slog.Info("Google: Exchanging authorization code")
	token, err := p.config.Exchange(ctx, code)
	if err != nil {
		slog.Error("Google: Failed to exchange code", "error", err)
		return nil, err
	}
	slog.Info("Google: Token exchange successful", "has_refresh", token.RefreshToken != "", "expiry", token.Expiry)
	return token, nil
}

func (p *GoogleProvider) RefreshToken(ctx context.Context, refreshToken string) (*oauth2.Token, error) {
	token := &oauth2.Token{RefreshToken: refreshToken}
	tokenSource := p.config.TokenSource(ctx, token)
	return tokenSource.Token()
}

func (p *GoogleProvider) GetAccountInfo(ctx context.Context, token *oauth2.Token) (AccountInfo, error) {
	slog.Info("Google: Fetching account info")

	client := p.config.Client(ctx, token)
	calendarService, err := calendar.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		slog.Error("Google: Failed to create calendar service", "error", err)
		return AccountInfo{}, err
	}

	// Get primary calendar to extract email
	cal, err := calendarService.Calendars.Get("primary").Do()
	if err != nil {
		slog.Error("Google: Failed to get primary calendar", "error", err)
		return AccountInfo{}, err
	}

	slog.Info("Google: Account info retrieved", "email", cal.Id, "name", cal.Summary)
	return AccountInfo{
		ID:    cal.Id,
		Email: cal.Id, // For Google, calendar ID is the email
		Name:  cal.Summary,
	}, nil
}

func (p *GoogleProvider) ListCalendars(ctx context.Context, token *oauth2.Token) ([]CalendarInfo, error) {
	slog.Info("Google: Listing all calendars")

	client := p.config.Client(ctx, token)
	calendarService, err := calendar.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		slog.Error("Google: Failed to create calendar service", "error", err)
		return nil, err
	}

	// Get list of all calendars
	calendarList, err := calendarService.CalendarList.List().Do()
	if err != nil {
		slog.Error("Google: Failed to list calendars", "error", err)
		return nil, err
	}

	// Convert to CalendarInfo format
	calendars := make([]CalendarInfo, 0, len(calendarList.Items))
	for _, item := range calendarList.Items {
		calendars = append(calendars, CalendarInfo{
			ID:          item.Id,
			Name:        item.Summary,
			Description: item.Description,
			IsPrimary:   item.Primary,
			AccessRole:  item.AccessRole,
		})
	}

	slog.Info("Google: Calendars listed successfully", "count", len(calendars))
	return calendars, nil
}

func (p *GoogleProvider) FetchEvents(ctx context.Context, token *oauth2.Token, timeMin, timeMax time.Time) ([]ProviderEvent, error) {
	slog.Info("Google: Fetching calendar events from all calendars", "time_min", timeMin, "time_max", timeMax)

	client := p.config.Client(ctx, token)
	calendarService, err := calendar.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		slog.Error("Google: Failed to create calendar service", "error", err)
		return nil, err
	}

	// First, get list of all calendars
	calendarList, err := calendarService.CalendarList.List().Do()
	if err != nil {
		slog.Error("Google: Failed to list calendars", "error", err)
		return nil, err
	}

	slog.Info("Google: Found calendars", "count", len(calendarList.Items))

	// Fetch events from all calendars
	allEvents := make([]ProviderEvent, 0)

	for _, cal := range calendarList.Items {
		slog.Info("Google: Fetching events from calendar", "calendar", cal.Summary, "calendar_id", cal.Id)

		events, err := calendarService.Events.List(cal.Id).
			TimeMin(timeMin.Format(time.RFC3339)).
			TimeMax(timeMax.Format(time.RFC3339)).
			SingleEvents(true).
			OrderBy("startTime").
			Do()

		if err != nil {
			slog.Warn("Google: Failed to fetch events from calendar, skipping", "calendar", cal.Summary, "error", err)
			continue
		}

		// Convert Google events to ProviderEvent format
		for _, item := range events.Items {
			event := p.convertGoogleEvent(item, cal.Id, cal.Summary)
			allEvents = append(allEvents, event)
		}

		slog.Info("Google: Events fetched from calendar", "calendar", cal.Summary, "count", len(events.Items))
	}

	slog.Info("Google: All events fetched successfully", "total_count", len(allEvents), "calendars_checked", len(calendarList.Items))
	return allEvents, nil
}

func (p *GoogleProvider) CreateEvent(ctx context.Context, token *oauth2.Token, event ProviderEvent) (ProviderEvent, error) {
	slog.Info("Google: Creating calendar event", "summary", event.Summary)

	client := p.config.Client(ctx, token)
	calendarService, err := calendar.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		slog.Error("Google: Failed to create calendar service", "error", err)
		return ProviderEvent{}, err
	}

	googleEvent := p.convertToGoogleEvent(event)

	// Use the calendar ID from the event, or default to primary
	calendarID := event.CalendarID
	if calendarID == "" {
		calendarID = "primary"
	}

	createdEvent, err := calendarService.Events.Insert(calendarID, googleEvent).Do()
	if err != nil {
		slog.Error("Google: Failed to create event", "error", err)
		return ProviderEvent{}, err
	}

	result := p.convertGoogleEvent(createdEvent, calendarID, event.CalendarName)
	slog.Info("Google: Event created successfully", "event_id", result.ID)
	return result, nil
}

func (p *GoogleProvider) UpdateEvent(ctx context.Context, token *oauth2.Token, eventID string, event ProviderEvent) (ProviderEvent, error) {
	slog.Info("Google: Updating calendar event", "event_id", eventID)

	client := p.config.Client(ctx, token)
	calendarService, err := calendar.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		slog.Error("Google: Failed to create calendar service", "error", err)
		return ProviderEvent{}, err
	}

	googleEvent := p.convertToGoogleEvent(event)

	// Use the calendar ID from the event, or default to primary
	calendarID := event.CalendarID
	if calendarID == "" {
		calendarID = "primary"
	}

	updatedEvent, err := calendarService.Events.Update(calendarID, eventID, googleEvent).Do()
	if err != nil {
		slog.Error("Google: Failed to update event", "event_id", eventID, "error", err)
		return ProviderEvent{}, err
	}

	result := p.convertGoogleEvent(updatedEvent, calendarID, event.CalendarName)
	slog.Info("Google: Event updated successfully", "event_id", result.ID)
	return result, nil
}

func (p *GoogleProvider) DeleteEvent(ctx context.Context, token *oauth2.Token, eventID string) error {
	slog.Info("Google: Deleting calendar event", "event_id", eventID)

	client := p.config.Client(ctx, token)
	calendarService, err := calendar.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		slog.Error("Google: Failed to create calendar service", "error", err)
		return err
	}

	err = calendarService.Events.Delete("primary", eventID).Do()
	if err != nil {
		slog.Error("Google: Failed to delete event", "event_id", eventID, "error", err)
		return err
	}

	slog.Info("Google: Event deleted successfully", "event_id", eventID)
	return nil
}

// Helper functions to convert between Google and Provider event formats

func (p *GoogleProvider) convertGoogleEvent(googleEvent *calendar.Event, calendarID, calendarName string) ProviderEvent {
	event := ProviderEvent{
		ID:           googleEvent.Id,
		CalendarID:   calendarID,
		CalendarName: calendarName,
		Summary:      googleEvent.Summary,
		Description:  googleEvent.Description,
		Location:     googleEvent.Location,
		Status:       googleEvent.Status,
	}

	// Handle all-day events vs timed events
	if googleEvent.Start.Date != "" {
		// All-day event
		event.IsAllDay = true
		startTime, _ := time.Parse("2006-01-02", googleEvent.Start.Date)
		endTime, _ := time.Parse("2006-01-02", googleEvent.End.Date)
		event.StartTime = startTime
		event.EndTime = endTime
	} else if googleEvent.Start.DateTime != "" {
		// Timed event
		event.IsAllDay = false
		startTime, _ := time.Parse(time.RFC3339, googleEvent.Start.DateTime)
		endTime, _ := time.Parse(time.RFC3339, googleEvent.End.DateTime)
		event.StartTime = startTime
		event.EndTime = endTime
	}

	// Extract attendees
	if len(googleEvent.Attendees) > 0 {
		event.Attendees = make([]string, 0, len(googleEvent.Attendees))
		for _, attendee := range googleEvent.Attendees {
			event.Attendees = append(event.Attendees, attendee.Email)
		}
	}

	return event
}

func (p *GoogleProvider) convertToGoogleEvent(event ProviderEvent) *calendar.Event {
	googleEvent := &calendar.Event{
		Summary:     event.Summary,
		Description: event.Description,
		Location:    event.Location,
		Status:      event.Status,
	}

	// Handle all-day vs timed events
	if event.IsAllDay {
		googleEvent.Start = &calendar.EventDateTime{
			Date: event.StartTime.Format("2006-01-02"),
		}
		googleEvent.End = &calendar.EventDateTime{
			Date: event.EndTime.Format("2006-01-02"),
		}
	} else {
		googleEvent.Start = &calendar.EventDateTime{
			DateTime: event.StartTime.Format(time.RFC3339),
		}
		googleEvent.End = &calendar.EventDateTime{
			DateTime: event.EndTime.Format(time.RFC3339),
		}
	}

	// Add attendees if provided
	if len(event.Attendees) > 0 {
		googleEvent.Attendees = make([]*calendar.EventAttendee, 0, len(event.Attendees))
		for _, email := range event.Attendees {
			googleEvent.Attendees = append(googleEvent.Attendees, &calendar.EventAttendee{
				Email: email,
			})
		}
	}

	return googleEvent
}
