# Enhanced Error Handling System for Fiber Backend

This package provides a standardized error handling system for the Fiber backend API. It ensures consistent, user-friendly error messages and proper logging.

## Features

-   Standardized error response format
-   Helpful suggestions for common error types
-   Detailed validation error feedback
-   Consistent error codes
-   MongoDB error extraction and formatting
-   Request ID tracking for debugging
-   Advanced logging integration

## Error Response Format

All API errors follow this consistent JSON structure:

```json
{
	"status": 400,
	"message": "Human-readable error message",
	"error": "ErrorType",
	"details": {
		/* Optional details about what went wrong */
	},
	"suggestion": "A helpful suggestion on how to resolve the issue",
	"request_id": "unique-request-id-for-tracking"
}
```

## Usage

### Basic Error Handler Functions

Use these helpers to quickly return formatted errors:

```go
// For validation errors
xerr.ValidationError(c, "Invalid input data", errorMap)

// For not found errors
xerr.ResourceNotFound(c, "User", userId)

// For authentication errors
xerr.AuthError(c, "Session expired")

// For permission errors
xerr.ForbiddenError(c, "Insufficient privileges")

// For duplicate/conflict errors
xerr.DuplicateError(c, "User", "email", user.Email)

// For server errors
xerr.ServerError(c, err)
```

### Custom Error Responses

For more control, use `RespondWithError`:

```go
xerr.RespondWithError(
    c,
    http.StatusBadRequest,
    "Custom error message",
    "CustomErrorType",
    map[string]string{"field": "error reason"},
    "Suggestion to fix the issue"
)
```

### MongoDB Error Handling

Special handlers for MongoDB errors:

```go
// For MongoDB write exceptions
xerr.WriteException(c, err)

// For MongoDB validation errors
xerr.FailedValidation(c, err)
```

## Error Types

-   **ValidationError**: Input validation failed
-   **ResourceNotFound**: Requested resource not found
-   **AuthenticationError**: Authentication failed
-   **AccessDenied**: Permission denied
-   **ResourceConflict**: Resource already exists (duplicate)
-   **InternalServerError**: Server-side error
-   **WriteError**: Database write operation failed

## Example Handler Integration

```go
func (h *Handler) CreateItem(c *fiber.Ctx) error {
    var item Item

    // Parse and validate
    if err := c.BodyParser(&item); err != nil {
        return xerr.ValidationError(c, "Invalid request body", nil)
    }

    if validationErrors := validator.Validate(item); len(validationErrors) > 0 {
        errorMap := make(map[string]string)
        for _, fieldErr := range validationErrors {
            errorMap[fieldErr.FailedField] = fieldErr.Tag
        }
        return xerr.ValidationError(c, "Invalid input data", errorMap)
    }

    // Process and handle errors
    result, err := h.service.CreateItem(item)
    if err != nil {
        if strings.Contains(err.Error(), "duplicate key") {
            return xerr.DuplicateError(c, "Item", "name", item.Name)
        }
        return xerr.ServerError(c, err)
    }

    // Success response
    return c.Status(fiber.StatusCreated).JSON(result)
}
```
