# Cache Stale Data Audit - Critical Issues Found

## Executive Summary

⚠️ **CRITICAL**: I found **4 scenarios** where `setWorkSpaces()` is called WITHOUT cache invalidation, creating potential for stale data.

## Issues Found

### 🚨 Issue #1: `restoreWorkspace()` - No Cache Invalidation

**Location:** `frontend/contexts/tasksContext.tsx` lines 393-402

**Code:**
```typescript
const restoreWorkspace = (workspace: Workspace) => {
    let workspacesCopy = workspaces.slice();
    workspacesCopy.push(workspace);
    setWorkSpaces(workspacesCopy);  // ❌ NO CACHE INVALIDATION
    
    if (selected === "") {
        setSelected(workspace.name);
    }
};
```

**When This Happens:**
- User tries to delete a workspace
- API call fails
- `restoreWorkspace()` is called to rollback the deletion
- Local state is restored BUT cache is NOT invalidated

**Stale Data Scenario:**
```
1. User deletes workspace "Work"
   → removeWorkspace() called → Cache invalidated ✅
   → Local state updated (workspace removed)

2. API call fails
   → restoreWorkspace() called
   → Local state updated (workspace restored)
   → Cache NOT invalidated ❌

3. User navigates away and back
   → fetchWorkspaces() called
   → No cache found (was invalidated in step 1)
   → Fetches from API
   → API returns workspace (delete failed)
   → ✅ Actually OK - API is source of truth

VERDICT: Low risk - API is source of truth, but inconsistent pattern
```

**Risk Level:** 🟡 LOW - API fetch will correct the state

---

### 🚨 Issue #2: `renameWorkspace()` Rollback - No Cache Invalidation

**Location:** `frontend/contexts/tasksContext.tsx` lines 527-538

**Code:**
```typescript
// Rollback the optimistic update on error
if (workspaceToRename) {
    let workspacesCopy = workspaces.slice();
    const workspaceIndex = workspacesCopy.findIndex(w => w.name === newName);
    if (workspaceIndex !== -1) {
        workspacesCopy[workspaceIndex].name = oldName;
        setWorkSpaces(workspacesCopy);  // ❌ NO CACHE INVALIDATION
        
        if (selected === newName) {
            setSelected(oldName);
        }
    }
}
```

**When This Happens:**
- User renames workspace "Work" → "Work Projects"
- Optimistic update applied → Cache invalidated ✅
- API call fails
- Rollback applied → Cache NOT invalidated ❌

**Stale Data Scenario:**
```
1. User renames "Work" → "Work Projects"
   → Optimistic update → Cache invalidated ✅
   → Local state shows "Work Projects"

2. API call fails
   → Rollback to "Work"
   → Local state shows "Work" again
   → Cache NOT invalidated ❌
   → Cache is still empty (from step 1)

3. User navigates away and back
   → fetchWorkspaces() called
   → No cache found
   → Fetches from API
   → API returns "Work" (rename failed)
   → ✅ Actually OK - API is source of truth

VERDICT: Low risk - API is source of truth
```

**Risk Level:** 🟡 LOW - API fetch will correct the state

---

### 🚨 Issue #3: `renameCategory()` Rollback - No Cache Invalidation

**Location:** `frontend/contexts/tasksContext.tsx` lines 589-593

**Code:**
```typescript
// Rollback the optimistic update on error
if (originalCategory && workspaceIndex !== -1 && categoryIndex !== -1) {
    let workspacesCopy = workspaces.slice();
    workspacesCopy[workspaceIndex].categories[categoryIndex].name = originalCategory.name;
    setWorkSpaces(workspacesCopy);  // ❌ NO CACHE INVALIDATION
}
```

**When This Happens:**
- User renames category
- Optimistic update applied → Cache invalidated ✅
- API call fails
- Rollback applied → Cache NOT invalidated ❌

**Stale Data Scenario:**
Same as Issue #2 - API is source of truth on next fetch.

**Risk Level:** 🟡 LOW - API fetch will correct the state

---

### 🚨 Issue #4: Reorder/Sort Categories - No Cache Invalidation

**Location:** `frontend/components/modals/edit/EditWorkspace.tsx`

**Code 1 - ReorderContent (line 403):**
```typescript
const handleSave = () => {
    const workspacesCopy = [...workspaces];
    const workspaceIndex = workspacesCopy.findIndex((ws) => ws.name === selected);

    if (workspaceIndex !== -1) {
        workspacesCopy[workspaceIndex] = {
            ...workspacesCopy[workspaceIndex],
            categories: reorderedCategories,
        };
        setWorkSpaces(workspacesCopy);  // ❌ NO CACHE INVALIDATION
    }

    onSave();
    setHasChanges(false);
};
```

**Code 2 - SortContent (line 552):**
```typescript
workspacesCopy[workspaceIndex].categories = sortedCategories;
setWorkSpaces(workspacesCopy);  // ❌ NO CACHE INVALIDATION
```

**When This Happens:**
- User reorders categories in a workspace
- User sorts categories in a workspace
- Local state is updated
- Cache is NOT invalidated ❌

**Stale Data Scenario:**
```
1. User reorders categories: [A, B, C] → [C, A, B]
   → Local state updated
   → Cache NOT invalidated ❌
   → UI shows new order [C, A, B]

2. User navigates away and back
   → fetchWorkspaces() called
   → Cache is still valid (< 5 min old)
   → Loads stale cache with order [A, B, C]
   → UI reverts to old order ❌❌❌
   
RESULT: User's reordering is LOST!
```

