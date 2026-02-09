# Calendar Event to Task Sync Implementation

## Overview

Implemented automatic workspace and category creation when connecting Google Calendar, plus event-to-task sync functionality with duplicate prevention.

## What Was Implemented

### 1. Data Model Updates

**CategoryDocument** (`backend/internal/handlers/types/types.go`)
- Added `Integration` field to track calendar integration metadata
- Format: `"gcal:{connection_id}:{calendar_id}"`

**CalendarConnection** (`backend/internal/handlers/calendar/models.go`)
- Added `LastSync` field to track when events were last synced

**MongoDB Index** (`backend/internal/storage/xmongo/indexes.go`)
- Added sparse index on `tasks.integration` field for faster duplicate checking
- Note: Cannot use unique constraint on array fields, so duplicates are prevented via application logic

### 2. OAuth Flow Enhancement

**CreateWorkspaceAndCategories** (`backend/internal/handlers/calendar/service.go`)
- Automatically called after successful OAuth connection
- Creates workspace: "📅 Google Calendar"
- Lists all user's calendars (primary, secondary, shared, subscribed)
- Creates a category for each calendar with integration metadata
- Idempotent: skips categories that already exist

**Updated HandleCallback**
- Now calls `CreateWorkspaceAndCategories` after storing connection
- Non-blocking: logs error but doesn't fail connection if workspace creation fails

### 3. Event Converter

**converter.go** (new file: `backend/internal/handlers/calendar/converter.go`)
- `ConvertEventToTaskParams`: Converts calendar events to task creation parameters
- Field mappings:
  - `event.Summary` → `task.Content`
  - `event.StartTime` → `task.StartTime` and `task.StartDate`
  - `event.EndTime` → `task.Deadline`
  - `event.Description` + `event.Location` + `event.Attendees` → `task.Notes`
  - `event.ID` + `event.CalendarID` → `task.Integration` (format: `"gcal:{calendar_id}:{event_id}"`)
- Special handling for all-day events (only sets dates, not times)
- Default values: Priority 2, Value 5.0, Public false, Active true

### 4. Sync Service

**SyncEventsToTasks** (`backend/internal/handlers/calendar/service.go`)
- Fetches events from all calendars in the connection
- Groups events by calendar ID
- For each calendar:
  - Finds matching category using integration field
  - Converts events to tasks
  - Attempts to create tasks in the category
  - MongoDB unique index automatically prevents duplicates
  - Catches duplicate key errors and counts as "skipped"
- Updates connection's `last_sync` timestamp
- Returns detailed statistics:
  - Tasks created
  - Tasks skipped (duplicates)
  - Total events processed
  - Per-category sync counts
  - Workspace name

### 5. API Endpoint

**POST /v1/user/calendar/connections/{connectionId}/sync**

**Query Parameters:**
- `start` (optional): Start date in RFC3339 format (defaults to 2 days ago)
- `end` (optional): End date in RFC3339 format (defaults to 2 days from now)

**Response:**
```json
{
  "tasks_created": 8,
  "tasks_skipped": 2,
  "events_total": 10,
  "workspace_name": "📅 Google Calendar",
  "categories_synced": {
    "Primary": 5,
    "Work": 3,
    "Family": 2
  }
}
```

## Architecture

### Workspace and Category Structure

```
📅 Google Calendar (workspace)
├── Primary (category)
│   └── integration: "gcal:{connection_id}:abhikaboy@gmail.com"
├── Work (category)
│   └── integration: "gcal:{connection_id}:work@group.calendar.google.com"
└── Family (category)
    └── integration: "gcal:{connection_id}:family@group.calendar.google.com"
```

### After Sync

```
📅 Google Calendar
├── Primary
│   ├── Team Meeting (task, integration: "gcal:abhikaboy@gmail.com:event123")
│   └── Dentist Appointment (task, integration: "gcal:abhikaboy@gmail.com:event456")
├── Work
│   └── Project Review (task, integration: "gcal:work@group...:event789")
└── Family
    └── Birthday Party (task, integration: "gcal:family@group...:event012")
```

## Duplicate Prevention

Uses application-level checking before inserting tasks:
- Each task has a unique integration ID: `"gcal:{calendar_id}:{event_id}"`
- Before inserting, queries category to check if task with same integration ID exists
- If found, skips creation and increments "skipped" counter
- If not found, creates the task
- Indexed on `tasks.integration` for fast lookups
- Ensures uniqueness per category (same event can't be synced twice to same category)

## Files Modified/Created

1. **UPDATED**: `backend/internal/handlers/types/types.go` - Added integration field to CategoryDocument and TaskDocument
2. **UPDATED**: `backend/internal/storage/xmongo/indexes.go` - Added sparse index on tasks.integration for faster duplicate checking
3. **UPDATED**: `backend/internal/handlers/calendar/models.go` - Added last_sync field
4. **UPDATED**: `backend/internal/handlers/calendar/service.go` - Added CreateWorkspaceAndCategories and SyncEventsToTasks
5. **NEW**: `backend/internal/handlers/calendar/converter.go` - Event to task conversion logic
6. **UPDATED**: `backend/internal/handlers/calendar/types.go` - Added SyncEvents types
7. **UPDATED**: `backend/internal/handlers/calendar/calendar.go` - Added SyncEvents handler
8. **UPDATED**: `backend/internal/handlers/calendar/operations.go` - Registered sync operation
9. **UPDATED**: `backend/internal/handlers/calendar/routes.go` - Registered sync route and passed categories collection

## Testing

### Initial Connection Flow

1. User connects Google Calendar via OAuth
2. System creates "📅 Google Calendar" workspace
3. System lists all user's calendars
4. System creates a category for each calendar
5. Each category stores integration metadata

### Sync Flow

```bash
# First sync - creates tasks
POST /v1/user/calendar/connections/{id}/sync
# Response: {"tasks_created": 5, "tasks_skipped": 0, "events_total": 5}

# Verify tasks created in categories
GET /v1/user/workspaces
# Should see "📅 Google Calendar" workspace with categories

# Second sync - should skip duplicates
POST /v1/user/calendar/connections/{id}/sync
# Response: {"tasks_created": 0, "tasks_skipped": 5, "events_total": 5}

# Add new event in Google Calendar, then sync again
POST /v1/user/calendar/connections/{id}/sync
# Response: {"tasks_created": 1, "tasks_skipped": 5, "events_total": 6}
```

## Build Status

✅ Backend builds successfully with no errors
✅ All planned features implemented
✅ Ready for testing
