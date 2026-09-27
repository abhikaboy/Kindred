package xutils

// Notification represents a push notification to be sent
type Notification struct {
	Token    string
	Message  string
	Data     map[string]string
	Title    string
	ImageURL string // Optional image URL for notification thumbnail

	// SenderName and SenderAvatar describe the person the notification is
	// *from*. When both are set, iOS renders the push as a communication
	// notification: the sender's avatar replaces the Kindred app icon in the
	// leading slot and their name becomes the title, the way a text message
	// looks. Leave them empty for notifications with no human actor (rings
	// closed, kudos suggestions) to get the normal app-icon treatment.
	//
	// SenderID is optional; it groups repeat notifications from the same
	// person into one thread in Notification Center.
	SenderName   string
	SenderAvatar string
	SenderID     string
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
	if notification.Token == "" {
		return nil
	}
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
