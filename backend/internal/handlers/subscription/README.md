# Subscription System

## Overview

The subscription system provides a flexible, tiered monetization model for Kindred. It works alongside the existing credits and referral systems to provide premium features while keeping the free tier engaging.

## Architecture

### Subscription Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | - Standard credit system<br>- Kudos rewards<br>- Referral unlocks<br>- 1x credit regeneration |
| **Basic** | $4.99/mo | - Everything in Free<br>- 2x credit regeneration<br>- No ads<br>- Basic support |
| **Premium** | $9.99/mo | - Unlimited voice credits<br>- Unlimited natural language<br>- Unlimited groups<br>- Unlimited analytics<br>- No ads<br>- Priority support |
| **Lifetime** | $49.99 | - All Premium features<br>- Forever (one-time payment) |

### How Systems Work Together

```
Free Users → Credits + Kudos + Referrals
   ↓
Basic Users → 2x Credits + Kudos + Referrals + No Ads
   ↓
Premium Users → Unlimited Everything + Priority Support
```

## Database Schema

### Subscription Type

```go
type Subscription struct {
    Tier           SubscriptionTier     // free, basic, premium, lifetime
    Status         SubscriptionStatus   // active, expired, canceled, trial
    StartDate      time.Time
    EndDate        *time.Time           // When subscription ends
    RenewalDate    *time.Time           // Next billing date
    Provider       SubscriptionProvider // stripe, apple, google, promo
    SubscriptionID string               // External provider ID
    CanceledAt     *time.Time           // When user canceled
}
```

### Added to User Model

```go
type User struct {
    // ... existing fields ...
    Subscription    Subscription `bson:"subscription" json:"subscription"`
}
```

## Helper Functions

All helper functions are in `backend/internal/handlers/types/subscription.go`:

### Getting Subscription Info

```go
// Check if subscription is active
if user.Subscription.IsActive() {
    // User has active subscription
}

// Check if premium tier
if user.Subscription.IsPremiumTier() {
    // User has premium or lifetime
}

// Check if user has unlimited credits
if user.Subscription.HasUnlimitedCredits() {
    // Don't deduct credits
}

// Get credit multiplier (0 = unlimited, 1 = normal, 2 = 2x)
multiplier := user.Subscription.GetCreditMultiplier()

// Get all features
features := user.Subscription.GetFeatures()
if features.UnlimitedVoice {
    // Allow unlimited voice
}
```

### Subscription Management

```go
import "github.com/abhikaboy/Kindred/internal/handlers/types"

// Get user's subscription
subscription, err := types.GetUserSubscription(ctx, userCollection, userID)

// Upgrade subscription
err := types.UpgradeSubscription(
    ctx, 
    userCollection, 
    userID, 
    types.TierPremium,
    types.ProviderStripe,
    "sub_1234567890",
)

// Cancel subscription (keeps active until end date)
err := types.CancelSubscription(ctx, userCollection, userID)

// Renew subscription (for next billing period)
err := types.RenewSubscription(ctx, userCollection, userID)

// Expire subscription (downgrade to free)
err := types.ExpireSubscription(ctx, userCollection, userID)
```

## Integration with Existing Systems

### Credits System

The subscription system **enhances** the credits system, not replaces it:

```go
// Example: Voice credit check
func checkVoiceCredit(user types.User) bool {
    // Premium users bypass credit checks
    if user.Subscription.HasUnlimitedCredits() {
        return true
    }
    
    // Basic users get 2x credit regeneration (handled elsewhere)
    // Free users use standard credit system
    return user.Credits.Voice > 0
}
```

### Kudos System

Kudos continue to work for all tiers - they're a community engagement feature:

- Free users: Earn credits through kudos
- Basic users: Still earn kudos, get 2x credits
- Premium users: Kudos become vanity/social features

### Referral System

Referrals can unlock features or provide discounts:

```go
// Example: Referral bonus
if referralCount >= 3 {
    // Give 1 month free Basic
    // Or discount on Premium upgrade
}
```

## Feature Gating Example

Here's how to gate a feature based on subscription:

```go
func (h *Handler) UseVoiceFeature(ctx context.Context, input *VoiceInput) (*VoiceOutput, error) {
    userID := getUserIDFromContext(ctx)
    
    // Get user
    user, err := h.service.GetUser(ctx, userID)
    if err != nil {
        return nil, err
    }
    
    // Check subscription first
    if user.Subscription.HasUnlimitedCredits() {
        // Premium/Lifetime user - proceed without credit check
        return h.processVoice(ctx, input)
    }
    
    // Check credits for free/basic users
    if user.Credits.Voice <= 0 {
        return nil, huma.Error400BadRequest(
            "No voice credits remaining. Upgrade to Premium for unlimited voice!",
            nil,
        )
    }
    
    // Consume credit
    err = types.ConsumeCredit(ctx, h.userCollection, userID, types.CreditTypeVoice)
    if err != nil {
        return nil, err
    }
    
    return h.processVoice(ctx, input)
}
```

## New User Registration

New users automatically get the free tier:

```go
// In auth/auth.go
user := User{
    // ... other fields ...
    Subscription: types.GetDefaultSubscription(), // Free tier, active
}
```

## Subscription Lifecycle

