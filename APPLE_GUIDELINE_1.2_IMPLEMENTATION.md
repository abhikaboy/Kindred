# Apple Guideline 1.2 - User-Generated Content Safety Implementation

## Overview

This document summarizes the implementation to address Apple App Store Guideline 1.2 regarding user-generated content safety. The implementation includes Terms of Service acceptance, content reporting, user blocking, and content filtering.

## Implementation Summary

### ✅ 1. Terms of Service / EULA Acceptance

**Backend:**
- Added `terms_accepted_at` and `terms_version` fields to User schema
- Created `POST /v1/user/accept-terms` endpoint to record acceptance
- Service method in `auth/service.go` to update user terms acceptance

**Frontend:**
- Created `TermsAcceptanceModal.tsx` component with:
  - Clear statement about zero tolerance for objectionable content
  - Explicit prohibition of abusive behavior
  - Links to full Terms of Service and Privacy Policy
  - "I Agree" button (required to proceed)
  - Cannot be dismissed without accepting
- Added `acceptTerms()` API function in `api/auth.ts`

**Terms Content:**
- Zero tolerance for hate speech, harassment, discrimination
- Prohibition of explicit, violent, or offensive content
- No bullying, threats, or abusive behavior
- No spam or misleading information
- Content moderation rights
- Account suspension/termination for violations

### ✅ 2. Content Reporting System

**Backend:**
- Created new `report` handler package with:
  - `ReportDocument` type with fields for reporter, content type, content ID, reason, status
  - `POST /v1/user/reports/post/{postId}` - Report a post
  - `POST /v1/user/reports/comment/{commentId}` - Report a comment
  - `GET /v1/admin/reports` - List all reports (admin)
- Prevents duplicate reports (same user reporting same content)
- Logs all reports for admin notification
- Report reasons: inappropriate, spam, harassment, other

**Frontend:**
- Updated `PostCard.tsx` to connect report UI to backend
- Added `reportPost()` and `reportComment()` functions in `api/post.ts`
- Shows success toast after report submission
- Report options accessible via post menu ("...")

### ✅ 3. User Blocking System

**Backend:**
- Implemented blocking endpoints in `connection` handler:
  - `POST /v1/user/connections/block/{userId}` - Block a user
  - `DELETE /v1/user/connections/block/{userId}` - Unblock a user
  - `GET /v1/user/connections/blocked` - List blocked users
- Added `BlockerID` field to `ConnectionDocumentInternal` to track who blocked whom
- Service methods: `BlockUser()`, `UnblockUser()`, `GetBlockedUsers()`, `IsBlocked()`
- Blocking removes existing friend connections
- Prevents friend requests to/from blocked users

**Frontend:**
- Created `api/connection.ts` with `blockUser()`, `unblockUser()`, `getBlockedUsers()`
- Added "Block User" option to post options menu in `PostCard.tsx`
- Shows confirmation dialog before blocking
- Displays success toast after blocking
- Created `blocked-users.tsx` screen to manage blocked users
- Added "Blocked Users" link in Settings under "PRIVACY & DATA"

### ✅ 4. Content Filtering

