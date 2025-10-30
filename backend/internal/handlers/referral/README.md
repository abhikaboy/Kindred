# Referral System Implementation

## Overview

The referral system allows users to refer friends and earn unlocks for premium features. This implementation uses a separate `referrals` collection in MongoDB for better scalability and separation of concerns.

## Features

Users can unlock the following features through referrals:
1. **Unlimited Voice Dumps** - Record unlimited voice notes and thoughts
2. **Posting to Circles** - Share progress with private circles
3. **Analytics** - Access detailed productivity insights
4. **Profile Badge** - Special supporter status badge
5. **Unlimited GIFs** - Unlimited GIF reactions and celebrations

Each referral grants **1 unlock credit** that can be used to activate any feature.

## Architecture

### Database Schema

**Collection**: `referrals`

```javascript
{
  _id: ObjectId,
  userId: ObjectId,              // Reference to user
  referralCode: String,          // Unique 8-character code (e.g., "ABCD1234")
  unlocksRemaining: Number,      // Available unlock credits
  referredUsers: [{              // List of referred users
    userId: ObjectId,
    joinedAt: Date,
    displayName: String,
    handle: String,
    rewardGranted: Boolean
  }],
  unlockedFeatures: [{           // Features user has unlocked
    featureId: String,
    featureName: String,
    unlockedAt: Date,
    unlockedBy: ObjectId,
    expiresAt: Date (optional),
    active: Boolean
  }],
  referredBy: ObjectId (optional), // Who referred this user
  metadata: {
    createdAt: Date,
    updatedAt: Date,
    totalReferred: Number,
    lastReferralAt: Date (optional)
  }
}
```

### Indexes

1. `userId` - Unique index for fast user lookups
2. `referralCode` - Unique index for referral code validation
3. `referredUsers.userId` - Index for tracking who referred whom

## API Endpoints

### 1. Get Referral Info
**GET** `/v1/user/referrals`

Returns the current user's referral information.

**Response:**
```json
{
  "id": "...",
  "userId": "...",
  "referralCode": "ABCD1234",
  "unlocksRemaining": 2,
  "referredUsers": [...],
  "unlockedFeatures": [...],
  "metadata": {...}
}
```

### 2. Apply Referral Code
**POST** `/v1/user/referrals/apply`

Apply a referral code to your account (only works once per user).

**Request:**
```json
{
  "referralCode": "ABCD1234"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Referral code applied successfully!",
  "referrer": {
    "id": "...",
    "displayName": "John Doe",
    "handle": "johndoe",
    "profilePicture": "..."
  }
}
```

### 3. Unlock Feature
**POST** `/v1/user/referrals/unlock`

Use an unlock credit to activate a feature.

**Request:**
```json
{
  "featureId": "unlimited_voice_dumps"
}
```

**Response:**
```json
{
  "success": true,
  "feature": {
    "featureId": "unlimited_voice_dumps",
    "featureName": "Unlimited Voice Dumps",
    "unlockedAt": "2025-01-01T00:00:00Z",
    "active": true
  },
  "unlocksRemaining": 1
}
```

### 4. Get Referral Stats
**GET** `/v1/user/referrals/stats`

Get detailed referral statistics.

**Response:**
```json
{
  "totalReferrals": 3,
  "activeReferrals": 3,
  "unlocksRemaining": 2,
  "unlockedFeatures": [...],
  "referredUsers": [...]
}
```

### 5. Get Available Features
**GET** `/v1/referrals/features`

Get list of all features that can be unlocked (public endpoint).

**Response:**
```json
{
  "features": [
    {
      "id": "unlimited_voice_dumps",
      "name": "Unlimited Voice Dumps",
      "description": "Record unlimited voice notes and thoughts",
      "icon": "microphone",
      "requiredReferrals": 1
    },
    ...
  ]
}
```

## Implementation Details

### Referral Code Generation

Referral codes are:
- 8 characters long
- Base32 encoded for readability
- Uppercase (e.g., "ABCD1234")
- Ambiguous characters (0, O, I, 1) are replaced with (8, 8, 7, 7)
- Unique across all users

### User Registration Flow

When a new user registers:
1. User document is created in `users` collection
2. A referral document is automatically created in `referrals` collection
3. User receives their unique referral code
4. They start with 0 unlock credits

### Applying a Referral Code

When a user applies a referral code:
1. System validates the referral code exists
2. Prevents self-referral
3. Checks if user was already referred
4. Updates referrer's document:
   - Adds referred user to `referredUsers` array
   - Increments `unlocksRemaining` by 1
   - Updates metadata
5. Updates new user's document with `referredBy` field

### Unlocking Features

When a user unlocks a feature:
1. Checks if user has unlock credits remaining
2. Validates feature ID
3. Checks if feature is already unlocked
4. Creates unlock record in `unlockedFeatures` array
5. Decrements `unlocksRemaining` by 1

## Deployment Instructions

### 1. Create the Collection

Run the collection creation script:

```bash
cd backend
go run cmd/db/create_referrals_collection/main.go
```

This creates the `referrals` collection if it doesn't exist.

### 2. Apply Indexes

Apply the indexes defined in `indexes.go`:

