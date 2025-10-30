package spaces

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"testing"
)

/*
	End to end test for the upload flow.
	1. Fetch a random image from the API
	2. Get a presigned upload URL from your backend
	3. Upload the image to Digital Ocean Spaces
	4. Confirm the upload with your backend
	5. Verify the upload was successful
	6. Output the public URL
*/

func TestUploadFlow(t *testing.T) {
	BACKEND_BASE_URL := "http://localhost:8080"
	RESOURCE_TYPE := "test"
	RESOURCE_ID := "507f1f77bcf86cd799439011"
	FILE_TYPE := "image/jpeg"
	IMAGE_API_URL := "https://picsum.photos/200"

	// 1. Fetch a random image from the API
	imageRes, err := http.Get(IMAGE_API_URL)
	if err != nil {
		t.Fatalf("Failed to fetch image: %v", err)
	}
	defer imageRes.Body.Close()
	imageBuffer, err := io.ReadAll(imageRes.Body)
	if err != nil {
		t.Fatalf("Failed to read image: %v", err)
	}

	// 2. Get a presigned upload URL from your backend
	// URI Encode the file type
	encodedFileType := url.QueryEscape(FILE_TYPE)
	presignRes, err := http.Get(
		fmt.Sprintf("%s/v1/uploads/%s/%s/url?file_type=%s", BACKEND_BASE_URL, RESOURCE_TYPE, RESOURCE_ID, encodedFileType),
	)
	if err != nil {
		t.Fatalf("Failed to get presigned upload URL: %v", err)
	}
	defer presignRes.Body.Close()

	// 3. Parse the JSON response to extract the upload_url
	presignedURLBytes, err := io.ReadAll(presignRes.Body)
	if err != nil {
		t.Fatalf("Failed to read presigned URL: %v", err)
	}

	// Parse the JSON response to extract the upload_url
	var response struct {
		UploadURL string `json:"upload_url"`
		Key       string `json:"key"`
		PublicURL string `json:"public_url"`
		Message   string `json:"message"`
	}

	if err := json.Unmarshal(presignedURLBytes, &response); err != nil {
		t.Fatalf("Failed to parse JSON response: %v", err)
	}

	slog.Info("Presigned URL:", "url", response.UploadURL, "public_url", response.PublicURL)

	// 4. Upload the image to Digital Ocean Spaces
	req, err := http.NewRequest(http.MethodPut, response.UploadURL, bytes.NewReader(imageBuffer))
	if err != nil {
		t.Fatalf("Failed to create upload request: %v", err)
	}
	req.Header.Set("Content-Type", FILE_TYPE)
	req.Header.Set("x-amz-acl", "public-read")

	client := &http.Client{}
	uploadRes, err := client.Do(req)
	if err != nil {
		t.Fatalf("Failed to upload image to Spaces: %v", err)
	}
	defer uploadRes.Body.Close()

	// 5. Confirm the upload with your backend
	confirmBody := map[string]string{
		"public_url": response.PublicURL,
	}
	confirmBodyBytes, err := json.Marshal(confirmBody)
	if err != nil {
		t.Fatalf("Failed to marshal confirm body: %v", err)
	}

	confirmRes, err := http.Post(
		fmt.Sprintf("%s/v1/uploads/%s/%s/confirm", BACKEND_BASE_URL, RESOURCE_TYPE, RESOURCE_ID),
		"application/json",
		bytes.NewReader(confirmBodyBytes),
	)
	if err != nil {
		t.Fatalf("Failed to confirm upload: %v", err)
	}
	defer confirmRes.Body.Close()

	// 6. Verify the upload was successful
	if uploadRes.StatusCode != http.StatusOK {
		t.Fatalf("Upload failed with status: %d", uploadRes.StatusCode)
	}

	// 7. Output the public URL
	confirmData, err := io.ReadAll(confirmRes.Body)
	if err != nil {
		t.Fatalf("Failed to read confirm response: %v", err)
	}
	fmt.Println("Upload confirmed:", string(confirmData))
	fmt.Println("Image is now available at:", response.PublicURL)
}
