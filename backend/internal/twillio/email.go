package twillio

import (
	"fmt"
	"strings"

	"github.com/sendgrid/sendgrid-go/helpers/mail"
)

func SendWaitlistEmail(to string, name string) error {
	// split name into first and last
	first := strings.Split(name, " ")[0]
	subject := "Welcome to Kindred's Waitlist"
	htmlContent := fmt.Sprintf(`
	<h2>Hey %s!</h2>
	<p>Thank you for joining Kindred's Waitlist! We're working hard to bring Kindred to life and appreciate your support</p>
	<p>In the meantime, feel free to share our website! Although its still in development, we'd love to spread the word</p>
	<p>Thank you for your patience!</p>
	<p>The Kindred Team 💜</p>
	`, first)
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