package calendar

import (
	"errors"
	"fmt"
	"testing"

	"golang.org/x/oauth2"
)

func TestIsAccountDeletedError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "nil error",
			err:  nil,
			want: false,
		},
		{
			name: "account deleted via ErrorDescription",
			err: &oauth2.RetrieveError{
				ErrorCode:        "invalid_grant",
				ErrorDescription: "Account has been deleted",
			},
			want: true,
		},
		{
			name: "account deleted wrapped the way getValidToken wraps it",
			err: fmt.Errorf("failed to refresh token: %w", &oauth2.RetrieveError{
				ErrorCode:        "invalid_grant",
				ErrorDescription: "Account has been deleted",
			}),
			want: true,
		},
		{
			name: "account deleted reported only in the raw body",
			err: &oauth2.RetrieveError{
				ErrorCode: "invalid_grant",
				Body:      []byte(`{"error":"invalid_grant","error_description":"Account has been deleted"}`),
			},
			want: true,
		},
		{
			name: "revoked grant is recoverable, not deleted",
			err: &oauth2.RetrieveError{
				ErrorCode:        "invalid_grant",
				ErrorDescription: "Token has been expired or revoked.",
			},
			want: false,
		},
		{
			name: "different error code with deleted wording",
			err: &oauth2.RetrieveError{
				ErrorCode:        "invalid_client",
				ErrorDescription: "Account has been deleted",
			},
			want: false,
		},
		{
			name: "flattened error text still matches",
			err:  errors.New(`failed to refresh token: oauth2: "invalid_grant" "Account has been deleted"`),
			want: true,
		},
		{
			name: "unrelated error",
			err:  errors.New("connection reset by peer"),
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsAccountDeletedError(tt.err); got != tt.want {
				t.Errorf("IsAccountDeletedError() = %v, want %v", got, tt.want)
			}
		})
	}
}
