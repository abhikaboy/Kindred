# FlashList Migration Analysis

## Summary
Analysis of all FlatList usages in the codebase to identify candidates for FlashList migration.

## High Priority - Should Migrate ✅

### 1. **ProfileGallery.tsx** ⭐⭐⭐
- **Current**: FlatList with 3-column grid
- **Items**: User posts with images (can be 50-100+ items)
- **Why migrate**:
  - Large datasets (users can have many posts)
  - Image-heavy (CachedImage components)
  - Already has some optimizations but could benefit more
  - Grid layout works well with FlashList
- **Impact**: HIGH - Significant performance improvement for users with many posts
- **Complexity**: LOW - Simple grid layout

### 2. **BlueprintGallery.tsx** ⭐⭐⭐
- **Current**: FlatList with 3-column grid
- **Items**: Blueprint posts with images
- **Why migrate**:
  - Similar to ProfileGallery
  - Image-heavy rendering
  - Can have many posts per blueprint
- **Impact**: HIGH - Same benefits as ProfileGallery
- **Complexity**: LOW - Simple grid layout

### 3. **Feed.tsx (Main Feed)** ⭐⭐⭐
- **Current**: FlatList with posts and tasks
- **Items**: PostCard and TaskFeedCard components (paginated, 20+ items)
- **Why migrate**:
  - Most critical screen for performance
  - Heavy components (PostCard with images, reactions, comments)
  - Infinite scroll with pagination
  - Already has some optimizations but still heavy
- **Impact**: VERY HIGH - Main user-facing feed
- **Complexity**: MEDIUM - Has pagination, pull-to-refresh, complex items

### 4. **Friends.tsx** ⭐⭐
- **Current**: FlatList with user rows
- **Items**: Friend list (can be 50-100+ friends)
- **Why migrate**:
  - Can have many items
  - Simple row layout perfect for FlashList
- **Impact**: MEDIUM - Good improvement for users with many friends
- **Complexity**: LOW - Simple list

## Medium Priority - Consider Migrating

### 5. **BlueprintSection.tsx** ⭐
- **Current**: Horizontal FlatList
- **Items**: Blueprint cards (usually 3-10 items)
- **Why migrate**:
  - Horizontal scroll
  - Moderate number of items
- **Impact**: LOW-MEDIUM - Usually small datasets
- **Complexity**: LOW - Horizontal list
- **Note**: FlashList works with horizontal lists but benefit is smaller

### 6. **SuggestedUsers.tsx** ⭐
- **Current**: Horizontal FlatList
- **Items**: User cards (usually 5-15 items)
- **Why migrate**:
  - Small datasets typically
  - Already memoized
- **Impact**: LOW - Usually small datasets
- **Complexity**: LOW
- **Note**: Probably not worth it due to small item count

## Low Priority - Don't Migrate ❌

### 7. **Feed Tabs (in feed.tsx)** ❌
- **Current**: Horizontal FlatList for feed tabs
- **Items**: 3-6 tab buttons
- **Why NOT migrate**: Very small dataset, no performance benefit

### 8. **Other Small Lists** ❌
- Various FlatLists with <10 items
- No performance benefit from FlashList
- Keep as FlatList for simplicity

## Recommended Migration Order

1. **Feed.tsx** - Highest impact, most critical screen
2. **ProfileGallery.tsx** - High impact, easier to implement
3. **BlueprintGallery.tsx** - Similar to ProfileGallery
4. **Friends.tsx** - Good improvement, simple implementation
5. **BlueprintSection.tsx** - Lower priority, smaller benefit

## Implementation Notes

### Grid Layouts (ProfileGallery, BlueprintGallery)
FlashList supports `numColumns` just like FlatList:
```typescript
<FlashList
    numColumns={3}
    data={items}
    renderItem={renderItem}
    // ... other props
/>
```

### Horizontal Lists (BlueprintSection, SuggestedUsers)
FlashList supports horizontal orientation:
```typescript
<FlashList
    horizontal
    data={items}
    renderItem={renderItem}
    // ... other props
/>
```

### Complex Lists with Pagination (Feed.tsx)
FlashList handles pagination well:
```typescript
<FlashList
    data={items}
    renderItem={renderItem}
    onEndReached={loadMore}
    onEndReachedThreshold={0.5}
    // ... other props
/>
```

### Key Considerations

1. **Wrap in Container**: FlashList needs a container with defined height/width
2. **Remove estimatedItemSize**: FlashList auto-measures (we learned this from task cards)
3. **Keep Existing Optimizations**:
   - `removeClippedSubviews`
   - Memoized render functions
   - Key extractors
4. **Test Thoroughly**: Especially grid layouts and horizontal scrolls

## Expected Performance Gains

### Feed.tsx
- **Before**: All posts rendered, heavy re-renders
- **After**: Only visible posts + buffer, 60-80% improvement
- **User Impact**: Smooth scrolling, faster load times

### ProfileGallery.tsx & BlueprintGallery.tsx
- **Before**: All images rendered at once
- **After**: Only visible grid items + buffer
- **User Impact**: Faster gallery loading, smooth scrolling

### Friends.tsx
- **Before**: All friends rendered
- **After**: Only visible friends + buffer
- **User Impact**: Faster load for users with many friends

## Files to Modify

1. `/frontend/app/(logged-in)/(tabs)/(feed)/feed.tsx`
2. `/frontend/components/profile/ProfileGallery.tsx`
3. `/frontend/components/profile/BlueprintGallery.tsx`
4. `/frontend/app/(logged-in)/(tabs)/(profile)/friends.tsx`
5. (Optional) `/frontend/components/profile/BlueprintSection.tsx`
6. (Optional) `/frontend/components/search/SuggestedUsers.tsx`