```bash
cd backend
go run cmd/db/apply_indexes/main.go
```

### 3. Migrate Existing Users (Optional)

If you have existing users without referral documents, create a migration script to generate referral documents for them:

```go
// Pseudocode
for each user in users {
  if no referral document exists for user {
    create referral document with unique code
  }
}
```

### 4. Deploy Backend

The referral system is now integrated into the main server. Deploy as usual:

```bash
cd backend
go build -o server cmd/server/main.go
./server
```

## Testing

### Manual Testing Checklist

- [ ] Register new user → Verify referral document created
- [ ] Check user's referral code → Should be 8 characters, unique
- [ ] Apply own referral code → Should fail with error
- [ ] Apply friend's referral code → Friend gets +1 unlock
- [ ] Try applying referral code twice → Should fail
- [ ] Unlock a feature → Verify unlock count decreases
- [ ] Try unlocking same feature twice → Should fail
- [ ] Try unlocking with 0 credits → Should fail
- [ ] Check referral stats → Should show correct counts

### API Testing with curl

```bash
# Get referral info
curl -X GET http://localhost:8080/v1/user/referrals \
  -H "Authorization: Bearer YOUR_TOKEN"

# Apply referral code
curl -X POST http://localhost:8080/v1/user/referrals/apply \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"referralCode": "ABCD1234"}'

# Unlock feature
curl -X POST http://localhost:8080/v1/user/referrals/unlock \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"featureId": "unlimited_voice_dumps"}'

# Get stats
curl -X GET http://localhost:8080/v1/user/referrals/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get available features (no auth required)
curl -X GET http://localhost:8080/v1/referrals/features
```

## Feature Gating

To check if a user has a feature unlocked in your code:

```go
import "github.com/abhikaboy/Kindred/internal/handlers/referral"

// In your handler
service := referral.newService(collections)
hasFeature, err := service.HasFeatureUnlocked(userID, referral.FeatureUnlimitedVoiceDumps)
if err != nil {
  // Handle error
}
if !hasFeature {
  return errors.New("Feature not unlocked")
}
// User has the feature, proceed
```

## Frontend Integration

The frontend should:

1. **Display referral code** on user profile/settings
2. **Share functionality** to share referral code via:
   - Copy to clipboard
   - Share to social media
   - Send via messages
3. **Referral input** during onboarding to enter a referral code
4. **Feature marketplace** showing available features and unlock status
5. **Referral dashboard** showing:
   - Number of referrals
   - Unlocks remaining
   - Unlocked features
   - List of referred friends

### Frontend API Client Example

```typescript
// api/referral.ts
import { client } from './client';

export const getReferralInfo = async () => {
  const response = await client.get('/v1/user/referrals');
  return response.data;
};

export const applyReferralCode = async (code: string) => {
  return client.post('/v1/user/referrals/apply', { referralCode: code });
};

export const unlockFeature = async (featureId: string) => {
  return client.post('/v1/user/referrals/unlock', { featureId });
};

export const getReferralStats = async () => {
  const response = await client.get('/v1/user/referrals/stats');
  return response.data;
};

export const getAvailableFeatures = async () => {
  const response = await client.get('/v1/referrals/features');
  return response.data;
};
```

## Future Enhancements

Potential improvements for the referral system:

1. **Referral Campaigns** - Time-limited bonus rewards
2. **Tiered Rewards** - Better rewards for more referrals
3. **Referral Analytics** - Track conversion rates, popular referrers
4. **Email/SMS Invites** - Built-in sharing functionality
5. **Feature Expiration** - Trial periods for certain features
6. **Partner/Affiliate System** - Track referrals from external partners
7. **Leaderboard** - Gamify referrals with top referrers
8. **Social Proof** - "X people used your code this week"
9. **Referral Milestones** - Special rewards at 5, 10, 25 referrals
10. **Feature Bundles** - Unlock multiple features at once

## Troubleshooting

### Common Issues

**Issue: Referral document not created for new users**
- Check if `referrals` collection exists
- Check backend logs for errors during user registration
- Verify auth service has access to referrals collection

**Issue: Duplicate referral codes**
- Very rare due to crypto/rand + uniqueness check
- If occurs, the generation function will retry
- Check database for existing codes

**Issue: User can't apply referral code**
- Verify user hasn't already been referred
- Check if code exists and is valid
- Ensure user isn't trying to self-refer

**Issue: Feature unlock fails**
- Check if user has unlock credits
- Verify feature ID is valid
- Check if feature is already unlocked

## Security Considerations

1. **Referral Code Uniqueness** - Enforced by unique index
2. **Self-Referral Prevention** - Checked in `ApplyReferralCode`
3. **Double-Referral Prevention** - Users can only be referred once
4. **Feature Validation** - Only valid feature IDs can be unlocked
5. **Auth Required** - All user-specific endpoints require authentication
6. **Rate Limiting** - Consider adding rate limits to prevent abuse

## Support

For questions or issues:
- Check the logs in `/var/log/kindred/`
- Review MongoDB indexes with `db.referrals.getIndexes()`
- Test endpoints with the provided curl commands
- Contact the backend team

---

**Last Updated**: October 27, 2025
**Version**: 1.0.0


