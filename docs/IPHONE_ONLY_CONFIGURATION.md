# iPhone-Only Configuration Fix

## Problem

The app was being detected as iPad-compatible during App Store submission, even though it was intended to be iPhone-only.

## Root Cause

The `Info.plist` file had:
```xml
<key>UIRequiresFullScreen</key>
<false/>
```

When `UIRequiresFullScreen` is `false`, iOS allows the app to run in iPad multitasking mode, which signals iPad compatibility to the App Store.

## Changes Made

### 1. Info.plist - Force Full Screen (iPhone Only)

**File:** `frontend/ios/Kindred/Info.plist`

Changed line 94-95:
```xml
<!-- BEFORE -->
<key>UIRequiresFullScreen</key>
<false/>

<!-- AFTER -->
<key>UIRequiresFullScreen</key>
<true/>
```

**Why:** Setting `UIRequiresFullScreen` to `true` prevents the app from running in iPad multitasking/split-view mode, effectively making it iPhone-only.

### 2. app.json - Explicit Configuration

**File:** `frontend/app.json`

Added `requireFullScreen: true` to iOS configuration:
```json
"ios": {
  "buildNumber": "56",
  "supportsTablet": false,
  "requireFullScreen": true,  // ← Added this
  "infoPlist": {
    ...
  }
}
```

**Why:** This ensures Expo generates the correct Info.plist settings during prebuild.

## Verification

### Current Settings (All Correct ✅)

1. **app.json:**
   - ✅ `"supportsTablet": false`
   - ✅ `"requireFullScreen": true`

2. **Info.plist:**
   - ✅ `UIRequiresFullScreen = true`
   - ✅ `LSRequiresIPhoneOS = true`
   - ✅ Only portrait orientations listed

3. **Xcode Project (project.pbxproj):**
   - ✅ `TARGETED_DEVICE_FAMILY = "1"` (iPhone only)
   - ✅ No iPad-specific settings

## Device Family Codes

For reference:
- `1` = iPhone only
- `2` = iPad only
- `1,2` = Universal (both iPhone and iPad)

Your app is set to `1` (iPhone only) ✅

## Next Steps

### 1. Rebuild the iOS App

You need to rebuild the app for these changes to take effect:

```bash
cd frontend

# If using EAS Build
eas build --platform ios --profile production

# Or if building locally
npx expo prebuild --clean
npx expo run:ios
```

### 2. Increment Build Number

Before submitting to App Store, increment the build number:

**In `frontend/app.json`:**
```json
"ios": {
  "buildNumber": "57",  // Changed from 56
  ...
}
```

### 3. Submit to App Store

After building with the new configuration:
1. Upload the new build to App Store Connect
2. The app should now be recognized as iPhone-only
3. You won't see iPad screenshots or iPad-specific requirements

## Verification in App Store Connect

After uploading the new build:

1. Go to App Store Connect
2. Select your app
3. Go to the build details
4. Under "Supported Devices" you should see:
   - ✅ iPhone only
   - ❌ iPad should NOT be listed

## Additional Notes

### Why This Matters for App Store Submission

Apple requires:
- **iPad apps** to have iPad screenshots and support iPad-specific features
- **iPhone-only apps** to only provide iPhone screenshots

If your app is detected as iPad-compatible but you only provide iPhone screenshots, the submission will be rejected.

### If You Ever Want to Support iPad

To support iPad in the future:

1. **app.json:**
   ```json
   "supportsTablet": true,
   "requireFullScreen": false,
   ```

2. **Info.plist:**
   ```xml
   <key>UIRequiresFullScreen</key>
   <false/>
   ```

3. **Add iPad-specific UI adaptations** to handle larger screens
4. **Provide iPad screenshots** for App Store

## Troubleshooting

### Build Still Shows iPad Support

If after rebuilding the app still shows iPad support:

1. **Clean build artifacts:**
   ```bash
   cd frontend/ios
   rm -rf Pods Podfile.lock
   cd ..
   npx expo prebuild --clean
   ```

2. **Verify Info.plist after prebuild:**
   ```bash
   cat ios/Kindred/Info.plist | grep -A 1 "UIRequiresFullScreen"
   ```
   Should show `<true/>`

3. **Check Xcode project:**
   - Open `frontend/ios/Kindred.xcworkspace` in Xcode
   - Select Kindred target
   - Go to General tab
   - Under "Deployment Info" → "Devices" should show "iPhone"

### App Store Connect Still Shows iPad

If App Store Connect still shows iPad after uploading new build:

1. Make sure you uploaded the NEW build (with incremented build number)
2. Wait a few minutes for App Store Connect to process the binary
3. Check the build details, not the app details (app details show all historical builds)
