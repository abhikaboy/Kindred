# Subscription Links - User Journey

## Where Users See Privacy Policy & Terms of Use Links

### Location 1: Credits Info Sheet

**User Path:**
1. User goes to Voice or Text Dump screen
2. User sees "Natural Language Credits: X remaining"
3. User taps the info icon (ⓘ) next to credits
4. **Credits Info Sheet opens**
5. User scrolls to bottom
6. **Links are visible:** "Privacy Policy" and "Terms of Use"

**Context:** This appears when users want to learn about credits and how to get more (including Premium subscription).

**File:** `frontend/components/CreditsInfoSheet.tsx`

```
┌─────────────────────────────────────┐
│  Natural Language Credits      [X]  │
├─────────────────────────────────────┤
│                                     │
│  What are Natural Language Credits? │
│  [Description text...]              │
│                                     │
│  How to Get More Credits            │
│  ┌─────────────────────────────┐   │
│  │ 💜 Send Kudos               │   │
│  │ [Description...]            │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ ⭐ Purchase Premium         │   │
│  │ Upgrade to Premium for      │   │
│  │ unlimited credits...        │   │
│  └─────────────────────────────┘   │
│                                     │
│  ─────────────────────────────────  │
│  SUBSCRIPTION INFORMATION           │
│  🔗 Privacy Policy                  │
│  🔗 Terms of Use                    │
└─────────────────────────────────────┘
```

---

### Location 2: Kindred Plus Upgrade Modal

**User Path:**
1. User goes to Profile tab
2. User taps "Edit Profile"
3. User taps "Learn about Kindred Plus" button
4. **Kindred Plus modal opens**
5. User sees subscription benefits
6. User scrolls to bottom
7. **Links are visible:** "Privacy Policy • Terms of Use"

**Context:** This appears when users want to learn about or purchase the Premium subscription.

**File:** `frontend/app/(logged-in)/(tabs)/(profile)/edit.tsx`

```
┌─────────────────────────────────────┐
│  Kindred Plus              [X]      │
│  Upgrade for $4.99/month            │
├─────────────────────────────────────┤
│                                     │
│  What's Included:                   │
│                                     │
│  🎤 Unlimited Voice Credits         │
│     Create tasks with your voice... │
│                                     │
│  💬 Unlimited Natural Language      │
│     Use AI to create tasks...       │
│                                     │
│  👥 Unlimited Group Creation        │
│     Collaborate with unlimited...   │
│                                     │
│  📚 Unlimited Blueprint Subs        │
│     Subscribe to as many...         │
│                                     │
│  🚫 Ad-Free Experience              │
│     Enjoy Kindred without ads       │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ $4.99/month • Auto-renewable│   │
│  │ Cancel anytime. No commitment│   │
│  │                              │   │
│  │ Privacy Policy • Terms of Use│   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │   Upgrade to Kindred Plus   │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## App Store Connect Configuration

### Privacy Policy URL Field

**Location:** App Store Connect → Your App → App Information → General Information

**URL to enter:** `https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a`

This makes the Privacy Policy accessible from:
- App Store listing (under "App Privacy" section)
- Settings app → [Your App] → Privacy Policy

---

### Terms of Use (EULA)

**Location:** App Store Connect → Your App → App Information → License Agreement

**Option to select:** "Standard Apple End User License Agreement (EULA)"

**Link used in app:** `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`

---

## Quick Reference

| Requirement | Location in App | Status |
|------------|-----------------|--------|
| Privacy Policy link in app | CreditsInfoSheet | ✅ Added |
| Privacy Policy link in app | Edit Profile Modal | ✅ Existing |
| Terms of Use link in app | CreditsInfoSheet | ✅ Added |
| Terms of Use link in app | Edit Profile Modal | ✅ Existing |
| Privacy Policy in Info.plist | app.json | ✅ Existing |
| Privacy Policy in App Store Connect | Manual step needed | ⚠️ TODO |
| EULA in App Store Connect | Manual step needed | ⚠️ TODO |

---

## Next Steps for App Store Submission

1. **Rebuild the app** with the updated CreditsInfoSheet
   ```bash
   cd frontend
   eas build --platform ios --profile production
   ```

2. **Configure App Store Connect:**
   - Add Privacy Policy URL to App Information
   - Set EULA to "Standard Apple EULA"

3. **Test the links** before submitting:
   - Test CreditsInfoSheet links
   - Test Edit Profile modal links
   - Verify both links open correctly

4. **Submit for review** with confidence that all Guideline 3.1.2 requirements are met
