package testing

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"
)

// HTTPTestClient provides utilities for testing HTTP endpoints
type HTTPTestClient struct {
	t      *testing.T
	app    *fiber.App
	token  string
	userID string
}

// NewHTTPTestClient creates a new HTTP test client
func NewHTTPTestClient(t *testing.T, app *fiber.App) *HTTPTestClient {
	return &HTTPTestClient{
		t:   t,
		app: app,
	}
}

// WithAuth sets the authentication token for subsequent requests
func (c *HTTPTestClient) WithAuth(token string, userID string) *HTTPTestClient {
	c.token = token
	c.userID = userID
	return c
}

// GET performs a GET request
func (c *HTTPTestClient) GET(path string) *HTTPResponse {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	c.addAuthHeaders(req)
	
	resp, err := c.app.Test(req, -1)
	require.NoError(c.t, err, "Failed to perform GET request")
	
	return &HTTPResponse{t: c.t, resp: resp}
}

// POST performs a POST request with JSON body
func (c *HTTPTestClient) POST(path string, body interface{}) *HTTPResponse {
	jsonBody, err := json.Marshal(body)
	require.NoError(c.t, err, "Failed to marshal request body")
	
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	c.addAuthHeaders(req)
	
	resp, err := c.app.Test(req, -1)
	require.NoError(c.t, err, "Failed to perform POST request")
	
	return &HTTPResponse{t: c.t, resp: resp}
}

// PUT performs a PUT request with JSON body
func (c *HTTPTestClient) PUT(path string, body interface{}) *HTTPResponse {
	jsonBody, err := json.Marshal(body)
	require.NoError(c.t, err, "Failed to marshal request body")
	
	req := httptest.NewRequest(http.MethodPut, path, bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	c.addAuthHeaders(req)
	
	resp, err := c.app.Test(req, -1)
	require.NoError(c.t, err, "Failed to perform PUT request")
	
	return &HTTPResponse{t: c.t, resp: resp}
}

// PATCH performs a PATCH request with JSON body
func (c *HTTPTestClient) PATCH(path string, body interface{}) *HTTPResponse {
	jsonBody, err := json.Marshal(body)
	require.NoError(c.t, err, "Failed to marshal request body")
	
	req := httptest.NewRequest(http.MethodPatch, path, bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	c.addAuthHeaders(req)
	
	resp, err := c.app.Test(req, -1)
	require.NoError(c.t, err, "Failed to perform PATCH request")
	
	return &HTTPResponse{t: c.t, resp: resp}
}

// DELETE performs a DELETE request
func (c *HTTPTestClient) DELETE(path string) *HTTPResponse {
	req := httptest.NewRequest(http.MethodDelete, path, nil)
	c.addAuthHeaders(req)
	
	resp, err := c.app.Test(req, -1)
	require.NoError(c.t, err, "Failed to perform DELETE request")
	
	return &HTTPResponse{t: c.t, resp: resp}
}

// addAuthHeaders adds authentication headers to the request
func (c *HTTPTestClient) addAuthHeaders(req *http.Request) {
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	if c.userID != "" {
		req.Header.Set("X-User-ID", c.userID)
	}
}

// HTTPResponse wraps an HTTP response with testing utilities
type HTTPResponse struct {
	t    *testing.T
	resp *http.Response
}

// Status returns the status code
func (r *HTTPResponse) Status() int {
	return r.resp.StatusCode
}

// AssertStatus asserts the status code
func (r *HTTPResponse) AssertStatus(expected int) *HTTPResponse {
	require.Equal(r.t, expected, r.resp.StatusCode, 
		"Expected status %d, got %d", expected, r.resp.StatusCode)
	return r
}

// AssertOK asserts status 200
func (r *HTTPResponse) AssertOK() *HTTPResponse {
	return r.AssertStatus(http.StatusOK)
}

// AssertCreated asserts status 201
func (r *HTTPResponse) AssertCreated() *HTTPResponse {
	return r.AssertStatus(http.StatusCreated)
}

// AssertBadRequest asserts status 400
func (r *HTTPResponse) AssertBadRequest() *HTTPResponse {
	return r.AssertStatus(http.StatusBadRequest)
}

// AssertUnauthorized asserts status 401
func (r *HTTPResponse) AssertUnauthorized() *HTTPResponse {
	return r.AssertStatus(http.StatusUnauthorized)
}

// AssertNotFound asserts status 404
func (r *HTTPResponse) AssertNotFound() *HTTPResponse {
	return r.AssertStatus(http.StatusNotFound)
}

// Body returns the response body as bytes
func (r *HTTPResponse) Body() []byte {
	body, err := io.ReadAll(r.resp.Body)
	require.NoError(r.t, err, "Failed to read response body")
	return body
}

// JSON decodes the response body into the provided interface
func (r *HTTPResponse) JSON(v interface{}) *HTTPResponse {
	body := r.Body()
	err := json.Unmarshal(body, v)
	require.NoError(r.t, err, "Failed to unmarshal response body")
	return r
}

// AssertJSON asserts that the response body matches the expected JSON
func (r *HTTPResponse) AssertJSON(expected interface{}) *HTTPResponse {
	expectedJSON, err := json.Marshal(expected)
	require.NoError(r.t, err, "Failed to marshal expected JSON")
	
	actualJSON := r.Body()
	
	require.JSONEq(r.t, string(expectedJSON), string(actualJSON))
	return r
}

// AssertContains asserts that the response body contains a string
func (r *HTTPResponse) AssertContains(substr string) *HTTPResponse {
	body := string(r.Body())
	require.Contains(r.t, body, substr)
	return r
}

// AssertHeader asserts a header value
func (r *HTTPResponse) AssertHeader(key, value string) *HTTPResponse {
	actual := r.resp.Header.Get(key)
	require.Equal(r.t, value, actual, "Header %s mismatch", key)
	return r
}

// Print prints the response for debugging
func (r *HTTPResponse) Print() *HTTPResponse {
	body := r.Body()
	r.t.Logf("Response Status: %d\n", r.resp.StatusCode)
	r.t.Logf("Response Body: %s\n", string(body))
	return r
}
