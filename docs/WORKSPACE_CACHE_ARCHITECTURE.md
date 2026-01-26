# Workspace Cache Architecture - How We Prevent Stale Data

## Overview

The workspace cache system uses **AsyncStorage** with a **5-minute TTL** (time-to-live) and **aggressive invalidation** on any local mutation. This ensures users never see stale data while maintaining fast load times.

## Cache Strategy Summary

```
Cache Duration: 5 minutes
Cache Key: workspaces_cache_${userId}
Storage: AsyncStorage (device-local)
Invalidation: Immediate on ANY local mutation
```

## How It Works

### 1. Cache Structure

```typescript
// Cache entry stored in AsyncStorage
{
  data: Workspace[],      // Array of all workspaces with categories and tasks
  timestamp: number       // Unix timestamp when cached
}
```

### 2. Fetch Flow with Cache

```typescript
fetchWorkspaces(forceRefresh: boolean = false)
```

**Step-by-step:**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User navigates to task screen                           │
│    → fetchWorkspaces() is called                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Check if forceRefresh = true?                           │
│    YES → Skip cache, go to API (Step 5)                    │
│    NO  → Continue to Step 3                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Try to load from AsyncStorage                           │
│    const cached = await AsyncStorage.getItem(CACHE_KEY)    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Is cache valid?                                          │
│    • Does cache exist?                                      │
│    • Is it < 5 minutes old?                                 │
│                                                             │
│    YES → Use cached data, return immediately ✅             │
│    NO  → Continue to Step 5                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Fetch from API                                           │
│    const data = await fetchUserWorkspaces(userId)           │
│    const blueprints = await getUserSubscribedBlueprints()   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Update state & cache                                     │
│    setWorkSpaces([...data, ...blueprints])                  │
│    await AsyncStorage.setItem(CACHE_KEY, {                  │
│      data: allWorkspaces,                                   │
│      timestamp: Date.now()                                  │
│    })                                                       │
└─────────────────────────────────────────────────────────────┘
```

### 3. Cache Invalidation on Mutations

**Every mutation function calls `invalidateWorkspacesCache()`:**

```typescript
const invalidateWorkspacesCache = async () => {
    try {
        await AsyncStorage.removeItem(WORKSPACES_CACHE_KEY);
        console.log("Workspaces cache invalidated");
    } catch (error) {
        console.error("Error invalidating workspaces cache:", error);
    }
};
```

**When does this happen?**

```
┌─────────────────────────────────────────────────────────────┐
│ User Action                → Cache Invalidated              │
├─────────────────────────────────────────────────────────────┤
│ Complete a task            → ✅ invalidateWorkspacesCache() │
│ Add a task                 → ✅ invalidateWorkspacesCache() │
│ Update task properties     → ✅ invalidateWorkspacesCache() │
│ Delete a task              → ✅ invalidateWorkspacesCache() │
│ Create a category          → ✅ invalidateWorkspacesCache() │
│ Rename a category          → ✅ invalidateWorkspacesCache() │
│ Delete a category          → ✅ invalidateWorkspacesCache() │
│ Create a workspace         → ✅ invalidateWorkspacesCache() │
│ Rename a workspace         → ✅ invalidateWorkspacesCache() │
│ Delete a workspace         → ✅ invalidateWorkspacesCache() │
│ Move task to category      → ✅ invalidateWorkspacesCache() │
│ Voice/text task creation   → ✅ invalidateWorkspacesCache() │
└─────────────────────────────────────────────────────────────┘
```

## Example: Complete Task Flow

Let's trace what happens when a user completes a task:

### Before Cache Invalidation (The Problem)

```
1. User completes "Buy groceries" task
   → updateTask() updates local state
   → UI shows task as completed ✅

2. User navigates to another screen
   
3. User navigates back to tasks
   → fetchWorkspaces() is called
   → Cache is still valid (< 5 minutes old)
   → Loads stale cache where task is NOT completed
   → UI reverts to show task as incomplete ❌
   
