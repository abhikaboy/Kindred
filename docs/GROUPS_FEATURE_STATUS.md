# Groups Feature Implementation Status

**Date:** November 2, 2025  
**Status:** ✅ Mostly Complete - Minor visibility logic updates needed

## Summary

The groups feature for controlling post visibility has been **largely implemented**. The backend infrastructure including groups collection, handlers, and post schema updates are all in place. Minor updates may be needed to the post visibility filtering logic.

## Current Implementation Status

###  ✅ Groups Collection - **COMPLETE**

The groups collection is fully implemented with the exact schema you specified:

```go
type GroupDocument struct {
    ID       primitive.ObjectID              `bson:"_id" json:"_id"`
    Name     string                          `bson:"name" json:"name"`
    Creator  primitive.ObjectID              `bson:"creator" json:"creator"`
    Members  []UserExtendedReferenceInternal `bson:"members" json:"members"`
    Metadata GroupMetadata                   `bson:"metadata" json:"metadata"`
}
```

**Location:** `backend/internal/handlers/types/types.go` (lines 448-454)

### ✅ Groups Handler - **COMPLETE**

Full CRUD operations for groups are implemented:

**Location:** `backend/internal/handlers/group/`

**Available Operations:**
- ✅ Create Group - `POST /v1/groups`
- ✅ Get All Groups (for user) - `GET /v1/groups`
- ✅ Get Group by ID - `GET /v1/groups/{id}`
- ✅ Update Group - `PATCH /v1/groups/{id}`
- ✅ Delete Group (soft delete) - `DELETE /v1/groups/{id}`
- ✅ Add Member - `POST /v1/groups/{id}/members`
- ✅ Remove Member - `DELETE /v1/groups/{id}/members`

**Authorization:**
- Only creators can update/delete groups
- Only creators can add members
- Creators or members themselves can remove members
- Only members or creators can view group details

### ✅ Post Schema Updates - **COMPLETE**

Posts already support groups and enhanced blueprint references:

```go
type PostDocument struct {
    // ... other fields
    Blueprint *EnhancedBlueprintReference `bson:"blueprint,omitempty" json:"blueprint,omitempty"`
    Groups    []primitive.ObjectID        `bson:"groups,omitempty" json:"groups,omitempty"`
    Metadata  PostMetadata                `bson:"metadata" json:"metadata"`
}

type EnhancedBlueprintReference struct {
    ID       primitive.ObjectID `bson:"id" json:"id"`
    IsPublic bool               `bson:"isPublic" json:"isPublic"`
}

type PostMetadata struct {
    CreatedAt time.Time `bson:"createdAt" json:"createdAt"`
    UpdatedAt time.Time `bson:"updatedAt" json:"updatedAt"`
    IsPublic  bool      `bson:"isPublic" json:"isPublic"`  // Controls friend visibility
    IsDeleted bool      `bson:"isDeleted" json:"isDeleted"`
    IsEdited  bool      `bson:"isEdited" json:"isEdited"`
}
```

**Location:** `backend/internal/handlers/types/types.go`

### ✅ Create Post with Groups - **COMPLETE**

Post creation already supports:
- ✅ Groups array (validated as 24-char hex strings)
- ✅ Blueprint ID with isPublic flag
- ✅ Post-level isPublic flag in metadata

**Location:** `backend/internal/handlers/post/post.go` (lines 77-90)

```go
// Handle groups
if len(input.Body.Groups) > 0 {
    var groupIDs []primitive.ObjectID
    for _, groupIDStr := range input.Body.Groups {
        groupID, err := primitive.ObjectIDFromHex(groupIDStr)
        if err != nil {
            return nil, huma.Error400BadRequest("Invalid group ID format", err)
        }
        groupIDs = append(groupIDs, groupID)
    }
    doc.Groups = groupIDs
}

doc.Metadata.IsPublic = input.Body.IsPublic
```

### ⚠️ Post Visibility Logic - **NEEDS REVIEW**

