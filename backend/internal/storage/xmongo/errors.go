package xmongo

import (
	"strings"

	"go.mongodb.org/mongo-driver/mongo"
)

// IsDuplicateKeyError checks if the error is a MongoDB duplicate key error
func IsDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	return mongo.IsDuplicateKeyError(err) || strings.Contains(err.Error(), "E11000")
}

// ExtractDuplicateField extracts which field caused the duplicate key error
// Returns the field name and a user-friendly message
func ExtractDuplicateField(err error) (field string, message string) {
	if err == nil {
		return "", ""
	}

	errMsg := err.Error()

	if strings.Contains(errMsg, "email") {
		return "email", "An account with this email already exists"
	}
	if strings.Contains(errMsg, "apple_id") {
		return "apple_id", "An account with this Apple ID already exists"
	}
	if strings.Contains(errMsg, "google_id") {
		return "google_id", "An account with this Google ID already exists"
	}
	if strings.Contains(errMsg, "handle") {
		return "handle", "This handle is already taken"
	}

	return "unknown", "An account with these credentials already exists"
}
