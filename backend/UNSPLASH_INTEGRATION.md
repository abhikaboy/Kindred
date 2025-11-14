# Unsplash Integration for Blueprint Banners

## Overview

The blueprint generation flow now automatically fetches high-quality banner images from Unsplash based on the blueprint's theme using the Unsplash API.

## Setup

### 1. Get an Unsplash API Key

1. Go to [Unsplash Developers](https://unsplash.com/developers)
2. Create an account or log in
3. Create a new application
4. Copy your **Access Key**

### 2. Add to Environment Variables

Add the following to your `.env` file:

```bash
UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here
```

## How It Works

### Genkit Tool: `fetchUnsplashImage`

A new Genkit tool has been added that the AI can call during blueprint generation:

```go
type FetchUnsplashImageInput struct {
    Query string // e.g., "morning sunrise coffee", "fitness gym workout"
}

type FetchUnsplashImageOutput struct {
    URL                  string // Regular sized image URL for banners
    ThumbnailURL         string // Thumbnail sized image URL
    Description          string // Image description
    AltDescription       string // Alternative description
    Color                string // Dominant color as hex code
    Photographer         string // Photographer's name
    PhotographerUsername string // Unsplash username
    Width                int    // Image width in pixels
    Height               int    // Image height in pixels
}
```

### Blueprint Generation Flow

When generating a blueprint, the AI:

1. Analyzes the blueprint description/theme
2. Calls `fetchUnsplashImage` with a relevant search query
3. Uses the returned image URL for the blueprint's `banner` field

Example queries the AI might use:
- **Morning Routine**: "morning sunrise coffee"
- **Workout Plan**: "fitness gym workout"  
- **Meal Prep**: "healthy food meal prep"
- **Study Plan**: "books study learning"

### Unsplash API Compliance

The integration follows Unsplash API guidelines:
- Uses landscape-oriented images
- Triggers download tracking (required by Unsplash)
- Respects rate limits (50 requests/hour for demo apps)
- Provides photographer attribution data

## Usage Example

When a user requests a blueprint like:

```
"Create a morning productivity routine for me"
```

The AI will:
1. Call `getUserCategories` to understand the user's workspace
2. Call `fetchUnsplashImage` with query like `"morning sunrise productivity"`
3. Generate a complete blueprint with:
   - Name: "Morning Productivity Routine"
   - Banner: `https://images.unsplash.com/photo-...`
   - Tasks organized in categories
   - All metadata (tags, duration, etc.)

## Fallback Behavior

If the Unsplash API key is not configured:
- A warning is logged on server startup
- The tool will return an error if called
- The AI can still generate blueprints but will need to use placeholder colors or URLs for banners

## Rate Limits

- **Demo Apps**: 50 requests per hour
- **Production Apps**: Contact Unsplash for higher limits

Consider caching frequently used banner images or implementing a CDN strategy for production use.

## Code Structure

### New Files

- **`internal/unsplash/unsplash.go`**: Unsplash API client
- **`internal/config/unsplash.go`**: Unsplash configuration

### Modified Files

- **`internal/config/config.go`**: Added Unsplash config
- **`internal/gemini/tools.go`**: Added `fetchUnsplashImage` tool
- **`internal/gemini/types.go`**: Added Unsplash input/output types
- **`internal/gemini/genkit.go`**: Pass Unsplash client to tools
- **`internal/gemini/flows.go`**: Updated blueprint flow prompt to use Unsplash tool
- **`cmd/server/main.go`**: Initialize Unsplash client

## API Methods

### Client Creation

```go
client := unsplash.NewClient(accessKey)
```

### Get Random Photo

```go
photo, err := client.GetRandomPhoto(ctx, "productivity")
```

### Search Photos

```go
photos, err := client.SearchPhotos(ctx, "workspace", 5)
```

### Trigger Download (Required)

```go
err := client.TriggerDownload(ctx, photo.Links.DownloadLocation)
```

## Attribution

When displaying images from Unsplash, you should provide attribution to the photographer. The `FetchUnsplashImageOutput` includes:
- `Photographer`: Name to display
- `PhotographerUsername`: For linking to their Unsplash profile

Example attribution format:
```
Photo by [Photographer Name] on Unsplash
Link: https://unsplash.com/@[photographer_username]
```

## Testing

To test the integration:

1. Set `UNSPLASH_ACCESS_KEY` in your `.env`
2. Start the server
3. Call the blueprint generation endpoint with a description
4. Verify the blueprint's `banner` field contains an Unsplash image URL

Example request:
```bash
curl -X POST http://localhost:8080/v1/genkit/generateBlueprintFlow \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "507f1f77bcf86cd799439011",
    "description": "Morning productivity routine with exercise and breakfast"
  }'
```

## Future Enhancements

- Cache popular banner images to reduce API calls
- Allow users to select from multiple banner options
- Support custom banner upload as alternative
- Implement banner image optimization/resizing
- Add banner image attribution display in frontend

