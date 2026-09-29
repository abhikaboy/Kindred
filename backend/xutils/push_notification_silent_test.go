package xutils

import "testing"

func TestBuildMessageSilentHasNoAlert(t *testing.T) {
	msg := buildMessage(Notification{Token: "ExponentPushToken[x]", Title: "t", Message: "m", Data: map[string]string{"type": "task_filed"}, Silent: true})

	if msg.Title != "" || msg.Body != "" || msg.Sound != "" {
		t.Fatalf("silent push carries an alert: %+v", msg)
	}
	if !msg.ContentAvailable || msg.Data["type"] != "task_filed" {
		t.Fatalf("silent push missing content-available or data: %+v", msg)
	}
}
