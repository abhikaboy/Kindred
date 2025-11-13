# Blueprint Generation Flow

This document describes the blueprint generation flow implemented using Genkit.

## Overview

The `generateBlueprintFlow` allows users to generate complete, structured blueprints using AI based on a simple text description. The flow leverages the user's existing workspace context to create relevant and personalized blueprints.

## Flow Details

### Input
```go
type GenerateBlueprintInput struct {
    UserID      string // User's MongoDB ObjectID as hex string
    Description string // Description of the blueprint (e.g., "Morning routine for productivity")
}
```

### Output
```go
type GenerateBlueprintOutput struct {
    Blueprint BlueprintData
}

type BlueprintData struct {
    Name        string                  // Name of the blueprint
    Description string                  // Detailed description
    Banner      string                  // Banner image URL or color scheme
    Tags        []string                // Tags for categorization
    Duration    string                  // Expected duration (e.g., "45m", "1h 30m")
    Category    string                  // Primary category
    Categories  []BlueprintCategory     // Categories with tasks
}
```

## How It Works

1. **User Context Retrieval**: The flow calls the `getUserCategories` tool to understand the user's existing workspace organization
2. **AI Generation**: Using Gemini 2.5-flash, the flow generates a comprehensive blueprint with:
   - 2-5 logically organized categories
   - 3-8 actionable tasks per category
   - Appropriate priority levels and task values
   - Time-based fields (start dates, deadlines, reminders)
   - Recurring task patterns where relevant
3. **Structured Output**: The AI returns a fully structured blueprint ready for use

## Usage

### API Endpoint

**POST** `/v1/user/blueprints/generate`

Generates a blueprint using AI and saves it to the database. The authenticated user becomes the owner of the blueprint.

#### Request
```json
{
  "description": "Morning routine for productivity and health"
}
```

#### Response
```json
{
  "id": "507f1f77bcf86cd799439011",
  "name": "Morning Productivity & Health Routine",
  "description": "A comprehensive morning routine combining productivity habits with health-focused activities",
  "banner": "#4A90E2",
  "tags": ["productivity", "morning", "health", "routine"],
  "duration": "1h 15m",
  "category": "productivity",
  "categories": [
    {
      "id": "507f1f77bcf86cd799439012",
      "name": "Wake Up & Mindfulness",
      "workspaceName": "Morning Productivity & Health Routine",
      "tasks": [...]
    }
  ],
  "owner": {
    "id": "507f1f77bcf86cd799439013",
    "displayName": "John Doe",
    "handle": "@johndoe",
    "profilePicture": "..."
  },
  "subscribers": [],
  "subscribersCount": 0,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### Cost
Requires **1 AI credit** (Natural Language credit).

### Genkit Developer UI

The flow is also accessible through Genkit Dev UI for testing and development:
- Development and testing of blueprint generation
- Experimenting with different prompts and parameters
- Quality assurance
- Creating example blueprints for the marketplace

## Testing with Genkit Dev UI

To test this flow in the Genkit Developer UI:

1. Start the backend server with Genkit:
```bash
cd backend
genkit start -- go run cmd/server/main.go
```

2. Open the Genkit Dev UI (URL shown in terminal)

3. Select the `generateBlueprintFlow` flow

4. Provide test input:
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "description": "Weekly meal prep plan for healthy eating"
}
```

5. Run the flow and inspect the generated blueprint

## Example Use Cases

- **Morning/Evening Routines**: "Morning routine for productivity"
- **Meal Planning**: "Weekly meal prep plan"
- **Fitness**: "Beginner workout routine for home"
- **Learning**: "30-day guitar learning plan"
- **Work**: "Project kickoff checklist"
- **Self-care**: "Weekly self-care routine"

## Implementation Notes

- The flow uses reflection to avoid circular imports between the gemini and blueprint packages
- The AI considers the user's existing categories to create contextually appropriate blueprints
- Generated blueprints are not automatically saved - the frontend receives the blueprint data and can save it via the regular blueprint creation endpoint
- Tasks include all necessary fields for immediate use (priorities, deadlines, reminders, etc.)

