# Spotlight Tutorial Flow - Visual Guide

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HOME SCREEN                                  │
│  homeSpotlight = false, menuSpotlight = false                       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
                    [User opens app/home]
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      HOME SPOTLIGHT 🏠                               │
│  Shows: "Welcome to Kindred"                                         │
│  Action: "Open the menu to see your workspaces"                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
                    [User clicks "Open Menu"]
                              ↓
                    ⏱️  Drawer opens (animation)
                              ↓
                    homeSpotlight = true ✅
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      MENU SPOTLIGHT 📚                               │
│  Condition: homeSpotlight = true && !menuSpotlight                  │
│  Delay: 800ms (wait for drawer animation)                           │
│  Shows 3 steps:                                                      │
│    1. "Workspaces organize your tasks"                              │
│    2. "Create new workspace button"                                 │
│    3. "Your workspaces are listed here"                             │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
                [User completes menu spotlight]
                              ↓
                    menuSpotlight = true ✅
                              ↓
                    ⏱️  100ms delay (save state)
                              ↓
                    Select "🌺 Kindred Guide"
                              ↓
                    Close drawer
                              ↓
                    ⏱️  300ms delay (drawer animation)
                              ↓
                    Navigate to workspace screen
                              ↓
                    ⏱️  Component mounts & renders
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   WORKSPACE SPOTLIGHT ⚙️                             │
│  Conditions (ALL must be true):                                     │
│    ✓ selected === "🌺 Kindred Guide"                                │
│    ✓ !workspaceSpotlight                                            │
│    ✓ menuSpotlight = true                                           │
│    ✓ pathname is workspace route                                    │
│  Delay: 1000ms (page fully loaded)                                  │
│  Shows 3 steps:                                                      │
│    1. "Workspace settings gear icon"                                │
│    2. "This is a task with priority"                                │
│    3. "Click category name to create task"                          │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
                [User completes workspace spotlight]
                              ↓
                    workspaceSpotlight = true ✅
                              ↓
                [User clicks category to create task]
                              ↓
                    ⏱️  Modal opens
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      TASK SPOTLIGHT ✅                               │
│  Conditions:                                                         │
│    ✓ !taskSpotlight                                                 │
│    ✓ workspaceSpotlight = true                                      │
│    ✓ !edit (not editing existing task)                              │
│  Delay: 800ms (modal animation)                                     │
│  Shows: Task creation tutorial                                      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
                    taskSpotlight = true ✅
                              ↓
                    ALL SPOTLIGHTS COMPLETE! 🎉
```

## Timing Breakdown

### Menu → Workspace Transition (Critical Fix)

```
Event                           Time        State Change
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User clicks "Next"              T+0ms       
AsyncStorage.setItem()          T+0ms       menuSpotlight → true
                               T+100ms     
Set workspace selection        T+100ms     selected → "🌺 Kindred Guide"
Close drawer                   T+100ms     Drawer closing animation starts
                               T+400ms     Drawer fully closed
Navigate to workspace          T+400ms     router.navigate() called
                               T+500ms     Navigation transition
                               T+600ms     Workspace component mounts
Check conditions               T+600ms     All conditions evaluated
                               T+1600ms    1000ms delay completes
START workspace spotlight      T+1600ms    🎯 Spotlight fires!
```

### Why Each Delay Matters

#### 100ms Delay (After State Save)
- **Purpose:** Ensure AsyncStorage write completes
- **Without it:** Race condition - navigation might happen before state is saved
- **With it:** State is guaranteed to be persisted before any navigation

#### 300ms Delay (Drawer Animation)
- **Purpose:** Wait for drawer close animation
- **Without it:** User sees drawer closing while navigating (jarring UX)
- **With it:** Clean transition, drawer is fully closed before navigation

#### 1000ms Delay (Workspace Loading)
- **Purpose:** Ensure page is fully rendered with all data
- **Without it:** Spotlight might attach to elements that aren't rendered yet
- **With it:** All UI elements are present and spotlight can properly attach

## Route Checking (Prevents Wrong Screen Firing)

```typescript
// OLD (BUGGY): Could fire on ANY screen
if (selected === "🌺 Kindred Guide" && 
    !workspaceSpotlight && 
    menuSpotlight) {
    start(); // ❌ Fires on feed, search, etc.
}

// NEW (FIXED): Only fires on workspace screen
const isWorkspaceRoute = 
    pathname === "/(logged-in)/(tabs)/(task)" || 
    pathname.includes("/(logged-in)/(tabs)/(task)/workspace");

if (selected === "🌺 Kindred Guide" && 
    !workspaceSpotlight && 
    menuSpotlight &&
    isWorkspaceRoute) {
    start(); // ✅ Only fires on correct screen
}
```

### Pathname Values

| Screen          | Pathname                                  | Should Fire? |
|-----------------|-------------------------------------------|--------------|
| Home Feed       | `/(logged-in)/(tabs)`                     | ❌ No        |
| Workspace       | `/(logged-in)/(tabs)/(task)`              | ✅ Yes       |
| Workspace (alt) | `/(logged-in)/(tabs)/(task)/workspace`    | ✅ Yes       |
| Search          | `/(logged-in)/(tabs)/(search)/search`     | ❌ No        |
| Profile         | `/(logged-in)/(tabs)/(profile)`           | ❌ No        |

## State Flow Chart

```
Initial State:
┌──────────────────────────────────────┐
│ homeSpotlight: false                 │
│ menuSpotlight: false                 │
│ workspaceSpotlight: false            │
│ taskSpotlight: false                 │
└──────────────────────────────────────┘

After Home Spotlight:
┌──────────────────────────────────────┐
│ homeSpotlight: true      ✅          │
│ menuSpotlight: false                 │
│ workspaceSpotlight: false            │
│ taskSpotlight: false                 │
└──────────────────────────────────────┘
         ↓ Opens drawer

After Menu Spotlight:
┌──────────────────────────────────────┐
│ homeSpotlight: true      ✅          │
│ menuSpotlight: true      ✅          │
│ workspaceSpotlight: false            │
│ taskSpotlight: false                 │
└──────────────────────────────────────┘
         ↓ Navigate with delays

After Workspace Spotlight:
┌──────────────────────────────────────┐
│ homeSpotlight: true      ✅          │
│ menuSpotlight: true      ✅          │
│ workspaceSpotlight: true ✅          │
│ taskSpotlight: false                 │
└──────────────────────────────────────┘
         ↓ Open task modal

Final State:
┌──────────────────────────────────────┐
│ homeSpotlight: true      ✅          │
│ menuSpotlight: true      ✅          │
│ workspaceSpotlight: true ✅          │
│ taskSpotlight: true      ✅          │
└──────────────────────────────────────┘
```

## Troubleshooting Guide

### Symptom: Workspace spotlight doesn't fire at all

**Check:**
1. ✓ Is `menuSpotlight` true?
2. ✓ Is `workspaceSpotlight` false?
3. ✓ Is selected workspace "🌺 Kindred Guide"?
4. ✓ Is pathname a workspace route?

### Symptom: Workspace spotlight fires on feed

**Cause:** Pathname check is missing or incorrect
**Solution:** Verify `isWorkspaceRoute` includes pathname check

### Symptom: Workspace spotlight fires too early

**Cause:** Delays are too short
**Solution:** Increase 1000ms delay in workspace.tsx

### Symptom: Menu spotlight doesn't navigate

**Cause:** Workspace "🌺 Kindred Guide" doesn't exist
**Solution:** Ensure user has this default workspace created