The current `GetFriendsPosts` implementation filters by:
- Friends of the user
- `metadata.isPublic = true`
- `metadata.isDeleted = false`

**Location:** `backend/internal/handlers/post/service.go` (lines 214-350)

```go
{{Key: "$match", Value: bson.M{
    "$expr": bson.M{
        "$and": []bson.M{
            {"$in": []interface{}{
                bson.M{"$toObjectId": "$user._id"},
                "$$friendIds",
            }},
            {"$eq": []interface{}{"$metadata.isDeleted", false}},
            {"$eq": []interface{}{"$metadata.isPublic", true}},  // Current filter
        },
    },
}}}
```

## Visibility Rules to Implement

Based on your specification, here's how post visibility should work:

### Rule 1: Blueprint with isPublic = true
```javascript
blueprint: {
    _id: ObjectID(),
    isPublic: true  // All subscribers can see
}
metadata: {
    isPublic: false  // Doesn't matter, blueprint overrides
}
```
**Visibility:** All blueprint subscribers

### Rule 2: Blueprint with isPublic = false
```javascript
blueprint: {
    _id: ObjectID(),
    isPublic: false  // Only friends can see
}
metadata: {
    isPublic: false  // Doesn't matter
}
```
**Visibility:** Only friends

### Rule 3: Post isPublic = true (no groups)
```javascript
blueprint: null
metadata: {
    isPublic: true  // Friends can see
}
groups: []
```
**Visibility:** All friends

### Rule 4: Post isPublic = false with groups
```javascript
blueprint: null
metadata: {
    isPublic: false  // Only group members
}
groups: [ObjectID(), ObjectID()]
```
**Visibility:** Only members of the specified groups

### Rule 5: Post isPublic = false, no groups
```javascript
blueprint: null
metadata: {
    isPublic: false
}
groups: []
```
**Visibility:** Only the creator (private post)

## Recommended Changes

### 1. Update GetFriendsPosts Visibility Logic

The `GetFriendsPosts` method needs to implement the visibility rules:

```go
// Pseudo-code for the visibility logic
visibilityConditions := bson.M{
    "$or": []bson.M{
        // Rule 1: Blueprint with isPublic = true (all subscribers can see)
        {
            "blueprint.isPublic": true,
            // Additional check: user is subscribed to blueprint
        },
        
        // Rule 2 & 3: Blueprint with isPublic = false OR no blueprint but post isPublic = true (friends can see)
        {
            "$or": []bson.M{
                {"blueprint.isPublic": false},
                {"blueprint": nil, "metadata.isPublic": true},
            },
            // User must be a friend
        },
        
        // Rule 4: No blueprint, isPublic = false, but user is in one of the groups
        {
            "blueprint": nil,
            "metadata.isPublic": false,
            "groups": bson.M{"$exists": true, "$ne": []interface{}{}},
            // Check if user is member of any group in the groups array
        },
        
        // Rule 5: User is the creator (can always see own posts)
        {
            "user._id": userID,
        },
    },
}
```

### 2. Add Helper Method to Check Group Membership

Create a helper in the Post service to check if a user is a member of any group:

```go
func (s *Service) IsUserInAnyGroup(userID primitive.ObjectID, groupIDs []primitive.ObjectID) (bool, error) {
    ctx := context.Background()
    
    filter := bson.M{
        "_id": bson.M{"$in": groupIDs},
        "$or": []bson.M{
            {"creator": userID},
            {"members._id": userID},
        },
        "metadata.isDeleted": false,
    }
    
    count, err := s.Groups.CountDocuments(ctx, filter)
    if err != nil {
        return false, err
    }
    
    return count > 0, nil
}
```

### 3. Add Helper Method to Check Blueprint Subscription