### 1. New User
- Created with free tier
- Status: `active`
- No end date or renewal date

### 2. Upgrade to Paid Tier
- User purchases subscription
- Status: `active`
- Renewal date set to +30 days
- Provider and subscription ID stored

### 3. Active Subscription
- User has full access to tier features
- Credits may be unlimited or multiplied
- No ads shown

### 4. Cancellation
- User cancels subscription
- Status: `canceled`
- Remains active until end date
- End date = next renewal date

### 5. Expiration
- Subscription expires (past end date)
- Status: `expired` then downgraded to `free`
- User loses premium features
- Returns to credit system

### 6. Renewal
- Subscription auto-renews (via webhook)
- Status: `active`
- Renewal date pushed forward +30 days
- No interruption in service

## Payment Integration

### Stripe (Web)

```typescript
// Frontend - Initiate checkout
const response = await api.post('/v1/subscription/checkout', {
    tier: 'premium',
    provider: 'stripe'
});
window.location.href = response.checkoutUrl;

// Backend - Handle webhook
// POST /v1/webhooks/stripe
// Update subscription status based on events
```

### Apple In-App Purchase (iOS)

```swift
// iOS - Purchase subscription
StoreKit.purchase(productId: "premium_monthly")

// Backend - Verify receipt
// POST /v1/subscription/verify/apple
// { receiptData: "..." }
```

### Google Play (Android)

```kotlin
// Android - Purchase subscription
BillingClient.launchBillingFlow(premiumSku)

// Backend - Verify purchase
// POST /v1/subscription/verify/google
// { purchaseToken: "..." }
```

## Monitoring & Maintenance

### Daily Cron Job

Run this daily to expire old subscriptions:

```go
// In cron job or scheduled task
err := types.CheckAndUpdateExpiredSubscriptions(ctx, userCollection)
if err != nil {
    log.Error("Failed to update expired subscriptions", err)
}
```

### Metrics to Track

- Active subscriptions by tier
- Churn rate (cancellations)
- Conversion rate (free → paid)
- Average revenue per user (ARPU)
- Lifetime value (LTV)
- Credit consumption by tier

## Frontend Integration

### Displaying Subscription Status

```typescript
import { Subscription, SubscriptionTier } from '@/api/types';

const SubscriptionBadge = ({ subscription }: { subscription: Subscription }) => {
    if (subscription.tier === 'free') return null;
    
    return (
        <View style={styles.badge}>
            <Text>{subscription.tier.toUpperCase()}</Text>
        </View>
    );
};
```

### Feature Gates

```typescript
const VoiceButton = ({ user }) => {
    const canUse = user.subscription.tier === 'premium' 
        || user.subscription.tier === 'lifetime' 
        || user.credits.voice > 0;
    
    return (
        <Button 
            disabled={!canUse}
            onPress={handleVoiceRecord}
        >
            {!canUse ? 'Upgrade for Voice' : 'Record Voice'}
        </Button>
    );
};
```

### Upgrade Prompts

```typescript
const UpgradePrompt = () => (
    <Modal>
        <Text>Unlock Unlimited Voice!</Text>
        <Text>$9.99/month</Text>
        <Button onPress={handleUpgrade}>Upgrade to Premium</Button>
        <Text>Or earn credits by sending kudos!</Text>
    </Modal>
);
```

## Testing

### Test Scenarios

1. **New User Registration**
   - Verify free tier assigned
   - Check default values

2. **Upgrade Flow**
   - Test each tier upgrade
   - Verify feature access
   - Check webhook handling

3. **Credit Consumption**
   - Free: Normal consumption
   - Basic: 2x regeneration
   - Premium: No consumption

4. **Cancellation**
   - Verify stays active until end
   - Check downgrade at expiration

5. **Renewal**
   - Test successful renewal
   - Handle failed payment

### Test Users

Create test users for each tier:

```bash
# Create free user (default)
POST /v1/auth/register

# Create premium test user
POST /v1/test/user/premium
```

## Migration Guide

### For Existing Users

When deploying this feature:

1. Add `subscription` field to all existing users:

```javascript
// MongoDB migration
db.users.updateMany(
    { subscription: { $exists: false } },
    { $set: { 
        subscription: {
            tier: "free",
            status: "active",
            startDate: new Date()
        }
    }}
)
```

2. Grant promo premium to early adopters:

```javascript
// Give 3 months free premium to beta users
db.users.updateMany(
    { createdAt: { $lt: new Date('2025-01-01') } },
    { $set: { 
        subscription: {
            tier: "premium",
            status: "trial",
            startDate: new Date(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // +90 days
            provider: "promo"
        }
    }}
)
```

## Future Enhancements

- [ ] Annual subscriptions (20% discount)
- [ ] Family/team plans
- [ ] Student discount verification
- [ ] Referral rewards (1 month free)
- [ ] Gifting subscriptions
- [ ] Trial periods (7-day free trial)
- [ ] Promotional campaigns
- [ ] Subscription pausing
- [ ] Downgrade protection (keep data)
- [ ] Usage-based billing option

## Support

For issues or questions:
- Check MongoDB for subscription data
- Review webhook logs for payment events
- Verify provider credentials (Stripe, Apple, Google)
- Check expiration cron job status

---

**Last Updated**: November 18, 2025
**Version**: 1.0.0

