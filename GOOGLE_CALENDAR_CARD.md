# Google Calendar Connection Card

## Overview

Added a dismissible card to the home page that prompts users to connect their Google Calendar account.

## What Was Added

### 1. GoogleCalendarCard Component

**File**: `frontend/components/cards/GoogleCalendarCard.tsx`

A reusable card component with:
- **Left**: Calendar icon in a colored container
- **Middle**: Title and subtitle text
- **Right**: Dismiss button (X) and Connect button with arrow

**Features**:
- Loading state with spinner
- Dismissible with X button
- Themed colors using `useThemeColor`
- Phosphor icons (CalendarBlank, ArrowRight, X)
- Responsive layout with proper spacing

**Props**:
```typescript
interface GoogleCalendarCardProps {
    onConnect: () => void;      // Called when Connect button is pressed
    onDismiss?: () => void;     // Called when X button is pressed
    loading?: boolean;          // Shows loading spinner in Connect button
}
```

### 2. Integration in HomeScrollContent

**File**: `frontend/components/dashboard/HomescrollContent.tsx`

**Added**:
- Import for `GoogleCalendarCard` component
- Import for `AsyncStorage` to persist dismissal
- State management for card visibility and loading
- Handlers for connect and dismiss actions
- Card placement above "RECENT WORKSPACES" section

**Functionality**:
- Card shows by default on first visit
- Dismissal is persisted in AsyncStorage with key `"google_calendar_card_dismissed"`
- Once dismissed, card won't show again
- Connect button shows loading spinner while connecting
- Ready for OAuth flow integration

## UI Layout

```
┌─────────────────────────────────────────────┐
│  [📅]  Connect Google Calendar        [X] [Connect →] │
│        Sync your events as tasks                      │
└─────────────────────────────────────────────┘
```

## Placement

The card appears on the home page in this order:
1. JUMP BACK IN (Dashboard Cards)
2. KUDOS
3. UPCOMING (Today Section)
4. **→ Google Calendar Card** ← NEW
5. RECENT WORKSPACES
6. Recently Completed Tasks
7. Tutorial Card

## Next Steps

To complete the integration:

1. **Implement OAuth Flow**:
   ```typescript
   const handleConnectGoogleCalendar = async () => {
       setConnectingCalendar(true);
       try {
           // Navigate to OAuth endpoint
           const response = await fetch('/v1/user/calendar/connect/google');
           const { auth_url } = await response.json();

           // Open OAuth URL in browser
           await WebBrowser.openAuthSessionAsync(auth_url, redirectUrl);

           // Handle callback and store connection
       } catch (error) {
           console.error("Error connecting:", error);
       } finally {
           setConnectingCalendar(false);
       }
   };
   ```

2. **Check for Existing Connection**:
   ```typescript
   // Hide card if user already has a calendar connected
   React.useEffect(() => {
       const checkConnection = async () => {
           const response = await fetch('/v1/user/calendar/connections');
           const { connections } = await response.json();
           if (connections.length > 0) {
               setShowGoogleCalendarCard(false);
           }
       };
       checkConnection();
   }, []);
   ```

3. **Add Success Feedback**:
   - Show toast/alert on successful connection
   - Automatically hide card after connection
   - Navigate to calendar sync page

## Design Details

### Colors
- Icon background: `ThemedColor.primary` with 15% opacity
- Icon color: `ThemedColor.primary`
- Connect button: `ThemedColor.primary` background with white text
- Dismiss button: `ThemedColor.caption`

### Spacing
- Card padding: Inherited from `BasicCard`
- Internal gap: 12px between elements
- Icon container: 48x48px with 12px border radius
- Button padding: 16px horizontal, 10px vertical

### Typography
- Title: `defaultSemiBold`, 15px
- Subtitle: `caption`, 13px, 70% opacity
- Button text: `defaultSemiBold`, 14px, white

### Icons
- Calendar: 24px, duotone weight
- Arrow: 16px, bold weight
- X: 18px, bold weight

## Testing

To test the card:

1. **Initial Display**:
   - Card should appear on home page above "RECENT WORKSPACES"
   - All elements should be visible and properly aligned

2. **Dismiss Functionality**:
   - Tap X button
   - Card should disappear
   - Reload app - card should stay hidden

3. **Connect Button**:
   - Tap Connect button
   - Loading spinner should appear
   - Console should log "Connect Google Calendar"

4. **Reset for Testing**:
   ```typescript
   // Clear AsyncStorage to show card again
   await AsyncStorage.removeItem("google_calendar_card_dismissed");
   ```

## Files Modified

1. **NEW**: `frontend/components/cards/GoogleCalendarCard.tsx` - Card component
2. **UPDATED**: `frontend/components/dashboard/HomescrollContent.tsx` - Integration

## Dependencies

- `phosphor-react-native` - Icons (already installed)
- `@react-native-async-storage/async-storage` - Persistence (already installed)
- `react-native` - Core components (already installed)
