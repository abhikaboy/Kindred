# Pre-Submission Checklist for App Store Resubmission

## Overview
This checklist ensures all contact consent changes are properly implemented before resubmitting to the App Store.

---

## 1. Code Changes Verification

### ✅ New Files Created
- [ ] `frontend/hooks/useContactConsent.tsx` exists
- [ ] `frontend/components/modals/ContactConsentModal.tsx` exists
- [ ] Both files have no linter errors
- [ ] Both files are properly imported where needed

### ✅ Files Modified
- [ ] `frontend/app.json` - NSContactsUsageDescription updated
- [ ] `frontend/ios/Kindred/Info.plist` - NSContactsUsageDescription updated
- [ ] `frontend/app/(logged-in)/(tabs)/(search)/search.tsx` - Consent flow integrated
- [ ] `frontend/app/(logged-in)/(tabs)/(task)/settings.tsx` - Privacy controls added
- [ ] All modified files have no linter errors

### ✅ NSContactsUsageDescription
- [ ] Contains phrase "uploaded to our server"
- [ ] Explains purpose (friend matching)
- [ ] Mentions security ("securely uploaded")
- [ ] Same text in both `app.json` and `Info.plist`

**Expected Text:**
```
Kindred needs access to your contacts to find friends who are already using the app. Your contact information will be securely uploaded to our server to match with existing users and help you connect with friends.
```

---

## 2. Build & Compilation

### ✅ iOS Build
- [ ] Run `cd frontend && npx expo prebuild --platform ios`
- [ ] Build completes without errors
- [ ] Info.plist properly updated in build
- [ ] No TypeScript errors
- [ ] No missing dependencies

### ✅ Dependencies
- [ ] `@react-native-async-storage/async-storage` is installed
- [ ] All imports resolve correctly
- [ ] No missing type definitions

---

## 3. Functional Testing

### Test 1: First-Time User - Grant Consent
- [ ] Fresh app install
- [ ] Navigate to Search tab
- [ ] Tap "Sync Contacts" button
- [ ] **Verify:** Consent modal appears
- [ ] **Verify:** Modal shows all required information:
  - [ ] Title: "Find Your Friends on Kindred"
  - [ ] People icon visible
  - [ ] Explanation text present
  - [ ] 4 bullet points about data usage
  - [ ] Privacy Policy reference
  - [ ] "Allow" button (blue/primary)
  - [ ] "Not Now" button (outlined)
- [ ] Tap "Allow"
- [ ] **Verify:** Modal closes
- [ ] **Verify:** iOS contacts permission dialog appears
- [ ] Grant iOS permission
- [ ] **Verify:** Contacts are accessed
- [ ] **Verify:** Upload to server occurs
- [ ] **Verify:** Matched friends shown (if any)
- [ ] **Verify:** "Friends Found!" alert appears (if matches exist)

### Test 2: First-Time User - Decline Consent
- [ ] Fresh app install
- [ ] Navigate to Search tab
- [ ] Tap "Sync Contacts" button
- [ ] **Verify:** Consent modal appears
- [ ] Tap "Not Now"
- [ ] **Verify:** Modal closes
- [ ] **Verify:** Alert appears with:
  - [ ] Title: "Contact Sync Declined"
  - [ ] Message about enabling later in settings
- [ ] Tap "Sync Contacts" again
- [ ] **Verify:** Alert appears with:
  - [ ] Title: "Contact Sync Disabled"
  - [ ] Message about previously declining
- [ ] **Verify:** Consent modal does NOT appear again

### Test 3: Returning User - Previously Granted
- [ ] App with consent already granted
- [ ] Navigate to Search tab
- [ ] Tap "Sync Contacts" button
- [ ] **Verify:** Consent modal does NOT appear
- [ ] **Verify:** Proceeds directly to iOS permission
- [ ] **Verify:** Contact sync works normally

### Test 4: Settings Management
- [ ] Open app (any consent state)
- [ ] Navigate to Settings
- [ ] **Verify:** "PRIVACY" section exists
- [ ] **Verify:** "Contact Sync" row exists
- [ ] **Verify:** Status shows correctly:
  - [ ] "Not Set" if never asked
  - [ ] "Enabled" if granted
  - [ ] "Disabled" if declined
