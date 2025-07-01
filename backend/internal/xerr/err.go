package xerr

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	go_json "github.com/goccy/go-json"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/abhikaboy/Kindred/internal/xslog"
	"github.com/gofiber/fiber/v2"
)

// ErrorResponse provides a consistent structure for all API error responses
type ErrorResponse struct {
	Status     int         `json:"status"`
	Message    string      `json:"message"`
	Error      string      `json:"error"`
	Details    interface{} `json:"details,omitempty"`
	Suggestion string      `json:"suggestion,omitempty"`
	RequestID  string      `json:"request_id,omitempty"`
}

type WriteErrorType struct {
	WriteErrors []interface{} `json:"writeErrors"`
}

func WriteException(c *fiber.Ctx, err mongo.WriteException) error {
	msg := err.Raw.String()

	slog.LogAttrs(
		c.Context(),
		slog.LevelError,
		"MongoDB write exception",
		xslog.Error(err),
	)

	requestID := c.Locals("requestid")
	
	if strings.Contains(msg, "duplicate key error") {
		// Handle duplicate key errors with a friendly message
		fieldInfo := "document"
		if err.WriteErrors != nil && len(err.WriteErrors) > 0 {
			if strings.Contains(err.WriteErrors[0].Message, "email") {
				fieldInfo = "email address"
			} else if strings.Contains(err.WriteErrors[0].Message, "username") {
				fieldInfo = "username"
			}
		}
		
		return c.Status(http.StatusConflict).JSON(ErrorResponse{
			Status:     http.StatusConflict,
			Message:    "A record with this " + fieldInfo + " already exists",
			Error:      "DuplicateKeyError",
			RequestID:  fmt.Sprintf("%v", requestID),
			Suggestion: "Please try with a different " + fieldInfo,
		})
	}

	if strings.Contains(msg, "Document failed validation") {
		// Handle validation errors with detailed feedback
			slog.LogAttrs(
				c.Context(),
				slog.LevelError,
				"Error parsing validation error",
				xslog.Error(err),
			)
		
		return c.Status(http.StatusBadRequest).JSON(ErrorResponse{
			Status:     http.StatusBadRequest,
			Message:    "The document failed validation checks",
			Error:      "ValidationError",
			Details:    err.WriteErrors,
			RequestID:  fmt.Sprintf("%v", requestID),
			Suggestion: "Please check the format of your data and ensure all required fields are provided",
		})
	}

	return c.Status(http.StatusBadRequest).JSON(ErrorResponse{
		Status:     http.StatusBadRequest,
		Message:    "Database write operation failed",
		Error:      "WriteError",
		Details:    err.WriteErrors,
		RequestID:  fmt.Sprintf("%v", requestID),
	})
}

func FailedValidation(c *fiber.Ctx, err mongo.CommandError) error {
	msg := err.Raw.String()

	requestID := c.Locals("requestid")
	
	slog.LogAttrs(
		c.Context(),
		slog.LevelError,
		"MongoDB validation error",
		xslog.Error(err),
	)

	return c.Status(int(err.Code)).JSON(ErrorResponse{
		Status:     int(err.Code),
		Message:    msg,
		Error:      err.Name,
		RequestID:  fmt.Sprintf("%v", requestID),
		Suggestion: "Please check your input and ensure it meets all requirements",
	})
}


// ErrorHandler is the central error handler for Fiber
func ErrorHandler(c *fiber.Ctx, err error) error {
	var e *fiber.Error
	if errors.As(err, &e) {
		e = err.(*fiber.Error)
	} else {
		ise := InternalServerError()
		e = &ise
	}

	slog.LogAttrs(
		c.Context(),
		slog.LevelError,
		"Error handling request",
		xslog.Error(err),
	)

	return c.Status(e.Code).JSON(e)
}

// getSuggestionForError provides helpful suggestions based on error types
func getSuggestionForError(e *fiber.Error) string {
	switch e.Code {
	case http.StatusBadRequest:
		return "Please check your request data and ensure it is correctly formatted"
	case http.StatusUnauthorized:
		return "Try logging in again with valid credentials"
	case http.StatusForbidden:
		return "You don't have permission to access this resource"
	case http.StatusNotFound:
		return "The requested resource could not be found"
	case http.StatusRequestTimeout:
		return "Please try again later"
	case http.StatusConflict:
		return "Please resolve conflicts before proceeding"
	case http.StatusTooManyRequests:
		return "Please wait a moment before trying again"
	case http.StatusInternalServerError:
		return "This is our fault, not yours. We're working on fixing it!"
	default:
		return ""
	}
}

// BadRequest returns a formatted bad request error
func BadRequest(err error) fiber.Error {
	return fiber.Error{
		Code:    http.StatusBadRequest,
		Message: err.Error(),
	}
}

// InvalidJSON returns a formatted invalid JSON error
func InvalidJSON() fiber.Error {
	return fiber.Error{
		Code:    http.StatusBadRequest,
		Message: "Invalid JSON format in request data",
	}
}

// NotFound returns a formatted not found error
func NotFound(title string, withKey string, withValue any) fiber.Error {
	return fiber.Error{
		Code:    http.StatusNotFound,
		Message: fmt.Sprintf("%s with %s='%v' not found", title, withKey, withValue),
	}
}

// Timeout returns a formatted timeout error
func Timeout(reason string) fiber.Error {
	return fiber.Error{
		Code:    http.StatusRequestTimeout,
		Message: fmt.Sprintf("Request timed out: %s", reason),
	}
}

// Conflict returns a formatted conflict error
func Conflict(title string, withKey string, withValue any) fiber.Error {
	return fiber.Error{
		Code:    http.StatusConflict,
		Message: fmt.Sprintf("Resource conflict: %s with %s='%v' already exists", title, withKey, withValue),
	}
}

// InvalidRequestData returns a formatted invalid request data error
func InvalidRequestData(errors map[string]string) fiber.Error {
	errorJSON, err := go_json.Marshal(errors)
	if err != nil {
		return fiber.Error{
			Code:    http.StatusUnprocessableEntity,
			Message: "Invalid request data",
		}
	}
	return fiber.Error{
		Code:    http.StatusUnprocessableEntity,
		Message: string(errorJSON),
	}
}

// InternalServerError returns a formatted internal server error
func InternalServerError() fiber.Error {
	return fiber.Error{
		Code:    http.StatusInternalServerError,
		Message: "An unexpected error occurred on the server",
	}
}

// Unauthorized returns a formatted unauthorized error
func Unauthorized(reason string) fiber.Error {
	return fiber.Error{
		Code:    http.StatusUnauthorized,
		Message: fmt.Sprintf("Authentication failed: %s", reason),
	}
}

// Forbidden returns a formatted forbidden error
func Forbidden(reason string) fiber.Error {
	return fiber.Error{
		Code:    http.StatusForbidden,
		Message: fmt.Sprintf("Access denied: %s", reason),
	}
}

// TooManyRequests returns a rate limit error
func TooManyRequests(reason string) fiber.Error {
	return fiber.Error{
		Code:    http.StatusTooManyRequests,
		Message: fmt.Sprintf("Rate limit exceeded: %s", reason),
	}
}
