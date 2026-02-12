package posthog

import (
	"strings"
)

func CategorizeEndpoint(method, path string) (category, eventName string) {
	path = strings.TrimSpace(path)
	method = strings.ToUpper(method)

	if path == "/welcome" || path == "/" {
		return "system", "system_welcome"
	}
	if strings.HasPrefix(path, "/v1/health") {
		return "system", "system_health_check"
	}

	if strings.HasPrefix(path, "/v1/auth/") {
		return categorizeAuth(method, path)
	}

	if strings.HasPrefix(path, "/v1/user/") {
		return categorizeUserEndpoint(method, path)
	}

	if strings.HasPrefix(path, "/v1/calendar/") {
		return categorizeCalendar(method, path)
	}

	if strings.HasPrefix(path, "/v1/profiles/") {
		return "profile", generateEventName("profile", method, path)
	}

	if strings.HasPrefix(path, "/v1/categories") {
		return "category", generateEventName("category", method, path)
	}

	if strings.HasPrefix(path, "/v1/blueprints/") {
		return "blueprint", generateEventName("blueprint", method, path)
	}

	if strings.HasPrefix(path, "/v1/activity/") {
		return "activity", generateEventName("activity", method, path)
	}

	if strings.HasPrefix(path, "/v1/assets/") || strings.HasPrefix(path, "/v1/uploads/") {
		cleanPath := strings.TrimPrefix(path, "/v1/")
		parts := strings.Split(cleanPath, "/")
		if len(parts) >= 2 && !isID(parts[1]) {
			return "asset", "asset_" + parts[1] + "_" + methodToAction(method)
		}
		return "asset", generateEventName("asset", method, path)
	}

	if strings.HasPrefix(path, "/v1/admin/") {
		cleanPath := strings.TrimPrefix(path, "/v1/admin/")
		parts := strings.Split(cleanPath, "/")
		if len(parts) >= 1 && parts[0] != "" && !isID(parts[0]) {
			return "admin", "admin_" + parts[0] + "_" + methodToAction(method)
		}
		return "admin", generateEventName("admin", method, path)
	}

	if strings.HasPrefix(path, "/v1/waitlist") {
		return "waitlist", generateEventName("waitlist", method, path)
	}

	if strings.HasPrefix(path, "/v1/referrals/features") {
		return "reward", "reward_features_view"
	}

	if strings.HasPrefix(path, "/ws/") {
		return "websocket", generateEventName("websocket", method, path)
	}

	return "other", generateEventName("other", method, path)
}

func categorizeAuth(method, path string) (category, eventName string) {
	category = "auth"

	if strings.Contains(path, "/login") {
		if strings.Contains(path, "/phone") {
			return category, "auth_login_phone"
		}
		if strings.Contains(path, "/apple") {
			return category, "auth_login_apple"
		}
		if strings.Contains(path, "/google") {
			return category, "auth_login_google"
		}
		if strings.Contains(path, "/otp") {
			return category, "auth_login_otp"
		}
		return category, "auth_login"
	}

	if strings.Contains(path, "/register") {
		if strings.Contains(path, "/apple") {
			return category, "auth_register_apple"
		}
		if strings.Contains(path, "/google") {
			return category, "auth_register_google"
		}
		return category, "auth_register"
	}

	if strings.Contains(path, "/logout") {
		return category, "auth_logout"
	}

	if strings.Contains(path, "/send-otp") {
		return category, "auth_send_otp"
	}

	if strings.Contains(path, "/verify-otp") {
		return category, "auth_verify_otp"
	}

	return category, generateEventName("auth", method, path)
}

