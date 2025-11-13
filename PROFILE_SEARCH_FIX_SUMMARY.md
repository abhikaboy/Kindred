# Profile Search Fix - Summary

## Problem
The profile search endpoint (`GET /v1/user/profiles/search`) was returning empty arrays while the autocomplete endpoint (`GET /v1/user/profiles/autocomplete`) worked correctly with the same query parameters.

## Root Cause
The MongoDB Atlas Search index configuration had **duplicate field definitions** with different types:

```go
{Key: "display_name", Value: bson.D{type: "string"}},       // For text search
{Key: "display_name", Value: bson.D{type: "autocomplete"}}, // Overwrites above!
```

In BSON documents, duplicate keys are not allowed - the second definition overwrote the first. This meant:
- ✅ Autocomplete worked (used `autocomplete` operator on `autocomplete` type field)
- ❌ Search failed (tried to use `text` operator on `autocomplete` type field)

## Solution Implemented

### Fixed Index Configuration
Changed to **multi-type field mapping** using `bson.A` (array):

```go
{Key: "display_name", Value: bson.A{
    bson.D{{Key: "type", Value: "string"}, ...},      // For text search
    bson.D{{Key: "type", Value: "autocomplete"}, ...}, // For autocomplete
}},
```

This allows a single field to support multiple search operator types simultaneously.

## Files Modified

### `/backend/internal/storage/xmongo/indexes.go`
- Updated `SearchIndexes` array for the `users` collection
- Changed `display_name` and `handle` from single-type to multi-type definitions
- Both fields now support:
  - **String type** - for full-text search with `text` operator
  - **Autocomplete type** - for prefix matching with `autocomplete` operator

## How to Apply

### Step 1: Update Index in MongoDB Atlas
Run the index application script:

```bash
cd backend
go run cmd/db/apply_indexes/main.go
```

This will update the `display_name_text` index on the `users` collection.

### Step 2: Verify
Test both endpoints:

**Search:**
```bash
curl "http://localhost:8080/v1/user/profiles/search?query=john" \
  -H "Authorization: Bearer TOKEN" \
  -H "refresh_token: REFRESH"
```

**Autocomplete:**
```bash
curl "http://localhost:8080/v1/user/profiles/autocomplete?query=joh" \
  -H "Authorization: Bearer TOKEN" \
  -H "refresh_token: REFRESH"
```

Both should now return results.

## Key Differences Between Endpoints

| Feature | SearchProfiles | AutocompleteProfiles |
|---------|---------------|---------------------|
| **Operator** | `text` | `autocomplete` |
| **Use Case** | Full search after submit | Real-time suggestions |
| **Max Edits** | 2 (more fuzzy) | 1 (stricter) |
| **Results** | Unlimited | Limited to 10 |
| **Matching** | Any part of text | Prefix matching |
| **Speed** | Slower | Faster |

## Technical Details

### Index Structure
```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "display_name": [
        {"type": "string", "analyzer": "lucene.standard"},
        {
          "type": "autocomplete",
          "tokenization": "edgeGram",
          "minGrams": 2,
          "maxGrams": 15
        }
      ],
      "handle": [
        {"type": "string", "analyzer": "lucene.standard"},
        {
          "type": "autocomplete",
          "tokenization": "edgeGram",
          "minGrams": 2,
          "maxGrams": 15
        }
      ]
    }
  }
}
```

### Search Behavior

**Text Search (SearchProfiles):**
- Matches anywhere in the text
- More forgiving with typos (maxEdits: 2)
- Example: "john" matches "John Doe", "johnny", "johnson"

**Autocomplete (AutocompleteProfiles):**
- Matches from the beginning (prefix)
- Stricter with typos (maxEdits: 1)
- Example: "joh" matches "john", "johnny" but not "johnson" as easily

## Additional Resources
- See `/backend/internal/storage/xmongo/INDEX_UPDATE_README.md` for detailed instructions
- MongoDB Atlas Search Documentation: https://www.mongodb.com/docs/atlas/atlas-search/
- Multi-type field mappings: https://www.mongodb.com/docs/atlas/atlas-search/define-field-mappings/

## Status
✅ Index configuration fixed in code
⏳ Needs to be applied to MongoDB Atlas (run apply_indexes script)

