package xutils

import (
	expo "github.com/oliveroneill/exponent-server-sdk-golang/sdk"
)

var Client *expo.PushClient

type Notification struct {
	Token   string
	Message string
	Data    map[string]string
	Title   string
}

func initExpoClient() {
	Client = expo.NewPushClient(nil)
}

func SendNotification(notification Notification) error {
	pushToken, err := expo.NewExponentPushToken(notification.Token)
	if err != nil {
		return err
	}

	if Client == nil {
		initExpoClient()
	}

	response, err := Client.Publish(&expo.PushMessage{
		To:    []expo.ExponentPushToken{pushToken},
		Body:  notification.Message,
		Data:  notification.Data,
		Title: notification.Title,
		Sound: "default",
	})

	if err != nil {
		return err
	}

	if response.ValidateResponse() != nil {
		return response.ValidateResponse()
	}

	return nil
}