**Risk Level:** 🔴 **HIGH** - User changes are lost!

---

## Summary Table

| Issue | Location | Risk | Impact |
|-------|----------|------|--------|
| #1: restoreWorkspace | tasksContext.tsx:393 | 🟡 LOW | API corrects on next fetch |
| #2: renameWorkspace rollback | tasksContext.tsx:532 | 🟡 LOW | API corrects on next fetch |
| #3: renameCategory rollback | tasksContext.tsx:592 | 🟡 LOW | API corrects on next fetch |
| #4: Reorder/Sort categories | EditWorkspace.tsx:403,552 | 🔴 **HIGH** | User changes LOST |

## Root Cause Analysis

### Why Issues #1-3 Are Low Risk

These are **rollback scenarios** where:
1. Cache was already invalidated during the optimistic update
2. Rollback happens when API fails
3. Next fetch will get correct state from API
4. The rollback itself doesn't persist to the server

**However**, they create an inconsistent pattern and could cause confusion.

### Why Issue #4 Is High Risk

**Reorder/Sort operations:**
1. Update local state only (no API call shown in code)
2. Don't invalidate cache
3. Changes are purely client-side
4. Next fetch loads stale cache → **User changes are lost**

**This is the ONLY true stale data bug.**

## Additional Concerns

### 🤔 Question: Do Reorder/Sort Persist to Server?

Looking at the code, I don't see API calls for:
- Reordering categories
- Sorting categories

**If these are client-side only:**
- They should be stored in AsyncStorage separately
- They should NOT modify the workspaces state
- Current implementation will lose changes

**If these should persist to server:**
- Need to add API calls
- Need to invalidate cache after API success

### 🤔 Question: Filter State

Filters are stored in AsyncStorage separately (`workspace-filters-${workspaceName}`), which is correct. They don't modify the workspaces cache.

## Recommendations

### 🔥 Critical Fix (Issue #4)

**Option A: Add Cache Invalidation (if persisting to server)**

```typescript
// In ReorderContent.handleSave()
const handleSave = async () => {
    const workspacesCopy = [...workspaces];
    const workspaceIndex = workspacesCopy.findIndex((ws) => ws.name === selected);

    if (workspaceIndex !== -1) {
        workspacesCopy[workspaceIndex] = {
            ...workspacesCopy[workspaceIndex],
            categories: reorderedCategories,
        };
        setWorkSpaces(workspacesCopy);
        
        // ✅ ADD THIS
        await invalidateWorkspacesCache();
        
        // TODO: Add API call to persist reorder
        // await reorderCategoriesAPI(selected, reorderedCategories);
    }

    onSave();
    setHasChanges(false);
};
```

**Option B: Store Separately (if client-side only)**

```typescript
// Don't modify workspaces state at all
// Store in AsyncStorage like filters
const handleSave = async () => {
    try {
        await AsyncStorage.setItem(
            `workspace-category-order-${selected}`,
            JSON.stringify(reorderedCategories.map(c => c.id))
        );
    } catch (error) {
        console.error("Error saving category order:", error);
    }
    onSave();
};

// Then apply the order when rendering, not when fetching
```

### ⚠️ Recommended Fix (Issues #1-3)

Add cache invalidation to rollback functions for consistency:

```typescript
const restoreWorkspace = async (workspace: Workspace) => {
    let workspacesCopy = workspaces.slice();
    workspacesCopy.push(workspace);
    setWorkSpaces(workspacesCopy);
    
    // ✅ ADD THIS for consistency
    await invalidateWorkspacesCache();
    
    if (selected === "") {
        setSelected(workspace.name);
    }
};
```

**Rationale:** Even though API will correct the state, invalidating cache ensures consistency and prevents confusion during debugging.

### 📋 Pattern to Follow

**Golden Rule:** ANY call to `setWorkSpaces()` should be followed by `invalidateWorkspacesCache()`

**Exceptions:** NONE - even rollbacks should invalidate for consistency

## Testing Recommendations

### Test Issue #4 (Reorder/Sort)

1. Open a workspace with multiple categories
2. Reorder the categories (drag and drop)
3. Click "Save Order"
4. Navigate to a different screen
5. Navigate back to the workspace
6. **Expected:** Categories should maintain new order
7. **Actual (BUG):** Categories revert to original order ❌

### Test Issues #1-3 (Rollback)

These are harder to test as they require API failures:

1. Simulate API failure (disconnect network)
2. Try to delete/rename workspace
3. Observe rollback
4. Reconnect network
5. Navigate away and back
6. Verify state matches server

## Conclusion

### Current State

✅ **Most mutations properly invalidate cache** (12+ operations)
❌ **4 operations don't invalidate cache**
🔴 **1 operation (reorder/sort) causes actual data loss**

### Confidence Level

**Can stale data be presented?**

- **Issues #1-3:** Unlikely - API corrects on next fetch
- **Issue #4:** **YES** - User changes are lost after navigation

**Overall:** 🟡 **MEDIUM CONFIDENCE** - One critical bug exists

### Next Steps

1. **URGENT:** Fix Issue #4 (reorder/sort cache invalidation)
2. **RECOMMENDED:** Add cache invalidation to rollback functions
3. **AUDIT:** Check if reorder/sort should persist to server
4. **TEST:** Verify all mutation paths after fixes
5. **DOCUMENT:** Update cache invalidation guidelines

## Proposed Fix

I can implement the fixes for all 4 issues. Would you like me to:

1. Fix Issue #4 (reorder/sort) immediately?
2. Add cache invalidation to all rollback functions?
3. Investigate if reorder/sort should persist to server?
