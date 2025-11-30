# App Store Subscription Requirements - Fix Guide

## Issue
**Guideline 3.1.2 - Business - Payments - Subscriptions**

Apple requires apps with auto-renewable subscriptions to display:
1. Privacy Policy link in the app binary ✅ FIXED
2. Terms of Use (EULA) link in App Store Connect
3. Privacy Policy link in App Store Connect metadata

## What Was Fixed

### ✅ 1. Added Privacy Policy to App Binary

**Files Updated:**
- `frontend/ios/Kindred/Info.plist` - Added `NSPrivacyPolicyURL`
- `frontend/app.json` - Added `NSPrivacyPolicyURL` to `ios.infoPlist`

**Privacy Policy URL:**
```
https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a
```

## Next Steps - App Store Connect

### 2. Set Privacy Policy URL in App Store Connect

1. Log in to [App Store Connect](https://appstoreconnect.apple.com)
2. Go to **My Apps** → **Kindred**
3. Click **App Information** (in left sidebar)
4. Scroll to **Privacy Policy URL** field
5. Enter: `https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a`
6. Click **Save**

### 3. Set EULA in App Store Connect

Since you're using Apple's Standard EULA:

1. In **App Information** page
2. Find **End User License Agreement (EULA)** section
3. Select **"Use Apple's Standard EULA"** (should be default)
4. If custom EULA field is shown, leave it blank
5. Click **Save**

**OR** if you need to add it to the App Description:

1. Go to your app version (e.g., "0.0.1 - Prepare for Submission")
2. Scroll to **Description** field
3. Add at the bottom:
   ```
   Terms of Use: By using Kindred, you agree to Apple's Standard EULA.
   Privacy Policy: https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a
   ```

### 4. Ensure Subscription Info is Visible in App ✅ FIXED

Apple requires your app to display subscription information including:
- ✅ Title: "Kindred Plus"
- ✅ Length: "Monthly" ($4.99/month)
- ✅ Price displayed clearly
- ✅ **Functional links to Privacy Policy and Terms of Use**
- ✅ Statement that it's auto-renewable

**Where it's implemented:**
- `frontend/app/(logged-in)/(tabs)/(profile)/edit.tsx` - The "Kindred Plus" upgrade modal

**What was added:**
- Added "Auto-renewable subscription" text
- Added functional links to Privacy Policy and Terms of Use (EULA)
- Both links are touchable and open in the device browser

The modal now includes:
```tsx
<TouchableOpacity onPress={() => Linking.openURL('https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a')}>
  <ThemedText>Privacy Policy</ThemedText>
</TouchableOpacity>

<TouchableOpacity onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>
  <ThemedText>Terms of Use</ThemedText>
</TouchableOpacity>
```

### 5. Rebuild and Resubmit

1. Increment build number in `app.json`:
   ```json
   "buildNumber": "56"  // was 55
   ```

2. Build new version:
   ```bash
   cd frontend
   eas build --platform ios
   ```

3. Upload to App Store Connect

4. Submit for review with a note:
   ```
   We have added the required privacy policy URL to the app binary (NSPrivacyPolicyURL in Info.plist) 
   and App Store metadata. We are using Apple's Standard EULA as our Terms of Use.
   ```

## Checklist

- [x] Added `NSPrivacyPolicyURL` to `Info.plist`
- [x] Added `NSPrivacyPolicyURL` to `app.json`
- [x] Added Privacy Policy and Terms links to upgrade modal in `edit.tsx`
- [x] Added "Auto-renewable subscription" text to upgrade screen
- [ ] Set Privacy Policy URL in App Store Connect → App Information
- [ ] Confirmed EULA setting in App Store Connect (using Apple's Standard)
- [ ] Increment build number to 56
- [ ] Build new version with `eas build --platform ios`
- [ ] Upload to App Store
- [ ] Resubmit for review

## Reference Links

- Privacy Policy: https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a
- Apple's Standard EULA: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
- App Store Connect: https://appstoreconnect.apple.com
- Apple Developer Guidelines: https://developer.apple.com/app-store/review/guidelines/#business

## Notes

- The Notion URL works fine for Apple's requirements (doesn't need to be on your own domain)
- Make sure the Notion page is publicly accessible (not requiring login)
- Apple's Standard EULA is acceptable for most apps - no need to create custom terms unless you have special requirements

---
**Created:** Nov 30, 2025  
**Status:** Code changes complete, App Store Connect updates pending

