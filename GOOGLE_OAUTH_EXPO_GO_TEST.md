# Testing Google OAuth in Expo Go with Proxy

## What Changed

I've updated `useGoogleAuth.tsx` to explicitly use Expo's auth proxy:

```typescript
const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
// This generates: https://auth.expo.io/@suntex/Kindred
```

This **might** work in Expo Go because:
- ✅ Uses HTTPS (Google's requirement)
- ✅ Goes through Expo's auth proxy
- ✅ Configured in your Google Console

## Testing Steps

### 1. Check the Redirect URI

When you open your app, check the console logs:
```
🔗 Google OAuth Redirect URI: https://auth.expo.io/@suntex/Kindred
```

### 2. Verify Google Console Configuration

Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and verify your **Web Application** client ID has this exact redirect URI:

```
https://auth.expo.io/@suntex/Kindred
```

**Important**: It must match EXACTLY (case-sensitive, no trailing slash)

### 3. Test in Expo Go

```bash
cd frontend
npx expo start
```

Then:
1. Open app in Expo Go
2. Tap "Continue with Google"
3. Check if it works!

## Expected Outcomes

### ✅ If It Works
- Google OAuth screen opens
- You can authenticate
- Redirects back to your app
- User is registered/logged in

**This means**: The proxy method works! You can continue using Expo Go for development.

### ❌ If It Still Fails

You'll see one of these errors:

**Error 1: "Invalid Redirect URI"**
- The redirect URI in Google Console doesn't match
- Double-check it's exactly: `https://auth.expo.io/@suntex/Kindred`

**Error 2: "Authorization Error: invalid_request"**
- Google is still rejecting the flow
- This means you MUST use a development build

**Error 3: App doesn't open after auth**
- OAuth succeeded but redirect failed
- Check your `app.json` scheme configuration

## Why This Might Work Now

Previously, `Google.useAuthRequest()` might have been generating a different redirect URI. By explicitly setting:

```typescript
redirectUri: AuthSession.makeRedirectUri({ useProxy: true })
```

We're forcing it to use Expo's HTTPS proxy, which Google should accept.

## If It Still Doesn't Work

If you still get errors, it means Google is rejecting the Expo proxy for some reason. In that case, you'll need to:

1. **Build a development build** (the reliable solution)
   ```bash
   cd frontend
   eas build --platform ios --profile development
   ```

2. **Or test on web** (quick alternative)
   ```bash
   npx expo start --web
   ```

## Checking Your Google Console

Your Web Application client should have:

**Client ID**: `955300435674-5jut5auaic2u4k8udu6spkqf1b13uau8.apps.googleusercontent.com`

**Authorized JavaScript origins**:
```
https://auth.expo.io
```

**Authorized redirect URIs**:
```
https://auth.expo.io/@suntex/Kindred
```

## Next Steps

1. ✅ Code is updated with explicit proxy redirect
2. ✅ Verify Google Console configuration
3. ✅ Test in Expo Go
4. ❌ If it fails → Build development build

Good luck! Let me know if it works or if you see any errors. 🤞
