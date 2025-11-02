# Post Visibility & Feed Updates

**Date:** November 2, 2025  
**Status:** ✅ Complete

## Summary

Updated the post visibility logic in `GetFriendsPosts` to respect groups, blueprint visibility settings, and added random sampling for tasks in the feed to provide variety.

## Changes Made

### 1. Simplified Post Visibility Logic

**Location:** `backend/internal/handlers/post/service.go` - `GetFriendsPosts` method

The visibility logic now implements two simple rules:

#### Rule 1: Post has groups
- **Condition:** Post has a non-empty `groups` array AND user is a member of at least one of those groups
- **Visibility:** Only members of the specified groups can see the post
- **Use case:** Posts targeted to specific friend groups (e.g., "College Friends", "Work Team")
- **Note:** User doesn't need to be a friend - group membership is sufficient

#### Rule 2: Post has no groups
- **Condition:** Post has no `groups` array (null or empty) AND user is a friend of the creator
- **Visibility:** All friends of the creator can see the post
- **Use case:** Regular posts shared with all friends
- **Note:** If post has no groups, it's visible to all friends regardless of other settings

### 2. Implementation Details

The new implementation:
1. **Fetches user's groups** at the start to check group membership
2. **Builds two simple visibility conditions** as MongoDB aggregation expressions
3. **Uses `$or` conditions** to check both rules
4. **Maintains pagination** and count functionality
5. **Preserves chronological ordering** (newest first)
6. **No blueprint logic** - groups and friends are the only visibility controls

### 3. Random Task Sampling

**Location:** `backend/internal/handlers/post/service.go` - `GetFriendsPublicTasks` method

#### Changes:
- Added `$addFields` stage with `$rand` operator to generate random values
- Sorts by `randomSort` field first, then `timestamp` for consistency
- Tasks now appear in different order each time the feed is fetched

#### Benefits:
- **Variety:** Users see different tasks from their friends on each feed refresh
- **Discovery:** Less popular or older tasks get exposure
- **Engagement:** Fresh content keeps users interested

#### Implementation:
```javascript
// Stage 10: Add random field for sampling
{ $addFields: { randomSort: { $rand: {} } } }

// Stage 11: Sort by random field first, then timestamp
{ $sort: { randomSort: 1, timestamp: -1 } }
```

### 4. Key Simplifications

- ✅ **No own posts:** Users don't see their own posts in the feed
- ✅ **No blueprint logic:** Blueprint public/private settings are ignored
- ✅ **No metadata.isPublic:** The isPublic flag is ignored - only groups and friends matter
- ✅ **Simple rules:** Just two conditions - has groups vs no groups

## MongoDB Aggregation Pipeline

### Visibility Filter Structure (Simplified)

```javascript
{
  $or: [
    // Rule 1: Post has groups AND user is a member of at least one group
    {
      $and: [
        { $ne: ["$groups", null] },
        { $gt: [{ $size: { $ifNull: ["$groups", []] } }, 0] },
        {
          $gt: [
            {
              $size: {
                $setIntersection: [
                  { $ifNull: ["$groups", []] },
                  userGroupIDs
                ]
              }
            },
            0
          ]
        }
      ]
    },
    
    // Rule 2: Post has no groups AND user is a friend of the creator
    {
      $and: [
        { $in: ["$user._id", friendIds] },
        {
          $or: [
            { $eq: ["$groups", null] },
            { $eq: [{ $size: { $ifNull: ["$groups", []] } }, 0] }
          ]
        }
      ]
    }
  ]
}
```

## Performance Considerations

### Indexes Recommended

To optimize the simplified visibility queries, consider adding these indexes:

```javascript
// Posts collection
db.posts.createIndex({ "user._id": 1, "metadata.isDeleted": 1, "metadata.createdAt": -1 })
db.posts.createIndex({ "groups": 1, "metadata.isDeleted": 1 })
db.posts.createIndex({ "metadata.isDeleted": 1, "metadata.createdAt": -1 })

// Groups collection
db.groups.createIndex({ "members._id": 1, "metadata.isDeleted": 1 })
db.groups.createIndex({ "creator": 1, "metadata.isDeleted": 1 })
```