RESULT: User's action was lost!
```

### After Cache Invalidation (The Fix)

```
1. User completes "Buy groceries" task
   → updateTask() updates local state
   → UI shows task as completed ✅
   → invalidateWorkspacesCache() removes cache 🗑️

2. User navigates to another screen
   
3. User navigates back to tasks
   → fetchWorkspaces() is called
   → No cache found (was invalidated)
   → Fetches fresh data from API
   → API returns task as completed
   → UI shows task as completed ✅
   
RESULT: User's action persists correctly!
```

## Code Examples

### Task Update with Cache Invalidation

```typescript
const updateTask = (taskId: string, updates: Partial<Task>) => {
    // 1. Find and update task in local state
    let workspacesCopy = JSON.parse(JSON.stringify(workspaces));
    
    workspacesCopy.forEach((workspace: Workspace) => {
        workspace.categories.forEach((category: Categories) => {
            const taskIndex = category.tasks.findIndex((t: Task) => t.id === taskId);
            if (taskIndex !== -1) {
                category.tasks[taskIndex] = {
                    ...category.tasks[taskIndex],
                    ...updates
                };
            }
        });
    });
    
    // 2. Update state (UI updates immediately)
    setWorkSpaces(workspacesCopy);
    
    // 3. Invalidate cache (prevents stale data)
    invalidateWorkspacesCache();
};
```

### Workspace Rename with Cache Invalidation

```typescript
const renameWorkspace = async (oldName: string, newName: string) => {
    // 1. Optimistic update - update UI immediately
    let workspacesCopy = workspaces.slice();
    const workspaceIndex = workspacesCopy.findIndex(w => w.name === oldName);
    if (workspaceIndex !== -1) {
        workspacesCopy[workspaceIndex].name = newName;
        setWorkSpaces(workspacesCopy);
    }
    
    // 2. Invalidate cache immediately
    await invalidateWorkspacesCache();
    
    try {
        // 3. Call API to persist change
        await renameWorkspaceAPI(oldName, newName);
        
        // 4. Fetch fresh data to ensure consistency
        await fetchWorkspaces();
    } catch (error) {
        // 5. Rollback on error
        workspacesCopy[workspaceIndex].name = oldName;
        setWorkSpaces(workspacesCopy);
        throw error;
    }
};
```

## Why This Approach Works

### ✅ Advantages

1. **No Stale Data**
   - Any mutation immediately invalidates cache
   - Next fetch always gets fresh data from API
   - User changes are never lost

2. **Fast Performance**
   - Cache hits avoid API calls (< 5 minutes)
   - Optimistic updates make UI feel instant
   - Only fetch when cache is invalid or expired

3. **Simple & Reliable**
   - Clear invalidation rules: "mutate = invalidate"
   - No complex cache update logic
   - Easy to debug and maintain

4. **User-Specific**
   - Cache key includes user ID
   - Different users don't share cache
   - Switching accounts works correctly

### ⚠️ Trade-offs

1. **Network Usage**
   - After any mutation, next fetch hits API
   - Could be optimized with smarter cache updates
   - Not a problem for typical usage patterns

2. **Race Conditions (Handled)**
   - Multiple rapid mutations could cause issues
   - Mitigated by optimistic updates
   - Final fetch ensures consistency

## Edge Cases Handled

### 1. Multiple Devices

```
Device A: User completes task
Device B: Still has old cache

Solution: Cache expires after 5 minutes
         Device B will fetch fresh data
```

### 2. Offline Mode

```
User makes changes offline
Cache is invalidated
User comes back online

Solution: Next fetch will get server state
         Offline changes need separate sync logic
```

### 3. Concurrent Mutations

```
User completes task A
User completes task B (before API returns)

Solution: Both mutations invalidate cache
         Both update local state optimistically
         Final fetch ensures consistency
```

### 4. Failed API Calls

```
User renames workspace
Cache is invalidated
API call fails

