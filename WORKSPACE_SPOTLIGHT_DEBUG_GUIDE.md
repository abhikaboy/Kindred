# Workspace Spotlight Debug Guide

## 🐛 Issue
The workspace spotlight (third step in onboarding) doesn't fire after completing the menu spotlight.

## 🔍 Debug Logging Added

I've added comprehensive console logging to track the spotlight flow. Here's what to look for:

### 1. **Drawer.tsx (Menu Spotlight Completion)**
When you complete the menu spotlight tour:
```
🎬 Menu spotlight complete - starting transition to workspace...
✅ Menu spotlight marked as shown
📍 Found Kindred Guide workspace, navigating...
🚀 Navigating to task screen...
```

### 2. **SpotlightContext.tsx (State Updates)**
When spotlight states are updated:
```
💡 setSpotlightShown(menuSpotlight): { oldState: {...}, newState: {...} }
✅ Persisted menuSpotlight to AsyncStorage
```

### 3. **workspace.tsx (Workspace Spotlight Trigger Check)**
Every time the workspace component renders:
```
🔍 Workspace Spotlight Check: {
  selected: "🌺 Kindred Guide",
  pathname: "/(logged-in)/(tabs)/(task)",
  workspaceSpotlightShown: false,
  menuSpotlightShown: true,
  spotlightState: {...}
}
✅ isWorkspaceRoute: true
🎯 Should trigger workspace spotlight? true
⏰ Setting 1 second timer for workspace spotlight...
🚀 Starting workspace spotlight!
```

## 📊 What to Check

### Test the Flow:
1. **Reset your spotlights** (from settings or dev menu)
2. **Open the app** and go through the home spotlight
3. **Complete the menu spotlight** - watch for the drawer logs
4. **Navigate to Kindred Guide workspace** - watch for workspace logs

### Expected Console Output:
```
1. Menu Spotlight Completes:
   🎬 Menu spotlight complete - starting transition to workspace...
   💡 setSpotlightShown(menuSpotlight): ...
   ✅ Menu spotlight marked as shown
   📍 Found Kindred Guide workspace, navigating...
   ✅ Persisted menuSpotlight to AsyncStorage

2. Drawer Closes & Navigation (300ms delay):
   🚀 Navigating to task screen...

3. Workspace Component Mounts:
   🔍 Workspace Spotlight Check: { selected: "🌺 Kindred Guide", ... }
   ✅ isWorkspaceRoute: true
   🎯 Should trigger workspace spotlight? true
   ⏰ Setting 1 second timer for workspace spotlight...

4. After 1 Second:
   🚀 Starting workspace spotlight!
```

## 🔧 Common Issues to Diagnose

### Issue 1: State Not Updating
**Symptoms:**
```
💡 setSpotlightShown(menuSpotlight): { oldState: {...}, newState: {...} }
🔍 Workspace Spotlight Check: { menuSpotlightShown: false, ... }
```
**Problem:** State update not propagating
**Solution:** Check if SpotlightContext is properly wrapping the component tree

### Issue 2: Wrong Workspace Selected
**Symptoms:**
```
🔍 Workspace Spotlight Check: { selected: "Some Other Workspace", ... }
```
**Problem:** Navigation not selecting Kindred Guide
**Solution:** Check if "🌺 Kindred Guide" workspace exists

### Issue 3: Wrong Route
**Symptoms:**
```
✅ isWorkspaceRoute: false
🔍 Workspace Spotlight Check: { pathname: "/(logged-in)/(tabs)/(feed)", ... }
```
**Problem:** Navigation went to wrong screen
**Solution:** Check router.navigate() call in Drawer.tsx

### Issue 4: Spotlight Already Shown
**Symptoms:**
```
🔍 Workspace Spotlight Check: { workspaceSpotlightShown: true, ... }
```
**Problem:** Workspace spotlight was already completed
**Solution:** Reset spotlights from settings

### Issue 5: Menu Spotlight Not Complete
**Symptoms:**
```
🔍 Workspace Spotlight Check: { menuSpotlightShown: false, ... }
```
**Problem:** Menu spotlight completion didn't save properly
**Solution:** Check setSpotlightShown() is being called

## 🧪 Testing Commands

### Reset Spotlights (add to your dev menu):
```typescript
import { useSpotlight } from "@/contexts/SpotlightContext";

const { resetSpotlights } = useSpotlight();
// Call resetSpotlights() to start fresh
```

### Manually Check State:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// In console or dev tools:
const userId = "YOUR_USER_ID";
const state = await AsyncStorage.getItem(`${userId}-spotlight`);
console.log('Current spotlight state:', JSON.parse(state));
```

## 📝 Next Steps

1. **Run the app** and go through the onboarding
2. **Watch the console** for the logged output
3. **Copy the console logs** and share them
4. **Identify which step fails** based on the logs above

The logs will tell us exactly where the flow is breaking!

