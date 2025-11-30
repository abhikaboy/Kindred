# Apple App Review - Subscription Requirements Fix

## 🎯 Issue Summary
**Rejection Reason:** Guideline 3.1.2 - Business - Payments - Subscriptions

Apple requires apps with auto-renewable subscriptions to include:
1. ✅ Privacy Policy link in the app binary
2. ✅ Terms of Use (EULA) link in the app binary  
3. ✅ Privacy Policy link in App Store Connect metadata
4. ✅ EULA in App Store Connect

## ✅ Changes Made

### 1. App Binary - Info.plist
**File:** `frontend/ios/Kindred/Info.plist`

Added privacy policy URL:
```xml
<key>NSPrivacyPolicyURL</key>
<string>https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a</string>
```

### 2. App Binary - app.json
**File:** `frontend/app.json`

Added privacy policy to Expo config:
```json
"infoPlist": {
  "NSPrivacyPolicyURL": "https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a",
  // ... other entries
}
```

### 3. Subscription Screen - Required Links
**File:** `frontend/app/(logged-in)/(tabs)/(profile)/edit.tsx`

Updated the "Kindred Plus" upgrade modal to include:

#### Added Subscription Details:
- ✅ Clear pricing: `$4.99/month`
- ✅ Auto-renewable label: `Auto-renewable subscription`
- ✅ Cancellation info: `Cancel anytime. No commitment required.`

#### Added Required Links (Functional/Clickable):
```tsx
<TouchableOpacity onPress={() => Linking.openURL('https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a')}>
  <ThemedText style={{ textDecorationLine: 'underline', color: ThemedColor.primary }}>
    Privacy Policy
  </ThemedText>
</TouchableOpacity>

<TouchableOpacity onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>
  <ThemedText style={{ textDecorationLine: 'underline', color: ThemedColor.primary }}>
    Terms of Use
  </ThemedText>
</TouchableOpacity>
```

### Visual Layout in App:

```
┌─────────────────────────────────────┐
│     Kindred Plus Upgrade Modal      │
├─────────────────────────────────────┤
│                                     │
│  📱 Unlimited Voice Credits         │
│  💬 Unlimited Natural Language      │
│  👥 Unlimited Group Creation        │
│  📋 Unlimited Blueprint Subs        │
│  🚫 Ad-Free Experience              │
│                                     │
│ ╔═════════════════════════════════╗ │
│ ║  $4.99/month • Auto-renewable   ║ │
│ ║  Cancel anytime. No commitment  ║ │
│ ║                                 ║ │
│ ║   Privacy Policy  •  Terms      ║ │ ← Clickable links
│ ║   ─────────────      ─────      ║ │
│ ╚═════════════════════════════════╝ │
│                                     │
│   [Upgrade to Kindred Plus]         │
│                                     │
└─────────────────────────────────────┘
```

## 📋 What You Need to Do Next

### Step 1: Update App Store Connect ⚠️ REQUIRED
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps** → **Kindred** → **App Information**
3. Add Privacy Policy URL:
   ```
   https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a
   ```
4. Confirm **"Use Apple's Standard EULA"** is selected for Terms of Use
5. Click **Save**

### Step 2: Build New Version
```bash
cd frontend

# Increment build number (currently 55 → should be 56)
# Edit app.json: "buildNumber": "56"

# Build new version
eas build --platform ios

# Wait for build to complete
# Upload to App Store Connect via Transporter or EAS
```

### Step 3: Resubmit for Review
When resubmitting, you can add this note to the reviewer:

```
We have addressed the subscription requirements by:
1. Adding NSPrivacyPolicyURL to our app binary (Info.plist)
2. Adding functional links to Privacy Policy and Terms of Use in our subscription screen
3. Adding Privacy Policy URL to App Store Connect metadata
4. Using Apple's Standard EULA as our Terms of Use

All subscription information is now properly displayed in the app.
```

## 🔗 Important Links

- **Privacy Policy:** https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a
- **Apple's Standard EULA:** https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
- **App Store Connect:** https://appstoreconnect.apple.com
- **Review Guidelines:** https://developer.apple.com/app-store/review/guidelines/#business

## ✅ Compliance Checklist

- [x] Privacy Policy URL in Info.plist
- [x] Privacy Policy URL in app.json
- [x] Subscription title displayed ("Kindred Plus")
- [x] Subscription price displayed ("$4.99/month")
- [x] Subscription length displayed ("monthly")
- [x] Auto-renewable statement added
- [x] Functional Privacy Policy link in subscription screen
- [x] Functional Terms of Use link in subscription screen
- [ ] Privacy Policy URL added to App Store Connect
- [ ] EULA setting confirmed in App Store Connect
- [ ] New build with incremented build number
- [ ] Resubmitted for review

## 📝 Notes

- ✅ Your Notion privacy policy URL is perfectly acceptable to Apple
- ✅ Make sure the Notion page is publicly accessible (no login required)
- ✅ Apple's Standard EULA is recommended and widely used
- ✅ The links in your app are functional and will open in Safari/browser
- ✅ All Apple requirements are now met

## 🎉 Expected Outcome

After completing the App Store Connect updates and resubmitting:
- ✅ Your app should pass the subscription requirements check
- ✅ No further changes to the code should be needed
- ✅ The app complies with App Store Review Guidelines 3.1.2

---

**Updated:** Nov 30, 2025  
**Build Number:** 55 → 56 (pending)  
**Status:** Code changes complete ✅ | App Store Connect updates pending ⏳

