# Google Calendar Card - Final Implementation

## Overview

The Google Calendar card now intelligently detects if a calendar is linked and changes its behavior accordingly:
- **Not Linked**: Shows "Connect" button to initiate OAuth
- **Linked**: Shows "Linked" badge and "Sync" button to sync events

## What Was Implemented

### 1. Calendar API (`frontend/api/calendar.ts`)

New API module with functions for:
- `getCalendarConnections()` - Check if user has linked calendars
- `connectGoogleCalendar()` - Get OAuth URL to initiate connection
- `syncCalendarEvents(connectionId)` - Sync calendar events to tasks
- `disconnectCalendar(connectionId)` - Remove calendar connection
- `getCalendarEvents(connectionId)` - Fetch events without syncing

### 2. Updated GoogleCalendarCard Component

**Two States**:

#### Not Linked State
```
┌─────────────────────────────────────────────┐
│  [📅]  Google Calendar              [X] [Connect →] │
│        Sync your events as tasks                    │
└─────────────────────────────────────────────┘
```

#### Linked State
```
┌─────────────────────────────────────────────┐
│  [✓]  Google Calendar [Linked]         [Sync ↻] │
│       Sync your calendar events                  │
└─────────────────────────────────────────────┘
```

**Visual Changes When Linked**:
- Icon changes from Calendar to CheckCircle (filled)
- Icon background becomes slightly more opaque
- "Linked" badge appears next to title
- Subtitle text changes
- Dismiss (X) button is hidden
- Action button changes from primary color to lightened background
- Action button text changes from "Connect" to "Sync"
- Icon changes from ArrowRight to ArrowsClockwise

### 3. Smart Connection Detection

The HomeScrollContent now:
1. Checks AsyncStorage for dismissal status
2. Queries backend for existing calendar connections
3. Updates card state based on connection status
4. Always shows card if calendar is linked (can't dismiss)

### 4. OAuth Flow Integration

**Connect Flow**:
```typescript
1. User taps "Connect" button
2. Call backend: GET /v1/user/calendar/connect/google
3. Receive auth_url from backend
4. Open OAuth in browser with WebBrowser.openAuthSessionAsync()
5. User authorizes on Google
6. Backend handles callback and stores tokens
7. Refresh connection status
8. Card updates to "Linked" state
```

**Sync Flow**:
```typescript
1. User taps "Sync" button
2. Call backend: POST /v1/user/calendar/connections/{id}/sync
3. Backend fetches events and creates tasks
4. Show success alert with stats
5. Refresh tasks list
```

## API Integration

### Endpoints Used

```typescript
// Check for connections
GET /v1/user/calendar/connections
Response: { connections: CalendarConnection[] }

// Initiate OAuth
GET /v1/user/calendar/connect/google
Response: { auth_url: string }

// Sync events
POST /v1/user/calendar/connections/{connectionId}/sync
Response: {
  tasks_created: number,
  tasks_skipped: number,
  events_total: number,
  workspace_name: string,
  categories_synced: Record<string, number>
}
```

### Types

```typescript
interface CalendarConnection {
    id: string;
    user_id: string;
    provider: "google" | "outlook" | "apple";
    provider_account_id: string;
    scopes: string[];
    is_primary: boolean;
    last_sync: string;
    created_at: string;
    updated_at: string;
}
```

## User Experience Flow

### First Time User
1. Sees card with "Connect Google Calendar"
2. Can dismiss with X button (card won't show again)
3. Taps "Connect" → OAuth flow opens
4. Authorizes Google Calendar
5. Returns to app → Card now shows "Linked" badge

### Returning User (Linked)
1. Sees card with "Linked" badge
2. No dismiss button (always visible)
3. Taps "Sync" → Events sync to tasks
4. Sees success alert with sync stats
5. Tasks refresh automatically

## Success Feedback

After syncing, user sees an alert:
```
Sync Complete

Synced 8 events to "📅 Google Calendar" workspace.

Created: 8
Skipped: 2
Total: 10
```

## Error Handling

Both connect and sync operations show error alerts if they fail:
```typescript
Alert.alert("Error", "Failed to connect Google Calendar. Please try again.");
Alert.alert("Error", "Failed to sync calendar events. Please try again.");
```

## Loading States

- Button shows spinner while connecting/syncing
- Button is disabled during loading
- Spinner color adapts to button background (white for primary, primary color for lightened)

## State Management

```typescript
const [showGoogleCalendarCard, setShowGoogleCalendarCard] = useState(true);
const [calendarLoading, setCalendarLoading] = useState(false);
const [isCalendarLinked, setIsCalendarLinked] = useState(false);
const [calendarConnection, setCalendarConnection] = useState<CalendarConnection | null>(null);
```

## Files Modified/Created

1. **NEW**: `frontend/api/calendar.ts` - Calendar API functions
2. **UPDATED**: `frontend/components/cards/GoogleCalendarCard.tsx` - Dual-state card
3. **UPDATED**: `frontend/components/dashboard/HomescrollContent.tsx` - Connection detection & sync logic

## Testing Checklist

### Not Linked State
- [ ] Card shows "Connect Google Calendar"
- [ ] X button is visible
- [ ] Connect button shows arrow icon
- [ ] Tapping X dismisses card permanently
- [ ] Tapping Connect opens OAuth flow

### Linked State
- [ ] Card shows "Google Calendar" with "Linked" badge
- [ ] Check icon is shown instead of calendar icon
- [ ] No X button visible
- [ ] Sync button shows refresh icon
- [ ] Tapping Sync triggers sync and shows success alert
- [ ] Tasks refresh after sync

### Loading States
- [ ] Connect button shows spinner while connecting
- [ ] Sync button shows spinner while syncing
- [ ] Button is disabled during loading

### Error Handling
- [ ] Failed connection shows error alert
- [ ] Failed sync shows error alert
- [ ] Card remains functional after errors

## Next Steps

### Optional Enhancements

1. **Last Sync Timestamp**:
   ```typescript
   <ThemedText type="caption">
       Last synced: {formatRelativeTime(connection.last_sync)}
   </ThemedText>
   ```

2. **Sync Settings**:
   - Allow user to configure sync date range
   - Show which calendars are being synced
   - Add manual calendar selection

3. **Disconnect Option**:
   - Add settings page with disconnect button
   - Confirm before disconnecting
   - Clean up workspace after disconnect

4. **Auto-Sync**:
   - Background sync on app launch
   - Periodic sync (every X hours)
   - Push notification when new events synced

5. **Multiple Providers**:
   - Support Outlook Calendar
   - Support Apple Calendar
   - Show multiple cards for different providers

## Dependencies

All dependencies are already installed:
- `expo-web-browser` - OAuth flow
- `@react-native-async-storage/async-storage` - Persistence
- `phosphor-react-native` - Icons
- `openapi-fetch` - API client
