package xutils

// Notification represents a push notification to be sent
type Notification struct {
	Token    string
	Message  string
	Data     map[string]string
	Title    string
	ImageURL string // Optional image URL for notification thumbnail
}

// DefaultPushSender is the global push notification sender used by the application
// It can be replaced with a mock for testing
var DefaultPushSender PushNotificationSender

func init() {
	// Initialize with the real Expo sender by default
	DefaultPushSender = NewExpoPushNotificationSender()
}

// SendNotification sends a single push notification using the default sender
// This function maintains backward compatibility with existing code
func SendNotification(notification Notification) error {
	return DefaultPushSender.SendNotification(notification)
}

// SendBatchNotification sends multiple push notifications using the default sender
// This function maintains backward compatibility with existing code
func SendBatchNotification(notifications []Notification) error {
	return DefaultPushSender.SendBatchNotification(notifications)
}

// SetPushNotificationSender sets a custom push notification sender (useful for testing)
func SetPushNotificationSender(sender PushNotificationSender) {
	DefaultPushSender = sender
}