- [ ] Tap "Contact Sync" row
- [ ] **Verify:** Alert appears asking to reset
- [ ] Tap "Reset"
- [ ] **Verify:** Toast appears: "Contact sync preference reset"
- [ ] Return to Search tab
- [ ] Tap "Sync Contacts"
- [ ] **Verify:** Consent modal appears again

### Test 5: iOS Permission Denied
- [ ] Fresh app install
- [ ] Grant app consent (tap "Allow" in modal)
- [ ] When iOS permission appears, tap "Don't Allow"
- [ ] **Verify:** Alert appears explaining permission needed
- [ ] **Verify:** Alert offers to open Settings
- [ ] Tap "Open Settings"
- [ ] **Verify:** iOS Settings app opens

### Test 6: No Contacts on Device
- [ ] Device with no contacts saved
- [ ] Grant app consent
- [ ] Grant iOS permission
- [ ] **Verify:** Alert appears: "No Phone Numbers Found"
- [ ] **Verify:** Message explains contacts need phone numbers

---

## 4. UI/UX Verification

### Consent Modal Design
- [ ] Modal is centered on screen
- [ ] Text is readable and properly formatted
- [ ] Icon is visible and appropriate
- [ ] Buttons are clearly distinguishable
- [ ] "Allow" button is more prominent than "Not Now"
- [ ] Modal cannot be dismissed by tapping outside
- [ ] Modal cannot be swiped down to dismiss
- [ ] All text fits on screen without scrolling (or scrolls properly if needed)
- [ ] Works in both light and dark mode
- [ ] Works on different screen sizes (iPhone SE, iPhone 15 Pro Max, etc.)

### Settings Page
- [ ] Privacy section is clearly labeled
- [ ] Contact Sync row is easy to find
- [ ] Status text is visible and accurate
- [ ] Chevron icon indicates it's tappable
- [ ] Tapping row shows appropriate dialog
- [ ] Toast message appears after reset

---

## 5. Data Privacy Verification

### What Gets Uploaded
- [ ] **ONLY** phone numbers are extracted from contacts
- [ ] Names are NOT uploaded
- [ ] Emails are NOT uploaded
- [ ] Addresses are NOT uploaded
- [ ] Photos are NOT uploaded
- [ ] Any other contact data is NOT uploaded

### Server Communication
- [ ] Endpoint: `/v1/profiles/find-by-phone`
- [ ] Method: POST
- [ ] Payload: `{ numbers: string[] }`
- [ ] Uses HTTPS (secure connection)
- [ ] Includes authentication headers

### Consent Storage
- [ ] Stored in AsyncStorage
- [ ] Key: `@kindred_contact_consent`
- [ ] Contains: `hasConsent` (boolean | null) and `consentTimestamp` (number)
- [ ] Persists across app restarts
- [ ] Cleared on app uninstall

---

## 6. Edge Cases Testing

### Edge Case 1: Rapid Tapping
- [ ] Tap "Sync Contacts" multiple times rapidly
- [ ] **Verify:** Only one modal appears
- [ ] **Verify:** No duplicate requests

### Edge Case 2: App Backgrounding
- [ ] Open consent modal
- [ ] Background the app (home button)
- [ ] Return to app
- [ ] **Verify:** Modal still visible or properly dismissed
- [ ] **Verify:** No crashes

### Edge Case 3: Network Failure
- [ ] Enable airplane mode
- [ ] Grant consent and iOS permission
- [ ] **Verify:** Appropriate error message
- [ ] **Verify:** No crash
- [ ] Disable airplane mode
- [ ] Try again
- [ ] **Verify:** Works normally

### Edge Case 4: Large Contact List
- [ ] Device with 500+ contacts
- [ ] Grant consent and permission
- [ ] **Verify:** All phone numbers extracted
- [ ] **Verify:** Upload completes successfully
- [ ] **Verify:** No timeout or crash

---

## 7. Documentation Review

### For Apple Review Team
- [ ] `APPLE_REVIEW_RESPONSE.md` is complete and accurate
- [ ] `APP_STORE_CONTACT_CONSENT.md` explains technical implementation
- [ ] `CONTACT_CONSENT_USER_FLOW.md` shows user flows
- [ ] All documentation is clear and professional

### For Development Team
- [ ] Code is well-commented
- [ ] Hook usage is documented
- [ ] Component props are typed
- [ ] No console.logs in production code (or only appropriate ones)

---

## 8. Compliance Verification

