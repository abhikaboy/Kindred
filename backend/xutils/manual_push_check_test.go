package xutils

import (
	"os"
	"testing"
)

// Manual end-to-end check against the real Expo API. Skipped unless a token is
// supplied: KINDRED_PUSH_TOKEN=... go test ./xutils/ -run ManualPush -v
func TestManualPushSend(t *testing.T) {
	token := os.Getenv("KINDRED_PUSH_TOKEN")
	if token == "" {
		t.Skip("set KINDRED_PUSH_TOKEN to run")
	}
	err := NewExpoPushNotificationSender().SendNotification(Notification{
		Token:        token,
		Title:        "ignored when sender is set",
		Message:      "Congrats on closing your rings!",
		SenderName:   "Abhik Ray",
		SenderAvatar: "https://i.pravatar.cc/300?img=12",
		SenderID:     "manual-check-sender",
		Data:         map[string]string{"type": "CONGRATULATION"},
	})
	if err != nil {
		t.Fatalf("send failed: %v", err)
	}
}
