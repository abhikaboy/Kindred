# Alert Queue Implementation

## Problem
When clicking post options and then selecting "Report Post" or "Block User", a secondary alert would appear but the modal would dismiss immediately, making it unusable. This was because multiple alerts were competing for the same state.

## Solution
Implemented a global **AlertContext** with an alert queue system that manages sequential alerts automatically.

## What Was Changed

### 1. Created AlertContext (`frontend/contexts/AlertContext.tsx`)
- Manages a queue of alerts
- Shows alerts sequentially (one at a time)
- Automatically processes the queue when an alert is dismissed
- Uses a new `QueuedAlert` component for full control

**Key Features:**
- ✅ Alerts are queued and shown in order
- ✅ No race conditions or timing conflicts
- ✅ Automatic queue processing
- ✅ 300ms delay between alerts for smooth transitions

### 1.5. Created QueuedAlert Component (`frontend/components/modals/QueuedAlert.tsx`)
- Simplified alert component specifically designed for queue management
- Uses `onDismiss` callback instead of `setVisible` for cleaner control
- No internal setTimeout conflicts
- Identical UI to CustomAlert

### 2. Added AlertProvider to App Root (`frontend/app/_layout.tsx`)
- Wrapped the app with `<AlertProvider>`
- Now all components can use the alert queue via `useAlert()` hook

### 3. Refactored PostCard (`frontend/components/cards/PostCard.tsx`)
**Removed:**
- Local alert state (`alertVisible`, `alertTitle`, `alertMessage`, `alertButtons`)
- CustomAlert component instance
- setTimeout workarounds

**Added:**
- `const { showAlert } = useAlert()`
- All alerts now use `showAlert()` with config objects

**Simplified Functions:**
- `showPostOptions()` - Uses showAlert
- `showDeleteConfirmation()` - Uses showAlert
- `handleReportPost()` - Uses showAlert (no more setTimeout!)
- `handleBlockUser()` - Uses showAlert (no more setTimeout!)

## How It Works

### Before (Broken):
```tsx
// First alert
setAlertVisible(true);
setAlertTitle("Post Options");
setAlertButtons([...]);

// User clicks "Report Post"
// Second alert tries to show but conflicts with first
setAlertVisible(false); // Dismiss first
setTimeout(() => {
  setAlertVisible(true); // Show second
  setAlertTitle("Report Post");
}, 100); // Hacky delay
```

### After (Clean):
```tsx
// First alert
showAlert({
  title: "Post Options",
  buttons: [...]
});

// User clicks "Report Post"
// Second alert is automatically queued
showAlert({
  title: "Report Post",
  buttons: [...]
});

// AlertContext handles the rest!
```

## Usage in Other Components

Any component can now use the alert queue:

```tsx
import { useAlert } from '@/contexts/AlertContext';

function MyComponent() {
  const { showAlert } = useAlert();
  
  const handleAction = () => {
    showAlert({
      title: "Confirm Action",
      message: "Are you sure?",
      buttons: [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => doAction() }
      ]
    });
  };
}
```

## Benefits

1. **No More Race Conditions** - Alerts are queued automatically
2. **Cleaner Code** - No setTimeout hacks
3. **Reusable** - Any component can use the alert queue
4. **Automatic** - Queue processing happens automatically
5. **Type Safe** - Full TypeScript support
6. **Consistent** - All alerts behave the same way

## What About Bottom Sheets?

Bottom sheets (like the comments section) are **NOT** part of the alert queue because:
- They're non-blocking
- They're dismissible by swiping
- They can coexist with other UI
- They're for complex interactions, not decisions

Only use the alert queue for:
- ✅ Confirmations (delete, block, etc.)
- ✅ Simple choices with 2-4 options
- ✅ Blocking dialogs that need user attention

## Migration Guide

To migrate other components to use the alert queue:

1. **Remove local alert state:**
```tsx
// Remove these:
const [alertVisible, setAlertVisible] = useState(false);
const [alertTitle, setAlertTitle] = useState("");
const [alertMessage, setAlertMessage] = useState("");
const [alertButtons, setAlertButtons] = useState([]);
```

2. **Add useAlert hook:**
```tsx
import { useAlert } from '@/contexts/AlertContext';

const { showAlert } = useAlert();
```

3. **Replace alert calls:**
```tsx
// Old:
setAlertTitle("Title");
setAlertMessage("Message");
setAlertButtons([...]);
setAlertVisible(true);

// New:
showAlert({
  title: "Title",
  message: "Message",
  buttons: [...]
});
```

4. **Remove CustomAlert component:**
```tsx
// Remove this from JSX:
<CustomAlert
  visible={alertVisible}
  setVisible={setAlertVisible}
  title={alertTitle}
  message={alertMessage}
  buttons={alertButtons}
/>
```

## Testing

Test the alert queue by:
1. Opening post options (...)
2. Clicking "Report Post" - should show report reasons without dismissing
3. Clicking "Block User" - should show confirmation without dismissing
4. Clicking through multiple alerts in sequence - should queue properly

All alerts should now work smoothly without premature dismissal!
