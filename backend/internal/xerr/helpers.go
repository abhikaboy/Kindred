package xerr

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
)

// RespondWithError is a helper to quickly return a standardized error response
func RespondWithError(c *fiber.Ctx, status int, message string, errorType string, details interface{}, suggestion string) error {
	requestID := c.Locals("requestid")

	return c.Status(status).JSON(ErrorResponse{
		Status:     status,
		Message:    message,
		Error:      errorType,
		RequestID:  requestToString(requestID),
		Details:    details,
		Suggestion: suggestion,
	})
}

// ValidationError is a helper to create validation error responses
func ValidationError(c *fiber.Ctx, message string, details map[string]string) error {
	return RespondWithError(
		c,
		fiber.StatusBadRequest,
		message,
		"ValidationError",
		details,
		"Please check your input and correct the errors",
	)
}

// ResourceNotFound is a helper to create not found error responses
func ResourceNotFound(c *fiber.Ctx, resourceType string, id string) error {
	return RespondWithError(
		c,
		fiber.StatusNotFound,
		resourceType+" not found",
		"ResourceNotFound",
		map[string]string{"id": id},
		"Please check that the "+resourceType+" ID exists and is accessible",
	)
}

// AuthError is a helper to create auth error responses
func AuthError(c *fiber.Ctx, message string) error {
	return RespondWithError(
		c,
		fiber.StatusUnauthorized,
		message,
		"AuthenticationError",
		nil,
		"Please check your credentials and try logging in again",
	)
}

// ForbiddenError is a helper to create permission error responses
func ForbiddenError(c *fiber.Ctx, message string) error {
	return RespondWithError(
		c,
		fiber.StatusForbidden,
		message,
		"AccessDenied",
		nil,
		"You don't have sufficient privileges to perform this action",
	)
}

// DuplicateError is a helper to create conflict error responses
func DuplicateError(c *fiber.Ctx, resourceType string, field string, value string) error {
	return RespondWithError(
		c,
		fiber.StatusConflict,
		resourceType+" with this "+field+" already exists",
		"ResourceConflict",
		map[string]string{field: value},
		"Please use a different "+field,
	)
}

// ServerError is a helper to create internal server error responses
func ServerError(c *fiber.Ctx, err error) error {
	requestID := c.Locals("requestid")

	return c.Status(fiber.StatusInternalServerError).JSON(ErrorResponse{
		Status:     fiber.StatusInternalServerError,
		Message:    "An unexpected error occurred",
		Error:      "InternalServerError",
		RequestID:  requestToString(requestID),
		Suggestion: "This issue has been logged. Please try again later or contact support if the problem persists.",
	})
}

// Helper to convert request ID of any type to string
func requestToString(requestID interface{}) string {
	if requestID == nil {
		return ""
	}
	return fmt.Sprintf("%v", requestID)
}
