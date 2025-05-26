package twillio

import (
	"log/slog"

	"github.com/sendgrid/sendgrid-go"
)

var SgClient *sendgrid.Client

func InitSendGrid(sgToken string) {
	SgClient = sendgrid.NewSendClient(sgToken)
	slog.Info("SendGrid client initialized", "sgToken", sgToken)
}

func GetSgClient() *sendgrid.Client {
	return SgClient
}
