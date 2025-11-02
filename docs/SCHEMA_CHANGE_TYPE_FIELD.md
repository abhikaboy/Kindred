# Schema Change: Type Field for Encouragements and Congratulations

**Date:** November 2, 2025  
**Status:** ✅ Completed

## Summary

Added a new `type` field to both `encouragements` and `congratulations` collections to support different types of content (message or image).

## Changes Made

### 1. Backend Schema Updates

#### Encouragements (`backend/internal/handlers/encouragement/types.go`)
- Added `Type` field to `CreateEncouragementParams` with validation
- Added `Type` field to `EncouragementDocument` 
- Added `Type` field to `EncouragementDocumentInternal`
- Updated `ToAPI()` helper function to include the Type field

#### Congratulations (`backend/internal/handlers/congratulation/types.go`)
- Added `Type` field to `CreateCongratulationParams` with validation
- Added `Type` field to `CongratulationDocument`
- Added `Type` field to `CongratulationDocumentInternal`
- Updated `ToAPI()` helper function to include the Type field

### 2. Validation Rules

The `type` field has the following validation:
- **Allowed values:** `"message"` or `"image"`
- **Validation tag:** `validate:"omitempty,oneof=message image"`
- **Default value:** `"message"` (when not provided)
- **Required:** No (optional field with default)

### 3. Handler Updates

#### Encouragements (`backend/internal/handlers/encouragement/encouragement.go`)
- Updated `CreateEncouragementHuma` to handle the type field
- Defaults to `"message"` if not provided in request

#### Congratulations (`backend/internal/handlers/congratulation/congratulation.go`)
- Updated `CreateCongratulationHuma` to handle the type field
- Defaults to `"message"` if not provided in request

### 4. Service Layer Updates

#### Encouragements (`backend/internal/handlers/encouragement/service.go`)
- Updated `CreateEncouragement` to include Type field when creating documents

#### Congratulations (`backend/internal/handlers/congratulation/service.go`)
- Updated `CreateCongratulation` to include Type field when creating documents

### 5. Database Migration

**Status:** ✅ Applied manually

All existing documents in both collections have been updated with `type: "message"` as the default value.

## API Changes

### Request Schema

When creating an encouragement or congratulation, the `type` field is now optional:

```json
{
  "receiver": "507f1f77bcf86cd799439012",
  "message": "Great job!",
  "categoryName": "Work",
  "taskName": "Complete project",
  "type": "message"  // Optional: "message" or "image"
}
```

### Response Schema

All encouragement and congratulation responses now include the `type` field:

```json
{
  "id": "507f1f77bcf86cd799439011",
  "sender": { ... },
  "receiver": "507f1f77bcf86cd799439012",
  "message": "Great job!",
  "timestamp": "2023-01-01T00:00:00Z",
  "categoryName": "Work",
  "taskName": "Complete project",
  "read": false,
  "type": "message"
}
```

## Next Steps

To complete the integration:

1. **Generate API Types** (when ready):
   ```bash
   make generate-api
   ```
   Or:
   ```bash
   cd backend && go run ./cmd/server --generate-openapi --openapi-output="../frontend/api/api-spec.yaml"
   ```

2. **Update Frontend** (if needed):
   - The TypeScript types will be automatically generated
   - Update any UI components that handle encouragements/congratulations to support the image type
   - Add image upload/display functionality as needed

## Testing

When testing, ensure:
- ✅ Creating encouragements/congratulations without `type` defaults to `"message"`
- ✅ Creating with `type: "message"` works correctly
- ✅ Creating with `type: "image"` works correctly
- ✅ Invalid type values (e.g., `"video"`) are rejected with validation error
- ✅ Existing documents can be retrieved with the type field
- ✅ GET endpoints return the type field for all documents

## Validation Behavior

| Input | Result | Type Value |
|-------|--------|-----------|
| No `type` field | ✅ Success | `"message"` |
| `"type": "message"` | ✅ Success | `"message"` |
| `"type": "image"` | ✅ Success | `"image"` |
| `"type": "video"` | ❌ Error | Validation failed |
| `"type": ""` | ✅ Success | `"message"` (default) |

## Database Schema

### Collection: `encouragements`
```javascript
{
  _id: ObjectId,
  sender: {
    name: String,
    picture: String,
    id: ObjectId
  },
  receiver: ObjectId,
  message: String,
  timestamp: Date,
  categoryName: String,
  taskName: String,
  read: Boolean,
  type: String  // NEW: "message" or "image"
}
```

### Collection: `congratulations`
```javascript
{
  _id: ObjectId,
  sender: {
    name: String,
    picture: String,
    id: ObjectId
  },
  receiver: ObjectId,
  message: String,
  timestamp: Date,
  categoryName: String,
  taskName: String,
  read: Boolean,
  type: String  // NEW: "message" or "image"
}
```

## Files Modified

- `backend/internal/handlers/encouragement/types.go`
- `backend/internal/handlers/encouragement/encouragement.go`
- `backend/internal/handlers/encouragement/service.go`
- `backend/internal/handlers/congratulation/types.go`
- `backend/internal/handlers/congratulation/congratulation.go`
- `backend/internal/handlers/congratulation/service.go`

