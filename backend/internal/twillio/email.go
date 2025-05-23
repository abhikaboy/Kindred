package twillio

import (
	"fmt"

	"github.com/sendgrid/sendgrid-go/helpers/mail"
)

func SendWaitlistEmail(to string) error {
	subject := "Welcome to Kindred's Waitlist"
	htmlContent := "<p>Thank you for joining Kindred's Waitlist. We will be in touch soon.</p>"
	return SendEmail(to, subject, "", htmlContent)
}

func SendEmail(to string, subject string, plainTextContent string, htmlContent string) error {

	client := GetSgClient()
	from := mail.NewEmail("Kindred", "kindred@kindredtodo.com")
	toEmail := mail.NewEmail(to, to)
	message := mail.NewSingleEmail(from, subject, toEmail, plainTextContent, htmlContent)

	response, err := client.Send(message)
	if err != nil {
		return err
	}

	fmt.Println(response.StatusCode)
	fmt.Println(response.Body)
	fmt.Println(response.Headers)

	return err
}