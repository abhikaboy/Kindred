# Memory Leak Fixes

## Summary
Fixed multiple memory leaks and unbounded cache growth issues in the React Native application that could cause performance degradation and crashes over time.

## Critical Issues Fixed

### Cache & Storage Management

### 1. **QueryClient Recreation on Every Render** (CRITICAL)
**File:** `frontend/app/_layout.tsx`
**Issue:** QueryClient was being created inside the component, causing a new instance on every render.
**Fix:** Moved QueryClient instantiation outside the component to ensure a single instance.
```typescript
// Before: Inside component
const queryClient = new QueryClient({...});

// After: Outside component
const queryClient = new QueryClient({...});
export default Sentry.wrap(function RootLayout() {
```

### 2. **AlertContext Timeouts Not Cleaned Up**
**File:** `frontend/contexts/AlertContext.tsx`
**Issue:** Multiple setTimeout calls without cleanup on unmount.
**Fix:** Added useEffect cleanup for all timeout refs:
- `processingTimeoutRef`
- `dismissTimeoutRef`
- `buttonTimeoutRef`

### 3. **CalendarView requestAnimationFrame Leak**
**File:** `frontend/components/daily/CalendarView.tsx`
**Issue:** `requestAnimationFrame` calls in auto-scroll effect were not canceled on unmount.
**Fix:** Added cleanup to cancel pending animation frames:
```typescript
return () => {
    if (rafId1) cancelAnimationFrame(rafId1);
    if (rafId2) cancelAnimationFrame(rafId2);
};
```

### 4. **Animation Loop Leaks**
Fixed animation loops that were not stopped on component unmount:

#### a. SpinningDashedCircle
**File:** `frontend/components/ui/SpinningDashedCircle.tsx`
**Issue:** Infinite rotation animation loop not stopped.
**Fix:** Store loop reference and stop in cleanup.

#### b. EncourageModal
**File:** `frontend/components/modals/EncourageModal.tsx`
**Issue:** Glow pulse animation loop not stopped.
**Fix:** Store loop reference and stop in cleanup when visibility changes or on unmount.

#### c. Circle Onboarding
**File:** `frontend/app/(onboarding)/circle.tsx`
**Issue:** Two animation loops (rotation and label switching) not stopped.
**Fix:** Store both loop references and stop in cleanup.

## Already Correct Implementations ✅

These files had proper cleanup and serve as good examples:

1. **SearchBox** (`frontend/components/SearchBox.tsx`)
   - Properly cleans up `blurTimeoutRef` on unmount
   - Uses `isMountedRef` pattern correctly

2. **Search Page** (`frontend/app/(logged-in)/(tabs)/(search)/search.tsx`)
   - Properly cleans up `debounceTimerRef` on unmount

3. **Comment Component** (`frontend/components/inputs/Comment.tsx`)
   - Properly removes keyboard listeners in useEffect cleanup

4. **Blueprint Layout** (`frontend/app/(logged-in)/blueprint/_layout.tsx`)
   - Properly removes keyboard listeners in useEffect cleanup

5. **Productivity Onboarding** (`frontend/app/(onboarding)/productivity.tsx`)
   - Properly stops animation loop and clears timeout

6. **BackgroundGraphics** (`frontend/components/onboarding/BackgroundGraphics.tsx`)
   - Properly stops all 6 animation loops

7. **EnhancedSplashScreen** (`frontend/components/ui/EnhancedSplashScreen.tsx`)
   - Properly stops float loop and clears timeout

8. **Task Timer** (`frontend/app/(logged-in)/(tabs)/(task)/task/[id].tsx`)
   - Properly clears interval with isMounted pattern

9. **TaskGenerationLoading** (`frontend/components/TaskGenerationLoading.tsx`)
   - Properly stops all animation loops (bounce, glow) and clears interval

10. **LoadingScreen** (`frontend/components/ui/LoadingScreen.tsx`)
    - Properly stops pulse animation and clears interval

## Best Practices Applied

### 1. Animation Loops
```typescript
useEffect(() => {
    const animationLoop = Animated.loop(
        Animated.timing(value, {...})
    );
    animationLoop.start();

    return () => {
        animationLoop.stop();
    };
}, []);
```

### 2. Timeouts
```typescript
useEffect(() => {
    const timeoutId = setTimeout(() => {...}, delay);

    return () => {
        clearTimeout(timeoutId);
    };
}, []);
```

### 3. Intervals
```typescript
useEffect(() => {
    const intervalId = setInterval(() => {...}, delay);

    return () => {
        clearInterval(intervalId);
    };
}, []);
```

### 4. Event Listeners
```typescript
useEffect(() => {
    const listener = Keyboard.addListener('keyboardDidShow', handler);

    return () => {
        listener.remove();
    };
}, []);
```

### 5. Animation Frames
```typescript
useEffect(() => {
    let rafId: number;

    rafId = requestAnimationFrame(() => {...});

    return () => {
        if (rafId) cancelAnimationFrame(rafId);
    };
}, []);
```

## Testing Recommendations

1. **Monitor Memory Usage:**
   - Use React DevTools Profiler
   - Check for growing component counts
   - Monitor native memory in Xcode/Android Studio

2. **Test Navigation:**
   - Navigate between screens multiple times
   - Check if components unmount properly
   - Verify no lingering timers/animations

3. **Test Modals:**
   - Open and close modals repeatedly
   - Verify animations stop when closed
   - Check for cleanup on unmount

