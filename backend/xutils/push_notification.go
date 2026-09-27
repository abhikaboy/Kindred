package xutils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// expoPushEndpoint is Expo's push API. Requests are plain JSON; a single POST
// accepts either one message object or an array of them.
const expoPushEndpoint = "https://exp.host/--/api/v2/push/send"

// PushNotificationSender is an interface for sending push notifications
type PushNotificationSender interface {
	SendNotification(notification Notification) error
	SendBatchNotification(notifications []Notification) error
}

// expoPushMessage is the wire format for Expo's push API.
//
// This is hand-rolled rather than using exponent-server-sdk-golang because that
// library's PushMessage struct has no MutableContent or RichContent field and
// has not been updated since 2021 (its master branch is the same commit we were
// pinned to, so there is nothing to upgrade to). MutableContent is mandatory
// here: without it iOS never wakes the NotificationService extension, and the
// extension is what swaps in the sender's avatar.
type expoPushMessage struct {
	To    []string          `json:"to"`
	Title string            `json:"title,omitempty"`
	Body  string            `json:"body,omitempty"`
	Data  map[string]string `json:"data,omitempty"`
	Sound string            `json:"sound,omitempty"`

	// MutableContent lets the iOS service extension rewrite the payload
	// before it is displayed.
	MutableContent bool `json:"mutableContent,omitempty"`

	// RichContent carries media shown as an attachment thumbnail. This is
	// post/kudos media, NOT the sender's avatar - the avatar travels in Data
	// so the two never compete for the same slot.
	RichContent *expoRichContent `json:"richContent,omitempty"`
}

type expoRichContent struct {
	Image string `json:"image,omitempty"`
}

