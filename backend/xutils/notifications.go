package xutils

import (
	expo "github.com/oliveroneill/exponent-server-sdk-golang/sdk"
)

var Client *expo.PushClient

type Notification struct {
	Token    string
	Message  string
	Data     map[string]string
	Title    string
	ImageURL string // Optional image URL for notification thumbnail
}

func initExpoClient() {
	Client = expo.NewPushClient(nil)
}

func SendBatchNotification(notifications []Notification) error {
	if Client == nil {
		initExpoClient()
	}

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

	_, err := Client.PublishMultiple(pushMessages)

	if err != nil {
		return err
	}

	return nil
}

func SendNotification(notification Notification) error {
	pushToken, err := expo.NewExponentPushToken(notification.Token)
	if err != nil {
		return err
	}

	if Client == nil {
		initExpoClient()
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

	response, err := Client.Publish(message)

	if err != nil {
		return err
	}

	if response.ValidateResponse() != nil {
		return response.ValidateResponse()
	}

	return nil
}
