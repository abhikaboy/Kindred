# Google Calendar Deep Link Flow

## Overview

Implemented deep link handling for Google Calendar OAuth to automatically update the UI and trigger sync after successful connection.

## Flow Diagram

```
User taps "Connect"
    ↓
Frontend: Get OAuth URL from backend
    ↓
Frontend: Open OAuth URL in browser
    ↓
User authorizes on Google
    ↓
Google redirects to: backend.com/v1/calendar/oauth2/callback?code=xxx
    ↓
Backend: Exchange code for tokens
Backend: Store connection in database
Backend: Create workspace & categories
    ↓
Backend: HTTP 302 Redirect to: kindred://calendar/linked?connectionId=xxx
    ↓
App: Deep link opens calendar/[action].tsx route
    ↓
Frontend: Auto-sync calendar events
    ↓
Frontend: Show success alert with sync stats
    ↓
Frontend: Navigate back to home
    ↓
Home: Card updates to "Linked" state
```

## Implementation

### 1. Backend Changes

**File**: `backend/internal/handlers/calendar/calendar.go`

Updated `OAuthCallback` to return HTTP 302 redirect:

```go
// Success case
redirectURL := fmt.Sprintf("kindred://calendar/linked?connectionId=%s", connection.ID.Hex())
return &OAuthCallbackOutput{...}, huma.NewError(http.StatusFound, "Redirecting", map[string]string{
    "Location": redirectURL,
})

// Error case
redirectURL := "kindred://calendar/error?message=connection_failed"
return &OAuthCallbackOutput{...}, huma.NewError(http.StatusFound, "Redirecting", map[string]string{
    "Location": redirectURL,
})
```

**File**: `backend/internal/handlers/calendar/types.go`

Added `RedirectURL` field to response:

```go
type OAuthCallbackOutput struct {
    Body struct {
        Success     bool   `json:"success"`
        Message     string `json:"message"`
        RedirectURL string `json:"redirect_url"`
    }
}
```

### 2. Frontend Deep Link Handler

**File**: `frontend/app/calendar/[action].tsx` (NEW)

Dynamic route that handles:
- `kindred://calendar/linked?connectionId=xxx` - Success
- `kindred://calendar/error?message=xxx` - Error

**On Success**:
1. Automatically calls `syncCalendarEvents(connectionId)`
2. Shows alert with sync statistics
3. Navigates back to home page
4. Home page refreshes and shows "Linked" state

**On Error**:
1. Shows error alert
2. Navigates back to home page

### 3. Frontend Connect Flow

**File**: `frontend/components/dashboard/HomescrollContent.tsx`

Simplified connect function:

```typescript
const handleConnectCalendar = async () => {
    setCalendarLoading(true);
    try {
        const { auth_url } = await connectGoogleCalendar();

        // Open OAuth - backend will redirect to deep link
        await WebBrowser.openAuthSessionAsync(auth_url);

        // Refresh connection status when user returns
        const { connections } = await getCalendarConnections();
        if (connections && connections.length > 0) {
            setIsCalendarLinked(true);
            setCalendarConnection(connections[0]);
        }
    } catch (error) {
        Alert.alert("Error", "Failed to connect Google Calendar.");
    } finally {
        setCalendarLoading(false);
    }
};
```

## Deep Link URLs

### Success
```
kindred://calendar/linked?connectionId=507f1f77bcf86cd799439011
```

**Params**:
- `action`: "linked"
- `connectionId`: MongoDB ObjectID of the connection

### Error
```
kindred://calendar/error?message=connection_failed
```

**Params**:
- `action`: "error"
- `message`: Error description

## User Experience

### Before (Without Deep Link)
1. User taps "Connect"
2. OAuth opens in browser
3. User authorizes
4. Browser closes
5. **User has to manually refresh or tap sync**
6. Card doesn't update automatically

### After (With Deep Link)
1. User taps "Connect"
2. OAuth opens in browser
3. User authorizes
4. Browser closes
5. **App automatically opens to callback screen**
6. **Events sync automatically**
7. **Success alert shows sync stats**
8. **Card updates to "Linked" state**
9. User is back on home page

## Success Alert

```
┌─────────────────────────────────────┐
│        Calendar Linked!             │
├─────────────────────────────────────┤
│ Successfully synced 8 events to     │
│ "📅 Google Calendar" workspace.     │
│                                     │
│ Created: 8                          │
│ Skipped: 2                          │
│ Total: 10                           │
│                                     │
│              [ OK ]                 │
└─────────────────────────────────────┘
```

## Error Handling

### Connection Failed
```
┌─────────────────────────────────────┐
│      Connection Failed              │
├─────────────────────────────────────┤
│ Error: connection_failed            │
│                                     │
│              [ OK ]                 │
└─────────────────────────────────────┘
```

### Sync Failed (After Successful Link)
```
┌─────────────────────────────────────┐
│       Calendar Linked               │
├─────────────────────────────────────┤
│ Your calendar was linked            │
│ successfully, but we couldn't sync  │
│ events automatically. You can sync  │
│ manually from the home page.        │
│                                     │
│              [ OK ]                 │
└─────────────────────────────────────┘
```

## Testing

### Test Success Flow
1. Tap "Connect" on calendar card
2. Authorize on Google
3. Verify deep link opens: `kindred://calendar/linked?connectionId=xxx`
4. Verify auto-sync happens
5. Verify success alert appears
6. Verify navigation back to home
7. Verify card shows "Linked" state

### Test Error Flow
1. Tap "Connect" on calendar card
2. Deny authorization on Google
3. Verify deep link opens: `kindred://calendar/error?message=xxx`
4. Verify error alert appears
5. Verify navigation back to home
6. Verify card still shows "Connect" state

### Test Sync Failure
1. Complete OAuth successfully
2. Simulate sync API failure
3. Verify fallback alert appears
4. Verify card still updates to "Linked" state

## Files Modified/Created

### Backend
1. **UPDATED**: `backend/internal/handlers/calendar/calendar.go` - HTTP redirect
2. **UPDATED**: `backend/internal/handlers/calendar/types.go` - Added RedirectURL field

### Frontend
1. **NEW**: `frontend/app/calendar/[action].tsx` - Deep link handler
2. **UPDATED**: `frontend/components/dashboard/HomescrollContent.tsx` - Simplified connect flow

## App Configuration

Deep link scheme already configured in `app.json`:
```json
{
  "scheme": ["kindred", "com.googleusercontent.apps..."]
}
```

## Benefits

✅ **Automatic UI Update** - Card changes to "Linked" immediately
✅ **Auto-Sync** - Events sync without user action
✅ **Better UX** - Seamless flow from OAuth to synced events
✅ **Error Handling** - Clear feedback on failures
✅ **No Polling** - Efficient, event-driven architecture
✅ **Native Feel** - Deep link integration feels native

## Next Steps

Optional enhancements:
1. Add loading animation during auto-sync
2. Show progress indicator for large syncs
3. Add option to skip auto-sync
4. Handle multiple calendar connections
5. Add "View Synced Events" button in success alert