### Apple Guideline 5.1.2 Checklist
- [ ] ✅ App clearly informs user that contacts will be uploaded to server
- [ ] ✅ App obtains explicit consent before uploading
- [ ] ✅ App states what will be done with the contacts
- [ ] ✅ User can decline without losing core functionality
- [ ] ✅ Consent decision is respected and persisted
- [ ] ✅ User can manage consent in settings

### Privacy Best Practices
- [ ] ✅ Minimal data collection (only phone numbers)
- [ ] ✅ Purpose-limited use (only for friend matching)
- [ ] ✅ Secure transmission (HTTPS)
- [ ] ✅ User control (settings page)
- [ ] ✅ Transparency (clear explanations)
- [ ] ✅ Privacy Policy reference

---

## 9. Pre-Build Checklist

### Before Creating Build
- [ ] All tests pass
- [ ] No linter errors
- [ ] No TypeScript errors
- [ ] No console warnings
- [ ] Build number incremented
- [ ] Version number updated (if needed)

### Build Configuration
- [ ] Info.plist has updated NSContactsUsageDescription
- [ ] app.json has updated NSContactsUsageDescription
- [ ] All new files included in build
- [ ] No dev dependencies in production build

---

## 10. Submission Preparation

### App Store Connect
- [ ] Build uploaded successfully
- [ ] Build passes all automated checks
- [ ] Screenshots updated (if needed)
- [ ] App description mentions friend-finding feature
- [ ] Privacy details updated in App Store Connect:
  - [ ] "Contact Info" selected in data types
  - [ ] Purpose: "App Functionality"
  - [ ] "Data is linked to user" if applicable
  - [ ] "Data is used to track user" - NO

### Review Notes
- [ ] Add note to reviewer explaining changes:
  - [ ] Reference to Guideline 5.1.2
  - [ ] Summary of changes made
  - [ ] How to test the consent flow
  - [ ] Confirmation that contacts are uploaded to server
  - [ ] Explanation of why (friend matching)

**Suggested Review Note:**
```
Dear Apple Review Team,

We have addressed the privacy concerns raised regarding Guideline 5.1.2 - Legal - Privacy - Data Use and Sharing.

Changes made:
1. Updated NSContactsUsageDescription to clearly state contacts will be uploaded to our server
2. Implemented consent modal that appears before any contact access
3. Modal explains exactly what data is collected and how it's used
4. User must explicitly tap "Allow" to grant consent
5. Added privacy controls in Settings page

To test:
1. Navigate to Search tab
2. Tap "Sync Contacts" button
3. Consent modal will appear with full explanation
4. Tap "Allow" to proceed or "Not Now" to decline

Purpose: Contact phone numbers are uploaded to our server to match with existing Kindred users, helping users find and connect with friends already on the platform.

Thank you for your review.
```

---

## 11. Final Verification

### Before Submitting
- [ ] All items in this checklist are checked
- [ ] App has been tested on real device (not just simulator)
- [ ] Tested on multiple iOS versions (if possible)
- [ ] Tested on different device sizes
- [ ] No crashes or major bugs
- [ ] Consent flow works perfectly
- [ ] Ready for review

### Submission
- [ ] Build submitted to App Store Connect
- [ ] Status: "Waiting for Review"
- [ ] Review notes added
- [ ] Contact information up to date

---

## 12. Post-Submission

### If Approved ✅
- [ ] Celebrate! 🎉
- [ ] Monitor for any user feedback about consent flow
- [ ] Track consent acceptance rate
- [ ] Monitor for any privacy-related support requests

### If Rejected ❌
- [ ] Read rejection reason carefully
- [ ] Review which requirement wasn't met
- [ ] Make necessary adjustments
- [ ] Re-test thoroughly
- [ ] Resubmit with explanation

---

## Quick Test Script

Run this quick test before submission:

```bash
# 1. Clean and rebuild
cd frontend
rm -rf node_modules
npm install  # or bun install
npx expo prebuild --clean

# 2. Check for errors
npx tsc --noEmit

# 3. Run linter
npx eslint .

# 4. Build for iOS
eas build --platform ios --profile production

# 5. Test on device
# - Install build on physical device
# - Run through all test scenarios above
```

---

## Contact Information

If you need help with any of these items:
- Review code changes in the repository
- Check documentation files for details
- Test on actual device before submission

**Good luck with your resubmission!** 🚀