```go
func (s *Service) IsUserSubscribedToBlueprint(userID, blueprintID primitive.ObjectID) (bool, error) {
    ctx := context.Background()
    
    filter := bson.M{
        "_id": blueprintID,
        "subscribers": userID,
    }
    
    count, err := s.Blueprints.CountDocuments(ctx, filter)
    if err != nil {
        return false, err
    }
    
    return count > 0, nil
}
```

## API Endpoints Summary

### Groups API
- `POST /v1/groups` - Create a new group
- `GET /v1/groups` - Get all groups for authenticated user
- `GET /v1/groups/{id}` - Get specific group details
- `PATCH /v1/groups/{id}` - Update group (name)
- `DELETE /v1/groups/{id}` - Delete group (soft delete)
- `POST /v1/groups/{id}/members` - Add member to group
- `DELETE /v1/groups/{id}/members` - Remove member from group

### Posts API (Groups-related)
- `GET /v1/user/posts/groups` - Get all groups for user (for post creation UI)
- `POST /v1/user/posts` - Create post with groups array
- `GET /v1/user/posts/friends` - Get friends' posts (respects group visibility)
- `GET /v1/user/feed` - Unified feed (respects group visibility)

## Database Collections

### Groups Collection
```javascript
db.groups.find()
{
    _id: ObjectID("..."),
    name: "Close Friends",
    creator: ObjectID("..."),
    members: [
        {
            _id: ObjectID("..."),
            display_name: "John Doe",
            handle: "johndoe",
            profile_picture: "https://..."
        },
        // ... more members
    ],
    metadata: {
        createdAt: ISODate("2025-11-02T..."),
        updatedAt: ISODate("2025-11-02T..."),
        isDeleted: false
    }
}
```

### Posts Collection (with groups)
```javascript
db.posts.find()
{
    _id: ObjectID("..."),
    user: { /* UserExtendedReferenceInternal */ },
    images: ["https://..."],
    caption: "My post",
    blueprint: {
        id: ObjectID("..."),
        isPublic: false
    },
    groups: [ObjectID("..."), ObjectID("...")],
    metadata: {
        createdAt: ISODate("..."),
        updatedAt: ISODate("..."),
        isPublic: false,
        isDeleted: false,
        isEdited: false
    },
    reactions: {},
    comments: []
}
```

## Testing Checklist

When implementing the visibility logic, test:

- [ ] Blueprint post with isPublic=true shows to all subscribers
- [ ] Blueprint post with isPublic=false shows only to friends
- [ ] Regular post with isPublic=true shows to all friends
- [ ] Post with groups shows only to group members
- [ ] Post with isPublic=false and no groups shows only to creator
- [ ] User can always see their own posts regardless of visibility
- [ ] Deleted posts are never shown
- [ ] Group membership check works correctly
- [ ] Blueprint subscription check works correctly
- [ ] Pagination works correctly with filtered posts

## Files to Modify

If implementing the visibility logic updates:

1. **`backend/internal/handlers/post/service.go`**
   - Update `GetFriendsPosts` method (around line 214)
   - Add `IsUserInAnyGroup` helper method
   - Add `IsUserSubscribedToBlueprint` helper method

2. **`backend/internal/handlers/post/service.go`** (continued)
   - Update aggregation pipeline to include group visibility checks
   - Update blueprint visibility checks

## Notes

- The groups infrastructure is solid and production-ready
- Post schema already supports all required fields
- Main work needed is refining the visibility filtering logic in `GetFriendsPosts`
- Consider adding indexes on `groups` array field for performance
- Consider caching group memberships for frequently accessed groups

## Migration

No database migration needed - the schema is already in place. If you want to add indexes for better performance:

```javascript
// Add index on groups array for faster lookups
db.posts.createIndex({ "groups": 1 })

// Add compound index for common queries
db.posts.createIndex({ "metadata.isPublic": 1, "groups": 1, "metadata.isDeleted": 1 })

// Groups collection indexes
db.groups.createIndex({ "creator": 1 })
db.groups.createIndex({ "members._id": 1 })
db.groups.createIndex({ "metadata.isDeleted": 1 })
```

