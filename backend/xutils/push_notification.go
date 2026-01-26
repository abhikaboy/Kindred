package xutils

import (
	expo "github.com/oliveroneill/exponent-server-sdk-golang/sdk"
)

// PushNotificationSender is an interface for sending push notifications
type PushNotificationSender interface {
	SendNotification(notification Notification) error
	SendBatchNotification(notifications []Notification) error
}

// ExpoPushNotificationSender is the real implementation using Expo
type ExpoPushNotificationSender struct {
	client *expo.PushClient
}

// NewExpoPushNotificationSender creates a new Expo push notification sender
func NewExpoPushNotificationSender() *ExpoPushNotificationSender {
	return &ExpoPushNotificationSender{
		client: expo.NewPushClient(nil),
	}
}

// SendNotification sends a single push notification
func (e *ExpoPushNotificationSender) SendNotification(notification Notification) error {
	pushToken, err := expo.NewExponentPushToken(notification.Token)
	if err != nil {
		return err
	}

	data := notification.Data
	// Add image data if provided (Expo will show it as attachment/thumbnail)
	if notification.ImageURL != "" {
		if data == nil {
			data = make(map[string]string)
		}
		data["imageUrl"] = notification.ImageURL
	}

	message := &expo.PushMessage{
		To:    []expo.ExponentPushToken{pushToken},
		Body:  notification.Message,
		Data:  data,
		Title: notification.Title,
		Sound: "default",
	}

	response, err := e.client.Publish(message)
	if err != nil {
		return err
	}

	if response.ValidateResponse() != nil {
		return response.ValidateResponse()
	}

	return nil
}

// SendBatchNotification sends multiple push notifications
func (e *ExpoPushNotificationSender) SendBatchNotification(notifications []Notification) error {
	pushMessages := make([]expo.PushMessage, len(notifications))
	for i, notification := range notifications {
		data := notification.Data
		// Add image URL to data if provided
		if notification.ImageURL != "" {
			if data == nil {
				data = make(map[string]string)
			}
			data["imageUrl"] = notification.ImageURL
		}

		message := expo.PushMessage{
			To:    []expo.ExponentPushToken{expo.ExponentPushToken(notification.Token)},
			Body:  notification.Message,
			Data:  data,
			Title: notification.Title,
			Sound: "default",
		}
		pushMessages[i] = message
	}

	_, err := e.client.PublishMultiple(pushMessages)
	return err
}

// MockPushNotificationSender is a mock implementation for testing
type MockPushNotificationSender struct {
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
	if m.SendNotificationError != nil {
		return m.SendNotificationError
	}
	m.SentNotifications = append(m.SentNotifications, notification)
	return nil
}

// SendBatchNotification mocks sending multiple push notifications
func (m *MockPushNotificationSender) SendBatchNotification(notifications []Notification) error {
	if m.SendBatchNotificationError != nil {
		return m.SendBatchNotificationError
	}
	m.SentNotifications = append(m.SentNotifications, notifications...)
	return nil
}

// GetSentNotifications returns all sent notifications
func (m *MockPushNotificationSender) GetSentNotifications() []Notification {
	return m.SentNotifications
}

// GetSentNotificationsForToken returns all notifications sent to a specific token
func (m *MockPushNotificationSender) GetSentNotificationsForToken(token string) []Notification {
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
	return len(m.SentNotifications) == expected
}
