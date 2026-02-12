package calendar

// OAuth flow types
type ConnectGoogleInput struct{}

type ConnectGoogleOutput struct {
	Body struct {
		AuthURL string `json:"auth_url" doc:"Google OAuth consent URL"`
	}
}

type OAuthCallbackInput struct {
	Code  string `query:"code" required:"true"`
	State string `query:"state" required:"true"`
	Error string `query:"error"`
}

type OAuthCallbackOutput struct {
	Body struct {
		HTML string `json:"-"` // HTML response for redirect
	} `contentType:"text/html"`
}

type GetConnectionsInput struct{}

type GetConnectionsOutput struct {
	Body struct {
		Connections []CalendarConnection `json:"connections"`
	}
}

type DisconnectInput struct {
	ConnectionID string `path:"connectionId" required:"true"`
}

type DisconnectOutput struct {
	Body struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
}

type GetEventsInput struct {
	ConnectionID string `path:"connectionId" required:"true"`
	StartDate    string `query:"start" doc:"Start date in RFC3339 format (defaults to 2 days ago)"`
	EndDate      string `query:"end" doc:"End date in RFC3339 format (defaults to 2 days from now)"`
}

type GetEventsOutput struct {
	Body struct {
		Events []CalendarEventDTO `json:"events"`
	}
}

// CalendarEventDTO represents a calendar event for API responses
type CalendarEventDTO struct {
	ID           string   `json:"id"`
	CalendarID   string   `json:"calendar_id"`
	CalendarName string   `json:"calendar_name"`
	Summary      string   `json:"summary"`
	Description  string   `json:"description"`
	Location     string   `json:"location"`
	StartTime    string   `json:"start_time"` // RFC3339 format
	EndTime      string   `json:"end_time"`   // RFC3339 format
	IsAllDay     bool     `json:"is_all_day"`
	Attendees    []string `json:"attendees"`
	Status       string   `json:"status"`
}

// Sync events types
type SyncEventsInput struct {
	ConnectionID string `path:"connectionId" required:"true"`
	StartDate    string `query:"start" doc:"Start date in RFC3339 format (defaults to 2 days ago)"`
	EndDate      string `query:"end" doc:"End date in RFC3339 format (defaults to 2 days from now)"`
}

type SyncEventsOutput struct {
	Body struct {
		TasksCreated     int            `json:"tasks_created"`
		TasksSkipped     int            `json:"tasks_skipped"`
		TasksDeleted     int            `json:"tasks_deleted"`
		EventsTotal      int            `json:"events_total"`
		CategoriesSynced map[string]int `json:"categories_synced"` // category_name -> task_count
		WorkspaceName    string         `json:"workspace_name"`
	}
}
