# Spotlight Tour Fixes

## Issues Fixed

### 1. Tour Breaking at Part 3 (Drawer → Workspace Transition) ✅

**Problem**: The spotlight tour was breaking when transitioning from the drawer menu tour to the workspace tour.

**Root Cause**:
- The drawer tour step 3 (index 2) was calling `next()` after navigating to a new screen and closing the drawer
- This caused the tour to try to continue while the component was unmounting
- The transition between tours was not properly coordinated

**Solution**:
- Changed drawer step 3 to call `stop()` instead of `next()`
- The workspace tour starts automatically when the workspace loads (via useEffect)
- Increased workspace tour start delay from 1000ms to 1200ms to ensure drawer is fully closed
- Added workspace change detection to reset the trigger ref

**Files Modified**:
- `/frontend/components/home/Drawer.tsx`
- `/frontend/components/task/WorkspaceContent.tsx`
- `/frontend/app/(logged-in)/(tabs)/(task)/index.tsx`

### 2. React Hooks Order Violation ✅

**Problem**: "React has detected a change in the order of Hooks" error in ProfileGallery.

**Root Cause**:
- Added `useCallback` hook after conditional returns (early returns for loading/empty states)
- This violates React's Rules of Hooks - all hooks must be called before any returns

**Solution**:
- Moved `renderItem` useCallback hook before all conditional returns
- Ensures hooks are always called in the same order

**Files Modified**:
- `/frontend/components/profile/ProfileGallery.tsx`
- `/frontend/components/profile/BlueprintGallery.tsx`

## Tour Flow (Fixed)

### Complete Spotlight Tour Sequence:

1. **Home Screen Tour** (index.tsx)
   - Step 0: "Jump Back In" - Quick access features
   - Step 1: "Kudos" - Encouragements and congratulations
   - Step 2: "Menu" - Opens drawer and stops tour

2. **Drawer Tour** (Drawer.tsx) - Starts automatically when drawer opens
   - Step 0: "Workspaces" - Explains workspace concept
   - Step 1: "New Workspace" - Shows create button
   - Step 2: "Your Workspaces" - Shows workspace list, navigates to Kindred Guide, stops tour

3. **Workspace Tour** (WorkspaceContent.tsx) - Starts automatically when Kindred Guide loads
   - Step 0: "Workspace Settings" - Settings icon
   - Step 1: "Tasks" - Task cards and interaction
   - Step 2: "Categories" - Category organization

### Key Improvements:

1. **Proper Tour Termination**:
   ```typescript
   // Before (in Drawer step 2)
   next(); // ❌ Tries to continue tour while unmounting

   // After
   stop(); // ✅ Properly ends tour before navigation
   ```

2. **Automatic Tour Chaining**:
   - Each tour stops at screen transitions
   - Next tour starts automatically via useEffect when conditions are met
   - No manual `next()` calls across component boundaries

3. **Better Timing**:
   - Home → Drawer: 800ms delay for drawer animation
   - Drawer → Workspace: 1200ms delay for drawer close + workspace mount
   - Ensures components are fully mounted before tour starts

4. **State Management**:
   - `setSpotlightShown()` called immediately before navigation
   - Prevents tour from restarting on component remount
   - Workspace trigger ref resets when workspace changes

## Changes Made

### index.tsx (Home Screen)
```typescript
// Step 2: Menu button
onNext={() => {
    setSpotlightShown("homeSpotlight");
    drawerRef.current?.openDrawer();
    stop(); // Stop instead of next
}}
```

### Drawer.tsx
```typescript
// Step 2: Workspaces list
onNext={() => {
    setSpotlightShown("menuSpotlight");
    const kindredGuide = workspaces.find((w) => w.name === "🌺 Kindred Guide");
    if (kindredGuide) {
        setSelected("🌺 Kindred Guide");
        close();
    }
    stop(); // Stop instead of next
}}
```

### WorkspaceContent.tsx
```typescript
// Reset trigger when workspace changes
useEffect(() => {
    hasTriggeredRef.current = false;
}, [selected]);

// Increased delay for workspace tour start
setTimeout(() => {
    start();
}, 1200); // Was 1000ms
```

### ProfileGallery.tsx & BlueprintGallery.tsx
```typescript
// Moved useCallback BEFORE conditional returns
const renderItem = React.useCallback(...);

// Then conditional returns
if (isLoading) return <Skeleton />;
if (isEmpty) return <Empty />;
```

## Testing Recommendations

1. **Complete Tour Flow**:
   - Start from home screen
   - Go through all 3 steps
   - Verify drawer opens correctly
   - Verify drawer tour starts automatically
   - Complete drawer tour
   - Verify navigation to Kindred Guide
   - Verify workspace tour starts automatically
   - Complete workspace tour

2. **Edge Cases**:
   - Test skipping tours at various points
   - Test closing drawer manually during tour
   - Test navigating away during tour
   - Test with no Kindred Guide workspace (fallback behavior)

3. **Performance**:
   - Verify no console errors
   - Check that tours don't restart on remount
   - Verify smooth transitions between tours

## Known Limitations

1. **Timing Dependent**: Tours rely on setTimeout delays for transitions
2. **Workspace Specific**: Workspace tour only triggers for "🌺 Kindred Guide"
3. **One-Time Only**: Tours only show once per user (stored in AsyncStorage)

## Future Enhancements

1. Add haptic feedback on tour transitions
2. Add visual indicators for tour progress (1/3, 2/3, 3/3)
3. Add ability to restart tours from settings
4. Add analytics to track tour completion rates
5. Consider using navigation events instead of setTimeout for more reliable timing