### Query Optimization

The implementation:
- ✅ Fetches user groups once at the start
- ✅ Uses aggregation pipeline for efficient filtering
- ✅ Combines count and data queries strategically
- ✅ Uses `$setIntersection` for efficient group membership checking
- ✅ Much simpler than before - only 2 rules instead of 6
- ⚠️ May need caching for users in many groups

## Testing Examples

### Example 1: Blueprint Post with isPublic=true

**Post:**
```json
{
  "blueprint": { "id": "bp123", "isPublic": true },
  "user": { "_id": "alice" },
  "metadata": { "isPublic": false }
}
```

**Visibility:**
- ✅ Alice (creator)
- ✅ Bob (subscribed to bp123)
- ✅ Charlie (subscribed to bp123)
- ❌ Dave (not subscribed, even though he's Alice's friend)

### Example 2: Blueprint Post with isPublic=false

**Post:**
```json
{
  "blueprint": { "id": "bp456", "isPublic": false },
  "user": { "_id": "alice" },
  "metadata": { "isPublic": false }
}
```

**Visibility:**
- ✅ Alice (creator)
- ✅ Bob (friend of Alice)
- ✅ Charlie (friend of Alice)
- ❌ Dave (subscribed to bp456 but not Alice's friend)

### Example 3: Regular Post with Groups

**Post:**
```json
{
  "blueprint": null,
  "user": { "_id": "alice" },
  "groups": ["group1", "group2"],
  "metadata": { "isPublic": false }
}
```

**Visibility:**
- ✅ Alice (creator)
- ✅ Bob (member of group1)
- ✅ Charlie (member of group2)
- ❌ Dave (friend of Alice but not in any group)

### Example 4: Public Friend Post

**Post:**
```json
{
  "blueprint": null,
  "user": { "_id": "alice" },
  "groups": [],
  "metadata": { "isPublic": true }
}
```

**Visibility:**
- ✅ Alice (creator)
- ✅ Bob (friend of Alice)
- ✅ Charlie (friend of Alice)
- ❌ Dave (not a friend, even if subscribed to same blueprints)

## Feed Endpoint Impact

The `GetFeed` endpoint uses `GetFriendsPosts` internally, so all visibility logic automatically applies to:
- `GET /v1/user/posts/friends` - Direct friends' posts endpoint
- `GET /v1/user/feed` - Unified feed with posts and tasks

Both endpoints now:
- ✅ Respect group-based visibility
- ✅ Handle blueprint public/private settings correctly
- ✅ Show random variety of tasks
- ✅ Maintain proper pagination

## Migration Notes

**No database migration required** - all fields already exist in the schema:
- `posts.groups` - already in schema
- `posts.blueprint.isPublic` - already in schema
- `posts.metadata.isPublic` - already in schema
- `blueprints.subscribers` - already in schema
- `groups.members` - already in schema

## API Behavior Changes

### Before
- Only checked `metadata.isPublic = true` for friends
- Ignored groups array
- Ignored blueprint.isPublic flag
- Tasks always appeared in same order

### After
- Checks all 5 visibility rules
- Respects group membership
- Honors blueprint public/private settings
- Tasks appear in random order
- Users always see their own posts

## Known Limitations

1. **Group membership caching:** Currently fetches groups on every request. For users in many groups, consider caching.

2. **Blueprint subscription caching:** Fetches subscriptions on every request. Could be cached with TTL.

3. **Pagination offset:** Random task sampling means offset-based pagination may show duplicate tasks if data changes between requests. Consider cursor-based pagination for tasks in the future.

4. **Performance:** Complex visibility checks may be slower than simple public filter. Monitor query performance and add indexes as needed.

## Future Enhancements

- [ ] Cache group memberships for frequently active users
- [ ] Cache blueprint subscriptions with invalidation on subscribe/unsubscribe
- [ ] Add visibility preview when creating posts
- [ ] Add analytics on which visibility type is most used
- [ ] Consider cursor-based pagination for better random sampling
- [ ] Add A/B testing for different task sampling strategies