4. **Long-Running Sessions:**
   - Leave app running for extended periods
   - Monitor memory growth over time
   - Check for gradual performance degradation

## Cache & Storage Improvements

### 1. **QueryClient Cache Limits**
**File:** `frontend/app/_layout.tsx`
**Issue:** React Query cache could grow unbounded without garbage collection.
**Fix:** Added `cacheTime` and `gcTime` settings:
```typescript
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            cacheTime: 1000 * 60 * 10, // 10 minutes
            gcTime: 1000 * 60 * 10, // 10 minutes (v5 property)
        },
    },
});
```

### 2. **Alert Queue Size Limit**
**File:** `frontend/contexts/AlertContext.tsx`
**Issue:** Alert queue could grow unbounded if many alerts are triggered rapidly.
**Fix:** Added `MAX_ALERT_QUEUE_SIZE` constant (10 items) to limit queue growth:
```typescript
const MAX_ALERT_QUEUE_SIZE = 10;
// In showAlert:
if (newQueue.length > MAX_ALERT_QUEUE_SIZE) {
    return newQueue.slice(-MAX_ALERT_QUEUE_SIZE);
}
```

### 3. **AsyncStorage Cache Cleanup**
**Files:**
- `frontend/utils/cacheCleanup.ts` (new)
- `frontend/hooks/useCacheCleanup.tsx` (new)

**Issue:** AsyncStorage could accumulate old cache entries indefinitely.
**Fix:** Created utilities and hook for automatic cache cleanup:

#### Features:
- **Automatic cleanup**: Runs once per day when app becomes active
- **Age-based removal**: Removes cache entries older than 7 days
- **Pattern matching**: Targets specific cache key patterns
- **Storage stats**: Can monitor AsyncStorage usage
- **Array size limiting**: Utility to limit array sizes in storage

#### Usage:
```typescript
// In _layout.tsx
useCacheCleanup({
    maxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    patterns: ['cache_', 'workspaces_cache_', 'temp_'],
    enableLogging: __DEV__,
});
```

### 4. **Bounded Collections Already in Place** ✅

These were already correctly implemented:

- **Recent Searches**: Limited to 6 items (`useRecentSearch.tsx`)
- **Recent Workspaces**: Limited to 6 items (`tasksContext.tsx`)

## Cache Management Best Practices

### 1. AsyncStorage Keys Should Include Timestamps
```typescript
await AsyncStorage.setItem(key, JSON.stringify({
    data: yourData,
    timestamp: Date.now()
}));
```

### 2. Limit Array Sizes
```typescript
const MAX_ITEMS = 10;
const newArray = [...oldArray, newItem].slice(-MAX_ITEMS);
```

### 3. Use Cache Expiration
```typescript
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
if ((Date.now() - timestamp) > CACHE_DURATION) {
    // Cache expired, fetch fresh data
}
```

### 4. Clean Up on User Logout
When users log out, clear their cached data to prevent accumulation across sessions.

## Monitoring Recommendations

### 1. **AsyncStorage Size**
```typescript
import { getStorageStats } from '@/utils/cacheCleanup';

const stats = await getStorageStats();
console.log(`Keys: ${stats.keyCount}, Size: ${stats.totalSize} chars`);
```

### 2. **React Query Cache**
Use React Query DevTools in development to monitor cache size and query states.

### 3. **Memory Profiling**
- Use React DevTools Profiler
- Monitor native memory in Xcode/Android Studio
- Check for growing component counts
- Profile long-running sessions

## Image Memory Management

### 1. **ProfileGallery Animation Loop** (FIXED)
**File:** `frontend/components/profile/ProfileGallery.tsx`
**Issue:** Skeleton shimmer animation loop not stopped on unmount.
**Fix:** Added cleanup to stop animation loop.

### 2. **ProfileGallery FlatList Optimization** (IMPROVED)
**File:** `frontend/components/profile/ProfileGallery.tsx`
**Issue:** FlatList not optimized for image rendering, keeping all images in memory.
**Fix:** Added performance optimizations:
```typescript
<FlatList
    removeClippedSubviews={true}
    maxToRenderPerBatch={12}
    windowSize={5}
    initialNumToRender={18}
/>
```

### 3. **Image Memory Best Practices** ✅

Your app uses `expo-image` which is excellent! Key features:
- Automatic memory management
- Built-in LRU cache (~50MB memory, ~100MB disk)
- Native optimization (SDWebImage/Glide)
- Automatic cache eviction

**CachedImage Component** (`frontend/components/CachedImage.tsx`):
- ✅ Uses variants (thumbnail, medium, large)
- ✅ Disk caching for thumbnails
- ✅ Image downscaling enabled
- ✅ RGB decode format (25% less memory than RGBA)

**Potential Issue - Image.getSize in PostCard:**
`frontend/components/cards/PostCard.tsx` line 364 uses `Image.getSize()` without cleanup. See `IMAGE_MEMORY_MANAGEMENT.md` for recommended fix.

## Additional Notes

- The commented-out Accelerometer listener in `_layout.tsx` (lines 83-102) would need cleanup if re-enabled
- All context providers should be reviewed for similar patterns
- Consider using a linter rule to enforce cleanup for useEffect hooks with side effects
- AsyncStorage cleanup runs automatically but can be manually triggered if needed
- Cache patterns can be customized per environment or user preferences
- See `IMAGE_MEMORY_MANAGEMENT.md` for comprehensive image optimization guide
