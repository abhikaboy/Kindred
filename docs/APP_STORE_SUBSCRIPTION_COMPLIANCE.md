# App Store Subscription Compliance - Guideline 3.1.2

## Issue from App Store Review

**Guideline 3.1.2 - Business - Payments - Subscriptions**

The submission did not include all the required information for apps offering auto-renewable subscriptions.

### Required Information

The following information needs to be included:

1. **Within the app:**
   - A functional link to the Terms of Use (EULA)
   - A functional link to the privacy policy

2. **In the App Store metadata:**
   - A functional link to the Terms of Use (EULA) - either standard Apple EULA or custom EULA
   - A functional link to the privacy policy in the Privacy Policy field

## Changes Made

### 1. CreditsInfoSheet Component ✅

**File:** `frontend/components/CreditsInfoSheet.tsx`

Added subscription information links at the bottom of the sheet that explains premium features:

```tsx
{/* Subscription Links - Required by App Store Guidelines 3.1.2 */}
<View style={[styles.linksSection, { borderTopColor: ThemedColor.tertiary }]}>
    <ThemedText type="default" style={[styles.linksTitle, { color: ThemedColor.caption }]}>
        Subscription Information
    </ThemedText>
    <View style={styles.linksContainer}>
        <TouchableOpacity 
            onPress={() => Linking.openURL('https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a')}
            style={styles.linkButton}
        >
            <ThemedText type="default" style={[styles.linkText, { color: ThemedColor.primary }]}>
                Privacy Policy
            </ThemedText>
            <Ionicons name="open-outline" size={16} color={ThemedColor.primary} />
        </TouchableOpacity>
        <TouchableOpacity 
            onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}
            style={styles.linkButton}
        >
            <ThemedText type="default" style={[styles.linkText, { color: ThemedColor.primary }]}>
                Terms of Use
            </ThemedText>
            <Ionicons name="open-outline" size={16} color={ThemedColor.primary} />
        </TouchableOpacity>
    </View>
</View>
```

**Where it appears:** When users tap the info icon next to their natural language credits, they see information about how to get more credits, including upgrading to Premium. The links appear at the bottom of this sheet.

### 2. Edit Profile - Kindred Plus Modal ✅

**File:** `frontend/app/(logged-in)/(tabs)/(profile)/edit.tsx`

Already has Privacy Policy and Terms of Use links in the subscription upgrade modal (lines 457-470):

```tsx
{/* Required: Privacy Policy and Terms Links */}
<View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 }}>
    <TouchableOpacity onPress={() => Linking.openURL('https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a')}>
        <ThemedText type="default" style={{ opacity: 0.7, fontSize: 13, textDecorationLine: 'underline', color: ThemedColor.primary }}>
            Privacy Policy
        </ThemedText>
    </TouchableOpacity>
    <ThemedText type="default" style={{ opacity: 0.7, fontSize: 13 }}>•</ThemedText>
    <TouchableOpacity onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>
        <ThemedText type="default" style={{ opacity: 0.7, fontSize: 13, textDecorationLine: 'underline', color: ThemedColor.primary }}>
            Terms of Use
        </ThemedText>
    </TouchableOpacity>
</View>
```

**Where it appears:** In the profile edit screen, when users tap "Learn about Kindred Plus", they see a modal with subscription benefits. The links appear at the bottom of this modal.

### 3. Info.plist - Privacy Policy URL ✅

**File:** `frontend/app.json` (line 23)

Already configured:

```json
"NSPrivacyPolicyURL": "https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a"
```

This makes the privacy policy accessible from the App Store listing.

## Links Used

### Privacy Policy
**URL:** `https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a`

- ✅ Functional link
- ✅ Accessible from within the app
- ✅ Included in Info.plist for App Store metadata

### Terms of Use (EULA)
**URL:** `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`

- ✅ Using Apple's Standard EULA
- ✅ Functional link
- ✅ Accessible from within the app

**Note:** We're using Apple's standard EULA. If you want to use a custom EULA, you'll need to:
1. Create your own Terms of Use document
2. Update all links in the app to point to your custom EULA
3. Add the custom EULA link to App Store Connect

## App Store Connect Configuration

### Step 1: Privacy Policy URL

1. Go to App Store Connect
2. Select your app
3. Go to "App Information"
4. Under "General Information", find "Privacy Policy URL"
5. Enter: `https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a`

### Step 2: Terms of Use (EULA)

Since you're using Apple's Standard EULA:

1. Go to App Store Connect
2. Select your app
3. Go to "App Information"
4. Under "License Agreement", select "Standard Apple End User License Agreement (EULA)"

**OR** if you want to include a link to the EULA in the App Description:

Add this to your App Description:
```
Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
```

## Verification Checklist

Before submitting to App Store, verify:

- [ ] Privacy Policy link is functional in the app (CreditsInfoSheet)
- [ ] Terms of Use link is functional in the app (CreditsInfoSheet)
- [ ] Privacy Policy link is functional in the app (Edit Profile modal)
- [ ] Terms of Use link is functional in the app (Edit Profile modal)
- [ ] Privacy Policy URL is set in App Store Connect → App Information
- [ ] EULA is set to "Standard Apple EULA" in App Store Connect
- [ ] Both links are visible to users BEFORE they purchase a subscription
- [ ] Links open in the device's default browser

## Testing

### Test in the App

1. **CreditsInfoSheet:**
   - Go to Voice or Text Dump screen
   - Tap the info icon (ⓘ) next to "Natural Language Credits"
   - Scroll to the bottom
   - Verify "Privacy Policy" and "Terms of Use" links are visible
   - Tap each link and verify they open correctly

2. **Edit Profile Modal:**
   - Go to Profile tab
   - Tap "Edit Profile"
   - Tap "Learn about Kindred Plus" (if visible)
   - Scroll to the bottom of the modal
   - Verify "Privacy Policy" and "Terms of Use" links are visible
   - Tap each link and verify they open correctly

### Test Links

- Privacy Policy: https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a
- Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

Both should open successfully in a browser.

## Additional Recommendations

### 1. Create a Custom Terms of Use (Optional)

If you want more control over your terms, create a custom EULA:

1. Create a Notion page or web page with your custom terms
2. Update all links in the app to point to your custom EULA
3. In App Store Connect, select "Custom EULA" and paste your terms

### 2. Add Links to Other Subscription Flows

If you add more subscription purchase flows in the future, make sure to include the Privacy Policy and Terms of Use links in those flows as well.

### 3. SubscriptionStoreView (Future)

Apple recommends using `SubscriptionStoreView` for in-app subscriptions. This automatically includes all required links. Consider implementing this in the future:

```swift
import StoreKit

SubscriptionStoreView(productIDs: ["premium_monthly", "premium_yearly"])
```

## References

- [App Store Review Guidelines 3.1.2](https://developer.apple.com/app-store/review/guidelines/#business)
- [Apple's Standard EULA](https://www.apple.com/legal/internet-services/itunes/dev/stdeula/)
- [SubscriptionStoreView Documentation](https://developer.apple.com/documentation/storekit/subscriptionstoreview)