func categorizeUserEndpoint(method, path string) (category, eventName string) {
	subPath := strings.TrimPrefix(path, "/v1/user/")

	if strings.HasPrefix(subPath, "tasks") || strings.Contains(subPath, "/task/") {
		return "task", categorizeTaskAction(method, subPath)
	}

	if strings.HasPrefix(subPath, "categories") || strings.HasPrefix(subPath, "workspaces") || strings.HasPrefix(subPath, "category/") {
		return "category", generateEventName("category", method, subPath)
	}

	if strings.HasPrefix(subPath, "profiles") || strings.HasPrefix(subPath, "search") ||
		strings.HasPrefix(subPath, "timezone") || strings.HasPrefix(subPath, "credits") {
		if strings.HasPrefix(subPath, "profiles/") && method == "GET" {
			parts := strings.Split(subPath, "/")
			if len(parts) >= 2 && isID(parts[1]) {
				return "profile", "profile_view"
			}
		}
		return "profile", generateEventName("profile", method, subPath)
	}

	if strings.HasPrefix(subPath, "connections") {
		return "connection", generateEventName("connection", method, subPath)
	}

	if strings.HasPrefix(subPath, "groups") {
		return "group", generateEventName("group", method, subPath)
	}

	if strings.HasPrefix(subPath, "posts") || strings.HasPrefix(subPath, "feed") || strings.Contains(subPath, "/posts") {
		return "social", categorizeSocialAction(method, subPath)
	}

	if strings.HasPrefix(subPath, "encouragements") {
		return "social", generateEventName("social_encourage", method, subPath)
	}

	if strings.HasPrefix(subPath, "congratulations") {
		return "social", generateEventName("social_congratulate", method, subPath)
	}

	if strings.HasPrefix(subPath, "blueprints") {
		return "blueprint", generateEventName("blueprint", method, subPath)
	}

	if strings.HasPrefix(subPath, "notifications") {
		return "notification", generateEventName("notification", method, subPath)
	}

	if strings.HasPrefix(subPath, "rewards") || strings.HasPrefix(subPath, "referrals") {
		return "reward", generateEventName("reward", method, subPath)
	}

	if strings.HasPrefix(subPath, "settings") {
		return "settings", generateEventName("settings", method, subPath)
	}

	if strings.HasPrefix(subPath, "reports") {
		return "report", generateEventName("report", method, subPath)
	}

	if strings.HasPrefix(subPath, "calendar") {
		if strings.Contains(subPath, "/connect/") {
			return "calendar", "calendar_connect_" + methodToAction(method)
		}
		return "calendar", generateEventName("calendar", method, subPath)
	}

	if strings.HasPrefix(subPath, "waitlist") {
		return "waitlist", generateEventName("waitlist", method, subPath)
	}

	if strings.HasPrefix(subPath, "pushtoken") {
		return "auth", "auth_update_push_token"
	}

	if strings.HasPrefix(subPath, "accept-terms") {
		return "auth", "auth_accept_terms"
	}

	if strings.HasPrefix(subPath, "account") && method == "DELETE" {
		return "auth", "auth_delete_account"
	}

	if subPath == "" || subPath == "/" || subPath == "login" {
		return "auth", "auth_test"
	}

	return "other", generateEventName("user", method, subPath)
}

func categorizeTaskAction(method, path string) string {
	switch method {
	case "GET":
		parts := strings.Split(path, "/")
		for _, part := range parts {
			if isID(part) {
				return "task_view"
			}
		}
		return "task_list"
	case "POST":
		if strings.Contains(path, "/complete") {
			return "task_complete"
		}
		if strings.Contains(path, "/bulk-complete") {
			return "task_bulk_complete"
		}
		return "task_create"
	case "PUT", "PATCH":
		return "task_update"
	case "DELETE":
		if strings.Contains(path, "/bulk-delete") {
			return "task_bulk_delete"
		}
		return "task_delete"
	default:
		return "task_action"
	}
}

func categorizeSocialAction(method, path string) string {
	if strings.HasSuffix(path, "/feed") || path == "feed" {
		return "social_feed_view"
	}

	if strings.Contains(path, "/comments") {
		switch method {
		case "POST":
			return "social_comment_create"
		case "DELETE":
			return "social_comment_delete"
		default:
			return "social_comment_view"
		}
	}

	if strings.Contains(path, "/reactions") {
		switch method {
		case "POST":
			return "social_react"
		case "DELETE":
			return "social_unreact"
		default:
			return "social_reactions_view"
		}
	}

	switch method {
	case "GET":
		return "social_post_view"
	case "POST":
		return "social_post_create"
	case "PUT", "PATCH":
		return "social_post_update"
	case "DELETE":
		return "social_post_delete"
	default:
		return "social_action"
	}
}

func categorizeCalendar(method, path string) (category, eventName string) {
	category = "calendar"

	if strings.Contains(path, "/oauth2/callback") {
		return category, "calendar_oauth_callback"
	}

	if strings.Contains(path, "/webhook/") {
		return category, "calendar_webhook_received"
	}

	return category, generateEventName("calendar", method, path)
}

func generateEventName(prefix, method, path string) string {
	action := methodToAction(method)

	path = strings.TrimPrefix(path, "/")
	path = strings.TrimSuffix(path, "/")

	parts := strings.Split(path, "/")
	for _, part := range parts {
		if part != "" && !isID(part) {
			return prefix + "_" + part + "_" + action
		}
	}

	return prefix + "_" + action
}

func methodToAction(method string) string {
	switch method {
	case "GET":
		return "view"
	case "POST":
		return "create"
	case "PUT", "PATCH":
		return "update"
	case "DELETE":
		return "delete"
	default:
		return "action"
	}
}

func isID(s string) bool {
	if len(s) < 20 {
		return false
	}
	for _, c := range s {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}
