package credits

// This package provides a thin wrapper around the credits functionality
// defined in the types package. Other handlers can import this package
// or use the types package directly to manage user credits.
//
// Example usage from another handler:
//
//   import (
//       "github.com/abhikaboy/Kindred/internal/handlers/types"
//   )
//
//   // Before creating a group, check and consume a credit
//   err := types.ConsumeCredit(ctx, userCollection, userID, types.CreditTypeGroup)
//   if err == types.ErrInsufficientCredits {
//       return huma.Error400BadRequest("Insufficient credits to create group", err)
//   }
//
//   // Or add credits when user completes an action
//   err := types.AddCredits(ctx, userCollection, userID, types.CreditTypeVoice, 5)