// expoPushResponse mirrors the API's envelope. A 200 does not mean success:
// each ticket carries its own status, and per-token failures (most commonly
// DeviceNotRegistered) surface there.
type expoPushResponse struct {
	Data   []expoPushTicket `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

type expoPushTicket struct {
	Status  string `json:"status"`
	ID      string `json:"id"`
	Message string `json:"message"`
	Details struct {
		Error string `json:"error"`
	} `json:"details"`
}

// ExpoPushNotificationSender is the real implementation using Expo
type ExpoPushNotificationSender struct {
	client   *http.Client
	endpoint string
}

// NewExpoPushNotificationSender creates a new Expo push notification sender
func NewExpoPushNotificationSender() *ExpoPushNotificationSender {
	return &ExpoPushNotificationSender{
		client:   &http.Client{Timeout: 30 * time.Second},
		endpoint: expoPushEndpoint,
	}
}

// buildMessage converts our Notification into Expo's wire format.
func buildMessage(notification Notification) expoPushMessage {
	data := make(map[string]string, len(notification.Data)+3)
	for k, v := range notification.Data {
		data[k] = v
	}

	// The service extension keys off senderName; when it is absent the push
	// is delivered unmodified with the normal app icon.
	hasSender := notification.SenderName != "" && notification.SenderAvatar != ""
	if hasSender {
		data["senderName"] = notification.SenderName
		data["senderAvatar"] = notification.SenderAvatar
		if notification.SenderID != "" {
			data["senderId"] = notification.SenderID
		}
	}

	message := expoPushMessage{
		To:             []string{notification.Token},
		Title:          notification.Title,
		Body:           notification.Message,
		Data:           data,
		Sound:          "default",
		MutableContent: hasSender,
	}
	if notification.ImageURL != "" {
		message.RichContent = &expoRichContent{Image: notification.ImageURL}
	}
	return message
}

// validateToken rejects obviously malformed tokens before we spend a request
// on them, matching the check the old SDK performed.
func validateToken(token string) error {
	if !strings.HasPrefix(token, "ExponentPushToken[") && !strings.HasPrefix(token, "ExpoPushToken[") {
		return fmt.Errorf("invalid expo push token: %q", token)
	}
	if !strings.HasSuffix(token, "]") {
		return fmt.Errorf("invalid expo push token: %q", token)
	}
	return nil
}

// publish POSTs a batch of messages and reports any transport-level failure.
// Per-ticket errors are returned for a single send but only counted for a
// batch, so one dead device cannot fail the whole fan-out.
func (e *ExpoPushNotificationSender) publish(messages []expoPushMessage, strict bool) error {
	if len(messages) == 0 {
		return nil
	}

	payload, err := json.Marshal(messages)
	if err != nil {
		return fmt.Errorf("marshal push payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, e.endpoint, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("build push request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := e.client.Do(req)
	if err != nil {
		return fmt.Errorf("send push request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("expo push returned status %d", resp.StatusCode)
	}

	var parsed expoPushResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return fmt.Errorf("decode push response: %w", err)
	}
	if len(parsed.Errors) > 0 {
		return fmt.Errorf("expo push error: %s", parsed.Errors[0].Message)
	}

	if !strict {
		return nil
	}
	for _, ticket := range parsed.Data {
		if ticket.Status != "ok" {
			return fmt.Errorf("expo push rejected: %s (%s)", ticket.Message, ticket.Details.Error)
		}
	}
	return nil
}

// SendNotification sends a single push notification
func (e *ExpoPushNotificationSender) SendNotification(notification Notification) error {
	if err := validateToken(notification.Token); err != nil {
		return err
	}
	return e.publish([]expoPushMessage{buildMessage(notification)}, true)
}

// SendBatchNotification sends multiple push notifications
func (e *ExpoPushNotificationSender) SendBatchNotification(notifications []Notification) error {
	messages := make([]expoPushMessage, 0, len(notifications))
	for _, notification := range notifications {
		if validateToken(notification.Token) != nil {
			// Skip rather than abort: a single stale token should not stop
			// the rest of a fan-out from being delivered.
			continue
		}
		messages = append(messages, buildMessage(notification))
	}
	return e.publish(messages, false)
}

// MockPushNotificationSender is a mock implementation for testing.
// Mutex-guarded so tests can poll it while service goroutines send pushes.
type MockPushNotificationSender struct {
	mu                         sync.Mutex
	SentNotifications          []Notification
	SendNotificationError      error
	SendBatchNotificationError error
}

// NewMockPushNotificationSender creates a new mock push notification sender
func NewMockPushNotificationSender() *MockPushNotificationSender {
	return &MockPushNotificationSender{
		SentNotifications: make([]Notification, 0),
	}
}

// SendNotification mocks sending a single push notification
func (m *MockPushNotificationSender) SendNotification(notification Notification) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.SendNotificationError != nil {
		return m.SendNotificationError
	}
	m.SentNotifications = append(m.SentNotifications, notification)
	return nil
}

// SendBatchNotification mocks sending multiple push notifications
func (m *MockPushNotificationSender) SendBatchNotification(notifications []Notification) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.SendBatchNotificationError != nil {
		return m.SendBatchNotificationError
	}
	m.SentNotifications = append(m.SentNotifications, notifications...)
	return nil
}

// GetSentNotifications returns a copy of all sent notifications
func (m *MockPushNotificationSender) GetSentNotifications() []Notification {
	m.mu.Lock()
	defer m.mu.Unlock()
	result := make([]Notification, len(m.SentNotifications))
	copy(result, m.SentNotifications)
	return result
}

// GetSentNotificationsForToken returns all notifications sent to a specific token
func (m *MockPushNotificationSender) GetSentNotificationsForToken(token string) []Notification {
	m.mu.Lock()
	defer m.mu.Unlock()
	var result []Notification
	for _, n := range m.SentNotifications {
		if n.Token == token {
			result = append(result, n)
		}
	}
	return result
}

// GetSentNotificationsByType returns all notifications of a specific type
func (m *MockPushNotificationSender) GetSentNotificationsByType(notificationType string) []Notification {
	m.mu.Lock()
	defer m.mu.Unlock()
	var result []Notification
	for _, n := range m.SentNotifications {
		if n.Data != nil && n.Data["type"] == notificationType {
			result = append(result, n)
		}
	}
	return result
}

// Reset clears all sent notifications
func (m *MockPushNotificationSender) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.SentNotifications = make([]Notification, 0)
	m.SendNotificationError = nil
	m.SendBatchNotificationError = nil
}

// AssertNotificationSent checks if a notification was sent to a specific token
func (m *MockPushNotificationSender) AssertNotificationSent(token string) bool {
	return len(m.GetSentNotificationsForToken(token)) > 0
}

// AssertNotificationCount checks if the expected number of notifications were sent
func (m *MockPushNotificationSender) AssertNotificationCount(expected int) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.SentNotifications) == expected
}
