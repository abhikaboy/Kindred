# Atlas Search Index Update - Profile Search Fix

## Problem Fixed
The profile search endpoint was returning empty results while autocomplete worked because the MongoDB Atlas Search index had duplicate field definitions. The second definition (autocomplete) was overwriting the first (string/text search).

## Solution Implemented
Changed the index definition to use **multi-type field mappings** using `bson.A` (array syntax), which allows a single field to support both `"text"` and `"autocomplete"` search operators.

## Changes Made
**File:** `/backend/internal/storage/xmongo/indexes.go`

Changed from duplicate field definitions:
```go
{Key: "display_name", Value: bson.D{...}},  // string type
{Key: "display_name", Value: bson.D{...}},  // autocomplete type (overwrites!)
```

To multi-type array definitions:
```go
{Key: "display_name", Value: bson.A{
    bson.D{{Key: "type", Value: "string"},...},      // For text search
    bson.D{{Key: "type", Value: "autocomplete"},...}, // For autocomplete
}},
```

## How to Apply the Index Update

### Option 1: Using the Index Application Script (Recommended)
```bash
cd backend
go run cmd/db/apply_indexes/main.go
```

This will:
1. Connect to your MongoDB Atlas cluster
2. Drop the old `display_name_text` index on the `users` collection
3. Create the new multi-type index
4. Apply all other indexes as well

### Option 2: Manual Atlas UI Update
1. Go to MongoDB Atlas Console
2. Navigate to your cluster → Search → Search Indexes
3. Find the `display_name_text` index on the `users` collection
4. Click "Edit" and replace the JSON definition with:

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "display_name": [
        {
          "type": "string",
          "analyzer": "lucene.standard"
        },
        {
          "type": "autocomplete",
          "analyzer": "lucene.standard",
          "tokenization": "edgeGram",
          "minGrams": 2,
          "maxGrams": 15,
          "foldDiacritics": true
        }
      ],
      "handle": [
        {
          "type": "string",
          "analyzer": "lucene.standard"
        },
        {
          "type": "autocomplete",
          "analyzer": "lucene.standard",
          "tokenization": "edgeGram",
          "minGrams": 2,
          "maxGrams": 15,
          "foldDiacritics": true
        }
      ]
    }
  }
}
```

5. Save and wait for the index to rebuild (usually takes a few seconds)

## Verification
After applying the index update, test both endpoints:

### Test Search Endpoint:
```bash
curl -X GET "http://localhost:8080/v1/user/profiles/search?query=john" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "refresh_token: YOUR_REFRESH_TOKEN"
```

Should return matching profiles (not empty array).

### Test Autocomplete Endpoint:
```bash
curl -X GET "http://localhost:8080/v1/user/profiles/autocomplete?query=joh" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "refresh_token: YOUR_REFRESH_TOKEN"
```

Should return autocomplete suggestions (up to 10 results).

## Technical Details

### How Multi-Type Fields Work
MongoDB Atlas Search allows a single field to be indexed with multiple types. This enables:
- **`text` operator** - Full-text search with fuzzy matching (2 max edits)
- **`autocomplete` operator** - Edge-gram tokenization for prefix matching

Both operators can now be used on the same `display_name` and `handle` fields without conflict.

### Search Methods
- **SearchProfiles()** - Uses `text` operator for comprehensive search
- **AutocompleteProfiles()** - Uses `autocomplete` operator for fast prefix matching

Both methods query the same index but use different search operators optimized for their use cases.

## Rollback
If you need to rollback to the previous configuration:
```bash
cd backend
git checkout HEAD -- internal/storage/xmongo/indexes.go
go run cmd/db/apply_indexes/main.go
```

Note: The previous configuration only supported autocomplete, so search would still fail after rollback.

