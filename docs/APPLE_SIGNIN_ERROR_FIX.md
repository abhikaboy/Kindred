# Apple Sign-In Error Handling Fix

## Problem

Users trying to sign up with Apple would sometimes see an ugly error alert displaying raw JSON:

```
Apple sign in failed: Login failed: {"$schema":"https://kindredtodo.com/schemas/ErrorModel.json","title":"Internal Server Error","status":500,"detail":"Apple login failed","errors":[{"message":"Account does not exist, Try to register"}]}
```

## Root Cause

The issue happens when **Apple doesn't provide email/name during sign-up**, which occurs when:

1. **User previously authorized the app** - Even if they never completed registration, Apple considers them "already authorized" and won't send email/name again
2. **User clicked "Hide My Email"** - Apple provides a relay email initially, but may not provide it on subsequent attempts
3. **User revoked and re-authorized** - Apple's authorization cache can get confused

### The Flawed Logic

The original code in `OnboardModal.tsx` assumed:

```typescript
// If Apple doesn't provide name/email, user is signing in again (not first time)
if (!email || !firstName || !lastName) {
    console.log("We think you already have an account: trying to log in instead");
    await login(appleAccountID);  // ❌ This fails if they never completed registration!
}
```

**The problem:** Just because Apple doesn't provide email/name doesn't mean the user has an account in YOUR database.

### What Actually Happens

1. User clicks "Sign up with Apple" 
2. Apple returns credential but **no email/name** (because they authorized before, or Apple is being weird)
3. App assumes: "No email/name = they must have an account already"
4. App tries to login → **Backend checks `apple_id` in database** → Not found!
5. Backend returns: `fiber.NewError(404, "Account does not exist, Try to register")`
6. Frontend displays ugly JSON error

### How Backend Checks for Accounts

The backend checks by `apple_id` (Apple's unique user identifier), NOT by email:

```go
func (s *Service) LoginFromApple(apple_id string) (*primitive.ObjectID, *float64, *User, error) {
    var user User
    err := s.users.FindOne(context.Background(), bson.M{"apple_id": apple_id}).Decode(&user)
    if errors.Is(err, mongo.ErrNoDocuments) {
        return nil, nil, nil, fiber.NewError(404, "Account does not exist, Try to register")
    }
    return &user.ID, &user.Count, &user, nil
}
```

## Solution

The fix involves two key changes:

### 1. Clean Error Handling - useAuth.tsx

Updated both `login()` and `loginWithGoogle()` functions to:
- Parse the error response properly
- Check for 404 status or "Account does not exist" message
- Throw a clean error code `ACCOUNT_NOT_FOUND` instead of raw JSON

```typescript
if (result.error) {
    const errorDetail = result.error?.detail || '';
    const errorStatus = result.response?.status;
    
    if (errorStatus === 404 || errorDetail.includes('Account does not exist')) {
        throw new Error("ACCOUNT_NOT_FOUND");
    }
    
    throw new Error(`Login failed: ${errorDetail || 'An unexpected error occurred'}`);
}
```

### 2. Smart Sign-Up Flow - OnboardModal.tsx & SignUpButton.tsx

**Changed the logic from assumption-based to verification-based:**

**Before (Flawed):**
```typescript
// Assume no email/name = has account
if (!email || !firstName || !lastName) {
    await login(appleAccountID);  // ❌ Fails if no account exists
}
```

**After (Fixed):**
```typescript
// If Apple doesn't provide email/name, CHECK if account exists first
if (!email || !firstName || !lastName) {
    try {
        await login(appleAccountID);
        // ✅ Login succeeded - they have an account!
        router.push("/(logged-in)/(tabs)/(task)");
        return;
    } catch (loginError: any) {
        if (loginError.message === "ACCOUNT_NOT_FOUND") {
            // ✅ No account - show helpful instructions
            alert(
                "Apple didn't share your email and name with us. " +
                "This usually happens if you've authorized this app before " +
                "but didn't complete sign-up.\n\n" +
                "To fix this:\n" +
                "1. Go to Settings > Apple ID > Password & Security > Apps Using Apple ID\n" +
                "2. Find 'Kindred' and tap 'Stop Using Apple ID'\n" +
                "3. Come back and try signing up again"
            );
        }
    }
}
```

### 3. User-Friendly Error Messages

All login/signup flows now check for `ACCOUNT_NOT_FOUND` and display helpful messages:

- **Login flow:** "No account found. Please sign up first!"
- **Sign-up flow (no email/name):** Detailed instructions on how to reset Apple authorization
- **Other errors:** Clean error messages instead of raw JSON

## User Experience After Fix

### Scenario 1: User clicks "Sign In" but has no account

**Before:**
```
Alert: Apple sign in failed: Login failed: {"$schema":"https://...","errors":[{"message":"Account does not exist, Try to register"}]}
```

**After:**
```
Alert: No account found. Please sign up first!
```

### Scenario 2: User clicks "Sign Up" but Apple doesn't provide email/name

**Before:**
- App assumes they have an account
- Tries to login → fails
- Shows ugly JSON error

**After:**
- App tries to login to CHECK if account exists
- If no account: Shows helpful message with instructions to reset Apple authorization
- If account exists: Logs them in successfully!

```
Alert: Apple didn't share your email and name with us. This usually happens if you've authorized this app before but didn't complete sign-up.

To fix this:
1. Go to Settings > Apple ID > Password & Security > Apps Using Apple ID
2. Find 'Kindred' and tap 'Stop Using Apple ID'
3. Come back and try signing up again

Or use the 'Sign In' button if you already have an account.
```

## Files Modified

1. **`frontend/hooks/useAuth.tsx`**
   - Updated `login()` function to parse errors and throw `ACCOUNT_NOT_FOUND`
   - Updated `loginWithGoogle()` function with same error handling
   - Removed generic "try to register" alerts (now handled in UI)

2. **`frontend/components/modals/OnboardModal.tsx`**
   - Fixed `apple_regiser()` function to verify account existence before assuming
   - Updated `apple_login()` function with clean error handling
   - Updated Google sign-in error handling with `ACCOUNT_NOT_FOUND` check

3. **`frontend/components/auth/LogInButton.tsx`**
   - Updated Apple sign-in button with `ACCOUNT_NOT_FOUND` error handling

4. **`frontend/components/auth/SignUpButton.tsx`**
   - Updated error message when Apple doesn't provide email/name
   - Added helpful instructions for resetting Apple authorization

## Testing Recommendations

1. **Test first-time user flow:**
   - Delete app and reinstall
   - Click "Sign in with Apple" (without signing up first)
   - Should see: "No account found. Please sign up first!"

2. **Test existing user flow:**
   - Sign in with Apple with existing account
   - Should work normally

3. **Test Google sign-in:**
   - Same scenarios as Apple
   - Should have consistent error messages

4. **Test error scenarios:**
   - Network errors
   - Server errors
   - Should show appropriate error messages (not raw JSON)