Solution: Rollback local state
         Cache remains invalidated
         Next fetch gets correct state
```

## Monitoring & Debugging

### Console Logs

The cache system logs all operations:

```
✅ "Using cached workspaces (age: 45s)"
   → Cache hit, using cached data

✅ "Cache expired, fetching fresh data"
   → Cache too old, fetching from API

✅ "Force refresh requested, bypassing cache"
   → forceRefresh=true, skipping cache

✅ "Workspaces cache invalidated"
   → Cache removed after mutation

✅ "Workspaces cached successfully"
   → Fresh data saved to cache

❌ "Error invalidating workspaces cache: [error]"
   → Cache invalidation failed (rare)
```

### How to Test Cache Behavior

1. **Test Cache Hit:**
   ```
   - Open app
   - Navigate to tasks (first fetch from API)
   - Navigate away
   - Navigate back within 5 minutes
   - Check console: Should see "Using cached workspaces"
   ```

2. **Test Cache Invalidation:**
   ```
   - Complete a task
   - Check console: Should see "Workspaces cache invalidated"
   - Navigate away and back
   - Check console: Should see "Fetching workspaces via API"
   ```

3. **Test Cache Expiration:**
   ```
   - Open app
   - Wait 6 minutes
   - Navigate to tasks
   - Check console: Should see "Cache expired, fetching fresh data"
   ```

## Future Improvements

### 1. Smarter Cache Updates (Instead of Invalidation)

```typescript
// Instead of invalidating, update cache directly
const updateTaskInCache = async (taskId: string, updates: Partial<Task>) => {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Update task in cached data
        const updatedData = updateTaskInData(data, taskId, updates);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
            data: updatedData,
            timestamp
        }));
    }
};
```

**Pros:** Fewer API calls, better offline support
**Cons:** More complex, harder to debug, risk of cache inconsistency

### 2. React Query Integration

```typescript
// Use React Query for automatic cache management
const { data: workspaces } = useQuery({
    queryKey: ['workspaces', userId],
    queryFn: fetchUserWorkspaces,
    staleTime: 5 * 60 * 1000,
});

// Mutations automatically invalidate
const { mutate: updateTask } = useMutation({
    mutationFn: updateTaskAPI,
    onSuccess: () => {
        queryClient.invalidateQueries(['workspaces']);
    }
});
```

**Pros:** Industry standard, automatic refetching, better DX
**Cons:** Requires refactoring, learning curve, bundle size

### 3. Optimistic Updates with Rollback

Already partially implemented, but could be improved:

```typescript
const updateTask = async (taskId: string, updates: Partial<Task>) => {
    // 1. Save original state
    const originalState = workspaces;
    
    // 2. Optimistic update
    const newState = updateTaskInState(workspaces, taskId, updates);
    setWorkSpaces(newState);
    
    try {
        // 3. API call
        await updateTaskAPI(taskId, updates);
    } catch (error) {
        // 4. Rollback on error
        setWorkSpaces(originalState);
        throw error;
    }
};
```

## Related Systems

### Groups Cache

Groups use **React Query** with similar invalidation:

```typescript
const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: getUserGroups,
    staleTime: 60000, // 1 minute
});

// Mutations invalidate automatically
queryClient.invalidateQueries({ queryKey: ['groups'] });
```

### Kudos Cache

Kudos use a similar AsyncStorage cache with invalidation:

```typescript
const invalidateKudosCache = async () => {
    await AsyncStorage.removeItem(KUDOS_CACHE_KEY);
};
```

## Conclusion

The workspace cache system uses a **simple but effective** approach:

1. ✅ Cache for 5 minutes to reduce API calls
2. ✅ Invalidate on ANY mutation to prevent stale data
3. ✅ Optimistic updates for instant UI feedback
4. ✅ Fetch fresh data after invalidation

This ensures **users never see stale data** while maintaining **fast performance** and **simple, maintainable code**.

The key insight: **It's better to make an extra API call than to show stale data.**
