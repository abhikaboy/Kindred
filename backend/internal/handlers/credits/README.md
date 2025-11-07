# Credits System

This package provides internal credit management functionality for the Kindred backend. Credits are used to gate premium features like voice task creation, blueprint creation, group creation, and analytics access.

## Overview

The credits system is implemented as a service layer that other handlers can use to:
- Check if a user has sufficient credits
- Consume credits when using premium features
- Add credits when users earn them through actions or purchases

**Note:** This package does NOT expose public API endpoints. Credits are managed internally by other handlers.

## Credit Types

Four types of credits are available:

| Credit Type | Constant | Default Amount | Purpose |
|------------|----------|----------------|---------|
| Voice | `types.CreditTypeVoice` | 10 | Voice-based task creation |
| Blueprint | `types.CreditTypeBlueprint` | 5 | Blueprint creation |
| Group | `types.CreditTypeGroup` | 3 | Group creation |
| Analytics | `types.CreditTypeAnalytics` | 0 | Analytics access |

## Database Schema

Credits are stored in the User document:

```go
type UserCredits struct {
    Voice      int `bson:"voice" json:"voice"`
    Blueprint  int `bson:"blueprint" json:"blueprint"`
    Group      int `bson:"group" json:"group"`
    Analytics  int `bson:"analytics" json:"analytics"`
}

type User struct {
    // ... other fields
    Credits UserCredits `bson:"credits" json:"credits"`
}
```

## Usage

### Import

```go
import "github.com/abhikaboy/Kindred/internal/handlers/types"
```

### Check Credits

```go
hasCredits, err := types.CheckCredits(ctx, userCollection, userID, types.CreditTypeGroup)
if err != nil {
    return err
}
if !hasCredits {
    return huma.Error400BadRequest("Insufficient credits", nil)
}
```

### Consume Credits (Atomic)

```go
err := types.ConsumeCredit(ctx, userCollection, userID, types.CreditTypeGroup)
if err == types.ErrInsufficientCredits {
    return huma.Error400BadRequest("You don't have enough credits to create a group", err)
}
if err != nil {
    return huma.Error500InternalServerError("Failed to consume credit", err)
}
```

### Add Credits

```go
// Add 5 voice credits as a reward
err := types.AddCredits(ctx, userCollection, userID, types.CreditTypeVoice, 5)
if err != nil {
    return huma.Error500InternalServerError("Failed to add credits", err)
}
```

### Get Credit Balance

```go
credits, err := types.GetCredits(ctx, userCollection, userID)
if err != nil {
    return err
}
fmt.Printf("Voice credits: %d\n", credits.Voice)
```

## Implementation Details

### Thread Safety

All credit operations use MongoDB's atomic update operations to ensure thread safety:

- `ConsumeCredit` uses `FindOneAndUpdate` with a condition that credits > 0
- `AddCredits` uses `$inc` operator for atomic increments

### New User Registration

Default credits are automatically assigned during user registration in `auth.go`:

```go
user := User{
    // ... other fields
    Credits: types.GetDefaultCredits(),
}
```

### Error Handling

- `types.ErrInsufficientCredits` - User doesn't have enough credits
- `types.ErrInvalidCreditType` - Invalid credit type provided
- `mongo.ErrNoDocuments` - User not found or credit consumption failed

## Example Integration: Group Creation

Here's how the group handler might integrate credits:

```go
func (h *Handler) CreateGroup(ctx context.Context, input *CreateGroupInput) (*CreateGroupOutput, error) {
    userID := getUserIDFromContext(ctx)
    
    // Try to consume a group credit
    err := types.ConsumeCredit(ctx, h.userCollection, userID, types.CreditTypeGroup)
    if err == types.ErrInsufficientCredits {
        return nil, huma.Error400BadRequest(
            "You need group credits to create a new group. Complete tasks to earn more credits!",
            err,
        )
    }
    if err != nil {
        return nil, huma.Error500InternalServerError("Failed to process credits", err)
    }
    
    // Create the group
    group, err := h.service.CreateGroup(ctx, input)
    if err != nil {
        // Consider adding the credit back on failure
        types.AddCredits(ctx, h.userCollection, userID, types.CreditTypeGroup, 1)
        return nil, err
    }
    
    return &CreateGroupOutput{Body: group}, nil
}
```

## Future Enhancements

- [ ] Credit transaction history/logging
- [ ] Credit expiration
- [ ] Credit packages/bundles
- [ ] Admin API for managing credits
- [ ] Refund mechanism for failed operations
- [ ] Analytics on credit usage patterns