**Backend:**
- Added `GetBlockedUserIDs()` method to retrieve all blocked user IDs
- Updated `GetFriendsPosts()` to filter out posts from blocked users
- Updated `CheckRelationship()` to deny access if users are blocked
- Blocking filters applied to:
  - Feed queries
  - User profile post queries
  - Comment queries (blocked users' comments hidden)

**Frontend:**
- Blocking a user immediately invalidates React Query caches
- Removes blocked user's content from feed instantly
- Blocked users cannot see each other's profiles or posts

### ✅ 5. Instant Content Removal

**Implementation:**
- When user blocks another user:
  - Backend filters prevent blocked user's content from appearing in queries
  - Frontend invalidates `posts` and `friendsPosts` query caches
  - Blocked user's posts and comments disappear immediately
- When content is reported:
  - Content remains visible to other users (until admin review)
  - Report stored in database with pending status
  - Admin notified via logs

## Files Created

### Backend
- `backend/internal/handlers/report/types.go` - Report types and schemas
- `backend/internal/handlers/report/service.go` - Report business logic
- `backend/internal/handlers/report/handler.go` - Report HTTP handlers
- `backend/internal/handlers/report/operations.go` - Report API operations
- `backend/internal/handlers/report/routes.go` - Report route registration

### Frontend
- `frontend/components/modals/TermsAcceptanceModal.tsx` - Terms acceptance UI
- `frontend/app/(logged-in)/(tabs)/(task)/blocked-users.tsx` - Blocked users management
- `frontend/api/connection.ts` - Connection/blocking API functions

## Files Modified

### Backend
- `backend/internal/handlers/types/types.go` - Added terms fields to User, added Report types
- `backend/internal/handlers/auth/operations.go` - Added AcceptTerms operation types
- `backend/internal/handlers/auth/auth.go` - Added AcceptTermsHuma handler
- `backend/internal/handlers/auth/service.go` - Added AcceptTerms service method
- `backend/internal/handlers/auth/routes.go` - Registered AcceptTerms operation
- `backend/internal/handlers/connection/types.go` - Added BlockerID and UpdatedAt fields
- `backend/internal/handlers/connection/connection.go` - Added block/unblock handlers
- `backend/internal/handlers/connection/operations.go` - Added block operation types and registrations
- `backend/internal/handlers/connection/service.go` - Added blocking service methods
- `backend/internal/handlers/post/service.go` - Added blocking filters and GetBlockedUserIDs
- `backend/internal/server/server.go` - Registered report routes

### Frontend
- `frontend/api/post.ts` - Added reportPost() and reportComment() functions
- `frontend/api/auth.ts` - Added acceptTerms() function
- `frontend/components/cards/PostCard.tsx` - Connected report to backend, added block option
- `frontend/app/(logged-in)/(tabs)/(task)/settings.tsx` - Added blocked users link

## Testing Checklist

- [x] Backend endpoints created and registered
- [x] Terms acceptance fields added to User schema
- [x] Report endpoints prevent duplicate reports
- [x] Blocking creates/updates relationship with blocked status
- [x] Blocked users filtered from feed queries
- [x] Frontend components created
- [x] API functions implemented
- [x] Report UI connected to backend
- [x] Block UI integrated with posts
- [x] Blocked users management screen created
- [x] Settings link to blocked users added

## Review Notes for Apple

When resubmitting to Apple, include:

```
We have addressed Guideline 1.2 - User-Generated Content Safety:

1. EULA/Terms Acceptance:
   - Users must accept Terms of Service before using the app
   - Terms explicitly prohibit objectionable content and abusive behavior
   - Zero tolerance policy clearly stated
   - Accessible at: Settings > Terms & Conditions

2. Content Reporting:
   - Users can report posts and comments via the "..." menu on each post
   - Report categories: Inappropriate content, Spam, Harassment, Other
   - Reports are stored in database and developer is notified via logs
   - Prevents duplicate reports from same user

3. User Blocking:
   - Users can block abusive users from post menus
   - Blocked users' content is instantly removed from feed
   - Blocked users cannot interact with the blocker
   - Manage blocked users in: Settings > Privacy & Data > Blocked Users
   - Unblock functionality available

4. Content Filtering:
   - Backend filters ensure blocked users' content never appears in feeds
   - Blocking relationship prevents profile access
   - Comments from blocked users are hidden
   - All changes take effect immediately

The app now has comprehensive moderation tools to prevent abusive behavior and protect users from objectionable content.
```

## API Endpoints

### Terms Acceptance
- `POST /v1/user/accept-terms` - Record terms acceptance

### Content Reporting
- `POST /v1/user/reports/post/{postId}` - Report a post
- `POST /v1/user/reports/comment/{commentId}` - Report a comment
- `GET /v1/admin/reports` - Get all reports (admin)

### User Blocking
- `POST /v1/user/connections/block/{userId}` - Block a user
- `DELETE /v1/user/connections/block/{userId}` - Unblock a user
- `GET /v1/user/connections/blocked` - Get blocked users list

## Next Steps

1. **Test the implementation:**
   - Create test accounts
   - Test terms acceptance flow
   - Test reporting posts and comments
   - Test blocking users and verify content removal
   - Test unblocking users
   - Verify blocked users management screen

2. **Deploy to production:**
   - Run database migrations if needed (terms fields are optional, so no migration required)
   - Deploy backend changes
   - Deploy frontend changes
   - Test in production environment

3. **Submit to Apple:**
   - Increment build number
   - Create new build
   - Upload to App Store Connect
   - Add review notes (see above)
   - Submit for review

4. **Monitor:**
   - Watch for reports in logs
   - Set up admin dashboard to review reports (future enhancement)
   - Monitor user feedback

## Future Enhancements

- Admin dashboard to review and manage reports
- Automated content moderation using AI/ML
- Appeal process for blocked users
- Report status updates (reviewed, resolved)
- Email notifications for admins when reports are submitted
- Terms version tracking and re-acceptance on updates
