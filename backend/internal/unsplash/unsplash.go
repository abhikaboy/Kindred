package unsplash

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

const (
	baseURL = "https://api.unsplash.com"
)

type Client struct {
	accessKey  string
	httpClient *http.Client
}

type Photo struct {
	ID             string `json:"id"`
	Width          int    `json:"width"`
	Height         int    `json:"height"`
	Color          string `json:"color"`
	Description    string `json:"description"`
	AltDescription string `json:"alt_description"`
	URLs           struct {
		Raw     string `json:"raw"`
		Full    string `json:"full"`
		Regular string `json:"regular"`
		Small   string `json:"small"`
		Thumb   string `json:"thumb"`
	} `json:"urls"`
	Links struct {
		Self             string `json:"self"`
		HTML             string `json:"html"`
		Download         string `json:"download"`
		DownloadLocation string `json:"download_location"`
	} `json:"links"`
	User struct {
		ID       string `json:"id"`
		Username string `json:"username"`
		Name     string `json:"name"`
	} `json:"user"`
}

func NewClient(accessKey string) *Client {
	return &Client{
		accessKey: accessKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SearchPhotos searches for photos based on a query
func (c *Client) SearchPhotos(ctx context.Context, query string, perPage int) ([]Photo, error) {
	if perPage <= 0 {
		perPage = 1
	}
	if perPage > 30 {
		perPage = 30
	}

	endpoint := fmt.Sprintf("%s/search/photos", baseURL)

	params := url.Values{}
	params.Add("query", query)
	params.Add("per_page", fmt.Sprintf("%d", perPage))
	params.Add("orientation", "landscape")

	req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("%s?%s", endpoint, params.Encode()), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Client-ID %s", c.accessKey))
	req.Header.Set("Accept-Version", "v1")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var result struct {
		Results []Photo `json:"results"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result.Results, nil
}

// GetRandomPhoto gets a random photo, optionally filtered by query
func (c *Client) GetRandomPhoto(ctx context.Context, query string) (*Photo, error) {
	endpoint := fmt.Sprintf("%s/photos/random", baseURL)

	params := url.Values{}
	if query != "" {
		params.Add("query", query)
	}
	params.Add("orientation", "landscape")

	urlStr := endpoint
	if len(params) > 0 {
		urlStr = fmt.Sprintf("%s?%s", endpoint, params.Encode())
	}

	req, err := http.NewRequestWithContext(ctx, "GET", urlStr, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Client-ID %s", c.accessKey))
	req.Header.Set("Accept-Version", "v1")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var photo Photo
	if err := json.NewDecoder(resp.Body).Decode(&photo); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &photo, nil
}

// TriggerDownload triggers a download event (required by Unsplash API guidelines)
func (c *Client) TriggerDownload(ctx context.Context, downloadLocation string) error {
	if downloadLocation == "" {
		return nil // Skip if no download location provided
	}

	req, err := http.NewRequestWithContext(ctx, "GET", downloadLocation, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Client-ID %s", c.accessKey))
	req.Header.Set("Accept-Version", "v1")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return nil
}
