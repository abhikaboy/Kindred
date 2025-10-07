package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"
)

const (
	sinchVerificationURL = "https://verification.api.sinch.com/verification/v1/verifications"
	httpTimeout          = 10 * time.Second
)

// SinchVerificationRequest represents the request payload for Sinch verification API
type SinchVerificationRequest struct {
	Identity SinchIdentity `json:"identity"`
	Method   string        `json:"method"`
}

// SinchIdentity represents the identity object in the Sinch request
type SinchIdentity struct {
	Type     string `json:"type"`
	Endpoint string `json:"endpoint"`
}

// SinchVerificationResponse represents the response from Sinch verification API
type SinchVerificationResponse struct {
	ID     string `json:"id"`
	Method string `json:"method"`
	Status string `json:"status"`
}

// SinchVerifyRequest represents the request payload for verifying OTP
type SinchVerifyRequest struct {
	Method string         `json:"method"`
	SMS    SinchSMSVerify `json:"sms"`
}

// SinchSMSVerify represents the SMS verification details
type SinchSMSVerify struct {
	Code string `json:"code"`
}

// SinchVerifyResponse represents the response from Sinch verify API
type SinchVerifyResponse struct {
	ID        string `json:"id"`
	Method    string `json:"method"`
	Status    string `json:"status"`
	Reason    string `json:"reason,omitempty"`
	Reference string `json:"reference,omitempty"`
}

// sendOTPAsync sends OTP via Sinch API using an async/non-blocking HTTP client
// This follows Go best practices by using context for cancellation and proper HTTP client configuration
func (s *Service) sendOTPAsync(ctx context.Context, phoneNumber string) (string, error) {
	// Validate Sinch credentials are configured
	if s.config.Sinch.ApplicationKey == "" || s.config.Sinch.ApplicationSecret == "" {
		slog.Error("Sinch credentials not configured",
			"has_key", s.config.Sinch.ApplicationKey != "",
			"has_secret", s.config.Sinch.ApplicationSecret != "")
		return "", fmt.Errorf("sinch credentials not configured in environment variables")
	}

	// Create HTTP client with timeout for non-blocking behavior
	client := &http.Client{
		Timeout: httpTimeout,
	}

	// Prepare request payload
	payload := SinchVerificationRequest{
		Identity: SinchIdentity{
			Type:     "number",
			Endpoint: phoneNumber,
		},
		Method: "sms",
	}

	// Marshal payload to JSON
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request payload: %w", err)
	}

	// Create HTTP request with context for cancellation support
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sinchVerificationURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Set Basic Auth using Go's built-in method
	req.SetBasicAuth(s.config.Sinch.ApplicationKey, s.config.Sinch.ApplicationSecret)
	req.Header.Set("Content-Type", "application/json")

	// Debug log (mask sensitive data in production)
	slog.Debug("Sinch request prepared",
		"key_length", len(s.config.Sinch.ApplicationKey),
		"secret_length", len(s.config.Sinch.ApplicationSecret))

	// Log the request (without sensitive data)
	slog.Info("Sending OTP request to Sinch", "phone", phoneNumber)

	// Execute the HTTP request asynchronously
	// The HTTP client with timeout ensures this is non-blocking
	resp, err := client.Do(req)
	if err != nil {
		slog.Error("Failed to send OTP request to Sinch", "error", err, "phone", phoneNumber)
		return "", fmt.Errorf("failed to send OTP request: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	// Check for non-2xx status codes
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		slog.Error("Sinch API returned error", "status", resp.StatusCode, "body", string(body))
		return "", fmt.Errorf("sinch API error: status %d, body: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var sinchResp SinchVerificationResponse
	if err := json.Unmarshal(body, &sinchResp); err != nil {
		return "", fmt.Errorf("failed to parse Sinch response: %w", err)
	}

	slog.Info("OTP sent successfully via Sinch",
		"phone", phoneNumber,
		"verification_id", sinchResp.ID,
		"status", sinchResp.Status)

	return sinchResp.ID, nil
}

// verifyOTPAsync verifies OTP code via Sinch API using an async/non-blocking HTTP client
// This follows Go best practices by using context for cancellation and proper HTTP client configuration
func (s *Service) verifyOTPAsync(ctx context.Context, phoneNumber string, code string) (bool, string, error) {
	// Validate Sinch credentials are configured
	if s.config.Sinch.ApplicationKey == "" || s.config.Sinch.ApplicationSecret == "" {
		slog.Error("Sinch credentials not configured",
			"has_key", s.config.Sinch.ApplicationKey != "",
			"has_secret", s.config.Sinch.ApplicationSecret != "")
		return false, "", fmt.Errorf("sinch credentials not configured in environment variables")
	}

	// Create HTTP client with timeout for non-blocking behavior
	client := &http.Client{
		Timeout: httpTimeout,
	}

	// Prepare request payload
	payload := SinchVerifyRequest{
		Method: "sms",
		SMS: SinchSMSVerify{
			Code: code,
		},
	}

	// Marshal payload to JSON
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return false, "", fmt.Errorf("failed to marshal request payload: %w", err)
	}

	// Build the verification URL with phone number
	verifyURL := fmt.Sprintf("%s/number/%s", sinchVerificationURL, phoneNumber)

	// Create HTTP request with context for cancellation support
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, verifyURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return false, "", fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Set Basic Auth using Go's built-in method
	req.SetBasicAuth(s.config.Sinch.ApplicationKey, s.config.Sinch.ApplicationSecret)
	req.Header.Set("Content-Type", "application/json")

	// Log the request (without sensitive data)
	slog.Info("Verifying OTP with Sinch", "phone", phoneNumber)

	// Execute the HTTP request asynchronously
	// The HTTP client with timeout ensures this is non-blocking
	resp, err := client.Do(req)
	if err != nil {
		slog.Error("Failed to verify OTP request to Sinch", "error", err, "phone", phoneNumber)
		return false, "", fmt.Errorf("failed to verify OTP request: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, "", fmt.Errorf("failed to read response body: %w", err)
	}

	// Parse response
	var sinchResp SinchVerifyResponse
	if err := json.Unmarshal(body, &sinchResp); err != nil {
		return false, "", fmt.Errorf("failed to parse Sinch response: %w", err)
	}

	// Check for non-2xx status codes
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		slog.Error("Sinch API returned error", "status", resp.StatusCode, "body", string(body))
		return false, sinchResp.Status, fmt.Errorf("sinch API error: status %d, body: %s", resp.StatusCode, string(body))
	}

	// Determine if verification was successful
	// Sinch returns "SUCCESSFUL" status for valid codes
	valid := sinchResp.Status == "SUCCESSFUL"

	slog.Info("OTP verification completed",
		"phone", phoneNumber,
		"valid", valid,
		"status", sinchResp.Status)

	return valid, sinchResp.Status, nil
}
