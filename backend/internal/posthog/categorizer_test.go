package posthog

import (
	"testing"
)

func TestCategorizeEndpoint(t *testing.T) {
	tests := []struct {
		name          string
		method        string
		path          string
		wantCategory  string
		wantEventName string
	}{
		// System endpoints
		{
			name:          "welcome page",
			method:        "GET",
			path:          "/welcome",
			wantCategory:  "system",
			wantEventName: "system_welcome",
		},
		{
			name:          "health check",
			method:        "GET",
			path:          "/v1/health",
			wantCategory:  "system",
			wantEventName: "system_health_check",
		},

		// Auth endpoints
		{
			name:          "login",
			method:        "POST",
			path:          "/v1/auth/login",
			wantCategory:  "auth",
			wantEventName: "auth_login",
		},
		{
			name:          "login with phone",
			method:        "POST",
			path:          "/v1/auth/login/phone",
			wantCategory:  "auth",
			wantEventName: "auth_login_phone",
		},
		{
			name:          "login with google",
			method:        "POST",
			path:          "/v1/auth/login/google",
			wantCategory:  "auth",
			wantEventName: "auth_login_google",
		},
		{
			name:          "register",
			method:        "POST",
			path:          "/v1/auth/register",
			wantCategory:  "auth",
			wantEventName: "auth_register",
		},
		{
			name:          "logout",
			method:        "POST",
			path:          "/v1/auth/logout",
			wantCategory:  "auth",
			wantEventName: "auth_logout",
		},

		// Task endpoints
		{
			name:          "list tasks",
			method:        "GET",
			path:          "/v1/user/tasks",
			wantCategory:  "task",
			wantEventName: "task_list",
		},
		{
			name:          "create task",
			method:        "POST",
			path:          "/v1/user/tasks",
			wantCategory:  "task",
			wantEventName: "task_create",
		},
		{
			name:          "view task",
			method:        "GET",
			path:          "/v1/user/tasks/507f1f77bcf86cd799439011",
			wantCategory:  "task",
			wantEventName: "task_view",
		},
		{
			name:          "update task",
			method:        "PUT",
			path:          "/v1/user/tasks/507f1f77bcf86cd799439011",
			wantCategory:  "task",
			wantEventName: "task_update",
		},
		{
			name:          "delete task",
			method:        "DELETE",
			path:          "/v1/user/tasks/507f1f77bcf86cd799439011",
			wantCategory:  "task",
			wantEventName: "task_delete",
		},
		{
			name:          "complete task",
			method:        "POST",
			path:          "/v1/user/tasks/507f1f77bcf86cd799439011/complete",
			wantCategory:  "task",
			wantEventName: "task_complete",
		},

		// Social endpoints
		{
			name:          "view feed",
			method:        "GET",
			path:          "/v1/user/feed",
			wantCategory:  "social",
			wantEventName: "social_feed_view",
		},
		{
			name:          "create post",
			method:        "POST",
			path:          "/v1/user/posts",
			wantCategory:  "social",
			wantEventName: "social_post_create",
		},
		{
			name:          "view post",
			method:        "GET",
			path:          "/v1/user/posts/507f1f77bcf86cd799439011",
			wantCategory:  "social",
			wantEventName: "social_post_view",
		},
		{
			name:          "add comment",
			method:        "POST",
			path:          "/v1/user/posts/507f1f77bcf86cd799439011/comments",
			wantCategory:  "social",
			wantEventName: "social_comment_create",
		},
		{
			name:          "react to post",
			method:        "POST",
			path:          "/v1/user/posts/507f1f77bcf86cd799439011/reactions",
			wantCategory:  "social",
			wantEventName: "social_react",
		},

		// Profile endpoints
		{
			name:          "view profile",
			method:        "GET",
			path:          "/v1/user/profiles/507f1f77bcf86cd799439011",
			wantCategory:  "profile",
			wantEventName: "profile_view",
		},
		{
			name:          "search profiles",
			method:        "GET",
			path:          "/v1/user/search",
			wantCategory:  "profile",
			wantEventName: "profile_search_view",
		},

		// Calendar endpoints
		{
			name:          "calendar oauth callback",
			method:        "GET",
			path:          "/v1/calendar/oauth2/callback",
			wantCategory:  "calendar",
			wantEventName: "calendar_oauth_callback",
		},
		{
			name:          "calendar webhook",
			method:        "POST",
			path:          "/v1/calendar/webhook/507f1f77bcf86cd799439011",
			wantCategory:  "calendar",
			wantEventName: "calendar_webhook_received",
		},
		{
			name:          "connect calendar",
			method:        "GET",
			path:          "/v1/user/calendar/connect/google",
			wantCategory:  "calendar",
			wantEventName: "calendar_connect_view",
		},

		// Group endpoints
		{
			name:          "list groups",
			method:        "GET",
			path:          "/v1/user/groups",
			wantCategory:  "group",
			wantEventName: "group_groups_view",
		},
		{
			name:          "create group",
			method:        "POST",
			path:          "/v1/user/groups",
			wantCategory:  "group",
			wantEventName: "group_groups_create",
		},

		// Connection endpoints
		{
			name:          "list connections",
			method:        "GET",
			path:          "/v1/user/connections",
			wantCategory:  "connection",
			wantEventName: "connection_connections_view",
		},

		// Notification endpoints
		{
			name:          "list notifications",
			method:        "GET",
			path:          "/v1/user/notifications",
			wantCategory:  "notification",
			wantEventName: "notification_notifications_view",
		},

		// Blueprint endpoints
		{
			name:          "list blueprints",
			method:        "GET",
			path:          "/v1/user/blueprints",
			wantCategory:  "blueprint",
			wantEventName: "blueprint_blueprints_view",
		},

		// Settings endpoints
		{
			name:          "get settings",
			method:        "GET",
			path:          "/v1/user/settings",
			wantCategory:  "settings",
			wantEventName: "settings_settings_view",
		},
		{
			name:          "update settings",
			method:        "PUT",
			path:          "/v1/user/settings",
			wantCategory:  "settings",
			wantEventName: "settings_settings_update",
		},

		// Asset endpoints
		{
			name:          "upload asset",
			method:        "POST",
			path:          "/v1/assets/upload",
			wantCategory:  "asset",
			wantEventName: "asset_upload_create",
		},

		// Admin endpoints
		{
			name:          "admin reports",
			method:        "GET",
			path:          "/v1/admin/reports",
			wantCategory:  "admin",
			wantEventName: "admin_reports_view",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotCategory, gotEventName := CategorizeEndpoint(tt.method, tt.path)
			if gotCategory != tt.wantCategory {
				t.Errorf("CategorizeEndpoint() category = %v, want %v", gotCategory, tt.wantCategory)
			}
			if gotEventName != tt.wantEventName {
				t.Errorf("CategorizeEndpoint() eventName = %v, want %v", gotEventName, tt.wantEventName)
			}
		})
	}
}

func TestMethodToAction(t *testing.T) {
	tests := []struct {
		method string
		want   string
	}{
		{"GET", "view"},
		{"POST", "create"},
		{"PUT", "update"},
		{"PATCH", "update"},
		{"DELETE", "delete"},
		{"OPTIONS", "action"},
	}

	for _, tt := range tests {
		t.Run(tt.method, func(t *testing.T) {
			if got := methodToAction(tt.method); got != tt.want {
				t.Errorf("methodToAction() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIsID(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  bool
	}{
		{"valid ObjectID", "507f1f77bcf86cd799439011", true},
		{"valid UUID", "550e8400e29b41d4a716446655440000", true},
		{"short string", "abc123", false},
		{"non-hex string", "not-an-id-at-all", false},
		{"mixed case hex", "507F1F77BCF86CD799439011", true},
		{"empty string", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isID(tt.input); got != tt.want {
				t.Errorf("isID() = %v, want %v", got, tt.want)
			}
		})
	}
}
