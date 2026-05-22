# Kindred - Product Document

> "because doing it alone was never actually the plan"

Kindred is a social task management and productivity app that combines personal task organization with social accountability. Users manage tasks across workspaces, share accomplishments with friends, and use AI-powered natural language to create and manage tasks via voice or text.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native 0.83, Expo SDK 55, TypeScript 5.9 |
| Backend | Go 1.25, Fiber v2, Huma v2 (OpenAPI) |
| Database | MongoDB Atlas |
| AI | Google Genkit (Gemini) |
| Auth | JWT + Apple Sign-In + Google OAuth + Phone OTP |
| Storage | DigitalOcean Spaces (S3-compatible) |
| Analytics | PostHog |
| Errors | Sentry |
| Tracing | OpenTelemetry |
| Payments | RevenueCat (Apple IAP, Google Play) |
| Email | SendGrid |
| SMS | Sinch |
| Push | Firebase Cloud Messaging |
| Calendar | Google Calendar (OAuth + webhooks) |

---

## Sitemap & Navigation

```
Kindred App
│
├── Splash / Entry Router
│   ├── → Onboarding (first launch)
│   ├── → Login (returning, logged out)
│   └── → Home (authenticated)
│
├── Onboarding Flow
│   ├── Productivity Intro
│   ├── Welcome
│   ├── Phone Number
│   ├── Password
│   ├── Name & Handle
│   ├── Accomplishment Style
│   ├── Positivity / Mindset
│   ├── Interactive Tutorial (4-step core loop)
│   │   ├── Step 1: Create a category
│   │   ├── Step 2: Add a task
│   │   ├── Step 3: Complete your task (swipe right)
│   │   └── Step 4: Beak congratulation + welcome credits
│   ├── Calendar Integration
│   └── Circle / Friend Setup
│
├── Login
│   ├── Apple Sign-In
│   ├── Google Sign-In
│   └── Phone + OTP / Password
│
└── Main App (5 tabs)
    │
    ├── [Tab 1] Tasks (PencilSimple icon)
    │   ├── Home / Dashboard
    │   │   ├── Welcome header + greeting
    │   │   ├── Dashboard Stats (Open / Due Today / Done this week)
    │   │   │   └── Expandable detail view per stat
    │   │   ├── Jump Back In (quick-access action cards grid)
    │   │   │   └── Daily View, Voice, Calendar, Review, Text Dump, Analytics, Workspaces
    │   │   ├── Kudos summary (encouragements / congratulations)
    │   │   ├── Recent workspaces pager
    │   │   ├── Due today tasks
    │   │   ├── Recently Completed
    │   │   ├── Section visibility toggles (eye icon per section, persisted)
    │   │   └── Workspace selector (bottom sheet)
    │   ├── Today
    │   │   ├── Due Today
    │   │   ├── Scheduled for Today
    │   │   └── Window Tasks
    │   ├── Daily View
    │   │   ├── Calendar View (time-based grid)
    │   │   ├── List View (grouped sections)
    │   │   ├── Date pager navigation
    │   │   ├── Unscheduled / Overdue / Upcoming / Open
    │   │   └── Schedule task sheet (drag to schedule)
    │   ├── Task Detail (/task/[id])
    │   │   ├── Title, description, priority
    │   │   ├── Category assignment
    │   │   ├── Start date, deadline
    │   │   ├── Recurring configuration
    │   │   ├── Checklist items
    │   │   ├── Reminders
    │   │   ├── Notes
    │   │   └── Attachments
    │   ├── Review (Tinder-style cards)
    │   │   ├── Swipe right → complete
    │   │   ├── Swipe left → skip / postpone
    │   │   └── Swipe down → more info
    │   ├── Voice Input
    │   │   ├── Speech-to-text recording
    │   │   ├── AI task generation (credit-based)
    │   │   └── → Preview screen
    │   ├── Text Dump
    │   │   ├── Free-form text input
    │   │   ├── AI task generation (credit-based)
    │   │   └── → Preview screen
    │   ├── Preview (generated tasks)
    │   │   ├── Review AI-generated tasks
    │   │   ├── Edit before confirming
    │   │   └── Confirm to create
    │   ├── Analytics
    │   │   └── Activity statistics & completion trends
    │   ├── Completed Tasks
    │   │   └── History grouped by date (Today, Yesterday, etc.)
    │   ├── Kudos
    │   │   ├── Encouragements tab
    │   │   └── Congratulations tab
    │   ├── Undo Missed (/undo-missed/[id])
    │   │   └── Reschedule or complete missed tasks
    │   └── Workspace Management
    │       ├── Create / rename workspaces
    │       └── Category organization
    │
    ├── [Tab 2] Feed (SquaresFour icon)
    │   ├── Feed
    │   │   ├── Feed sources: All, Friends, Blueprint-specific
    │   │   ├── Post cards (images, captions, task context)
    │   │   ├── Emoji reactions
    │   │   ├── Comments
    │   │   ├── Swipe to hide/block
    │   │   └── Sort: newest / oldest
    │   ├── Follow Requests
    │   │   └── Accept / reject pending requests
    │   └── Notifications
    │       └── Real-time notification feed
    │
    ├── [Tab 3] Search (MagnifyingGlass icon)
    │   ├── Explore (browse blueprint categories)
    │   ├── Search Results (blueprints, profiles)
    │   ├── Contacts Tab
    │   │   ├── Phone contacts sync (with consent)
    │   │   ├── Matched contacts (existing Kindred users)
    │   │   └── Suggested users
    │   └── Friends Tab
    │       ├── Friends list
    │       └── Follow requests
    │
    ├── [Tab 4] Activity (Brain icon)
    │   ├── Activity insights & statistics
    │   └── Personal activity feed
    │
    ├── [Tab 5] Profile (User icon)
    │   ├── Profile View
    │   │   ├── Profile picture (parallax banner)
    │   │   ├── Productivity Rings card (Plan / Do / Share arcs)
    │   │   │   ├── ScoreArc gauge (0-100 productivity score)
    │   │   │   ├── Expandable ring detail with history dots
    │   │   │   ├── Claim reward button (when all rings closed)
    │   │   │   └── Blur overlay (private to user)
    │   │   ├── Friend Rings (on friend profiles, tap to encourage)
    │   │   ├── Stats: streak, productivity score
    │   │   ├── Weekly activity chart
    │   │   ├── Completed tasks gallery
    │   │   └── Tabs: Overview, Tasks, Blueprints, Referral
    │   ├── Edit Profile
    │   │   ├── Display name, handle, bio
    │   │   ├── Profile picture upload
    │   │   └── Visibility / privacy settings
    │   ├── Friends List
    │   ├── Blocked Users
    │   └── Settings
    │       ├── Notification preferences
    │       ├── Check-in frequency
    │       ├── Calendar integration (Google Calendar)
    │       ├── Content filtering
    │       ├── Subscription management
    │       ├── Delete account
    │       └── Store review prompt
    │
    ├── Posting Flow (modal)
    │   ├── Select task / accomplishment
    │   ├── Camera view
    │   ├── Caption editor
    │   ├── Group / collection selection
    │   └── Publish
    │
    ├── Blueprint Creation (modal, 3 steps)
    │   ├── Step 1: Name, tags, banner image
    │   ├── Step 2: Description, duration
    │   └── Step 3: Add categories & tasks
    │
    ├── Rewards / Kudos Rewards
    │
    └── Floating Action Button (FAB)
        ├── Create new task
        └── Context-sensitive actions
```

---

## Core Features

### 1. Task Management

Tasks are the core unit. Each task belongs to a **category**, which belongs to a **workspace**.

**Task properties:**
- Content (title/description)
- Priority (1-5 scale)
- Value (point worth)
- Start date and deadline
- Recurring configuration
- Checklist (sub-items with completion state)
- Reminders (time-based, with sound/vibration options)
- Notes (free-text)
- Active/inactive toggle
- Public/private visibility

**Task organization hierarchy:**
```
Workspace (e.g., "Personal", "Work")
└── Category (e.g., "Health", "Errands")
    └── Task (e.g., "Go for a run")
```

**Task actions:**
- Create (manual, voice, text dump, from blueprint)
- Edit (inline or detail view)
- Complete (single, bulk, or via review swipe)
- Double-tap task card to start working (triggers live activity)
- Long-press task card for context menu
- Delete (single or bulk, with undo)
- Reschedule (missed tasks)
- Reorder within category

### 2. Recurring Tasks

Recurring tasks use template-based generation with sophisticated scheduling:

**Recurrence modes:**
- **Occurrence** — happens at specific times
- **Deadline** — must be done by a date
- **Window** — flexible timeframe

**Recurrence frequency:**
- Daily, weekly, monthly
- Specific days of week/month
- Custom intervals (every N days/weeks/months)

**Behavior on miss:**
- **Buildup** — queue up missed instances
- **Rolling** — only count current period

**Flex tasks:** Target X completions per day/week/month with cooldown periods

**Template analytics:** Each template tracks streak, highest streak, times generated/completed/missed, completion dates.

### 3. AI-Powered Task Creation

Uses Google Genkit (Gemini) with streaming SSE responses.

**Flows:**

| Flow | Input | Output | Purpose |
|------|-------|--------|---------|
| IntentRouter | Text | Intent classification | Routes to correct action |
| MultiTaskFromText | Text + user context | Categories + tasks | Create tasks from voice/text |
| QueryTasks | Natural language query | Filter parameters | Search tasks conversationally |
| EditTasks | Task ID + description | Updated fields | Edit tasks with natural language |
| AnalyticsReport | User ID | Insights report | AI-generated productivity analysis |
| GenerateBlueprint | Description | Blueprint template | Create shareable templates |
| TaskFromImage | Image | Categories + tasks | Extract tasks from photos |

**AI Tools** (callable by Gemini during flows):
- `getUserCategories` — fetches existing workspace structure for context
- `getUserActiveTasks` — fetches active tasks for query/edit context
- `getCompletedTasks` — fetches history for analytics
- `fetchUnsplashImage` — banner images for blueprints

**Text normalization** applied by AI:
- Fix capitalization to sentence case
- Remove filler words (um, uh, like, basically)
- Split compound sentences into separate tasks
- Infer deadlines/priorities from context
- Default priority to 2 when no urgency cue

**Credits:** AI features consume credits (naturalLanguage type). Users have limited credits that regenerate based on subscription tier.

### 4. Review Mode

Tinder-style card swiping interface for rapid task triage:
- **Swipe right** → mark complete
- **Swipe left** → skip / postpone
- **Swipe down** → expand for more info
- Visual progress indicators during swipe
- Haptic feedback on actions

### 5. Daily Planner

Calendar-style day view with two modes:
- **Calendar View** — time-based grid, drag to schedule
- **List View** — grouped sections (unscheduled, overdue, upcoming, open)

Date pager for navigating between days. Floating date navigator for quick jumps.

### 6. Interactive Onboarding Tutorial

A 4-step guided walkthrough that teaches the core loop (plan → do → share → celebrate):

1. **Create a category** — user creates a category in a prefilled "Example Workspace"
2. **Add a task** — tap the category to create a task ("Finish Kindred Onboarding" prefilled)
3. **Complete your task** — swipe right to mark done (confetti + haptics)
4. **Celebrate** — Beak (founder system account) sends two congratulation messages via typewriter animation:
   - Welcome message
   - Welcome credits gift (5 voice + 5 analytics credits, one-time grant with atomicity flag)

The tutorial sits between the Welcome screen and Calendar Integration in the onboarding flow. Gesture navigation is disabled to prevent skipping.

**Post-onboarding SpotlightTour:** After onboarding, optional feature-discovery tooltips guide users through the main app (home, menu, workspace, task spotlights). Persisted per-user, skippable.

### 7. Google Calendar Integration

Full two-way sync with Google Calendar:
- OAuth 2.0 connection flow
- Real-time push notifications via webhook watch channels
- Watch channel auto-renewal every 6 hours (background cron)
- Tasks linked to calendar events via `integration` field (`gcal:{connectionId}:{calendarId}`)
- Calendar events appear in daily planner

---

## Social Features

### 7. Social Feed

Instagram/Twitter-style feed of friend activity:
- Post cards with images, captions, task context
- Multiple feed sources: All, Friends, Blueprint-specific
- Emoji reactions (map of emoji → user IDs)
- Nested comments
- Swipeable actions (hide/block)
- Pull-to-refresh, infinite scroll pagination

### 8. Posting

Share accomplishments with photos:
- Camera integration
- Caption editor
- Group/collection targeting
- Associated task/blueprint context

### 9. Connections (Friends)

- Send/accept/reject friend requests
- Block/unblock users
- Find friends via phone contacts (with consent modal)
- Suggested users algorithm
- Profile search with autocomplete

### 10. Kudos System

Two types of social encouragement:
- **Encouragements** — proactive support ("you got this!")
- **Congratulations** — celebrate completions ("nice work!")

Both trigger push notifications. Tracked with per-user reward counters. Progress tracking with max kudos limits.

### 11. Groups

User-created groups for organizing social sharing:
- Create groups with members
- Target posts to specific groups
- Group-based feed filtering

---

## Blueprints

Shareable task templates that other users can subscribe to:

**Blueprint structure:**
- Name, description, tags
- Banner image (auto-generated from Unsplash)
- Duration estimate
- Categories with pre-defined tasks
- Usage analytics (subscribers, completions)

**Blueprint discovery:**
- Browse by category on Search tab
- Search with autocomplete
- Public/private visibility toggle

**Blueprint usage:**
- Subscribe to blueprint → tasks generated into your workspaces
- Track completion against blueprint structure

---

## Gamification & Motivation

### Productivity Rings

Three daily activity rings (inspired by Apple Watch) that track the core loop:

| Ring | Target | Incremented By |
|------|--------|----------------|
| **Plan** | 2/day | Creating or scheduling a task |
| **Do** | 3/day | Completing a task (single or bulk) |
| **Share** | 1/day | Creating a post, sending encouragement, or sending congratulation |

**Productivity Score (0-100):**
```
score = 50 (base) + ringBonus + streakBonus (capped at 100)

ringBonus = (closedRings in last 7 days / 21) × 50
streakBonus = min(currentStreak, 7)
```
Scores below 30 display as "--".

**Ring Rewards:**
When all three rings close for a day, the user can claim a random credit reward:

| Reward | Weight |
|--------|--------|
| 1 voice credit | 40% |
| 1 naturalLanguage credit | 40% |
| 1 analytics credit | 15% |
| 2 voice credits | 5% |

Claiming opens a `RewardUnboxingModal` with slot-roulette animation.

**Friend Rings:**
- View friends' ring progress on their profile
- Tap an incomplete ring to send a ring-specific encouragement
- When all rings close, friends receive a push notification

**Ring State:**
- Per-user, per-day record (midnight in user's timezone)
- 30-day TTL (auto-expired via MongoDB TTL index)
- Unique constraint: one ring state per user per day

### Streaks
- Daily activity tracking
- Streak counter with eligibility rules
- Streak display on profile

### Activity Analytics
- Monthly/yearly activity summaries
- Weekly activity charts on profile
- Completion trends
- AI-generated productivity insights (credit-based)

### Rewards
- Ring reward claiming (daily, when all rings closed)
- Kudos rewards tracking
- Credit balances

---

## Monetization

### Subscription Tiers

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | Basic task management, limited AI credits |
| Basic | $4.99/mo | More credits, extended features |
| Premium | $9.99/mo | Unlimited features, analytics access |
| Lifetime | One-time | Permanent premium access |

**Providers:** Apple IAP, Google Play, Stripe, Promotional codes

**Status lifecycle:** trial → active → canceled → expired

### Credits System

5 credit types consumed by AI features:
- `voice` — voice input processing
- `blueprint` — blueprint generation
- `group` — group features
- `analytics` — AI analytics reports
- `naturalLanguage` — text/voice task creation, queries, edits

Credits regenerate based on subscription tier. Consumed before AI operations, refunded on failure.

### Referral Program

- Generate referral links
- Track referral redemptions
- Reward referrers

---

## Data Model

### Core Entities

```
User
├── email, phone, password
├── apple_id, google_id (social login)
├── display_name, handle, profile_picture
├── streak, streak_eligible, points, posts_made
├── productivity_score, last_reward_date
├── welcome_credits_granted (one-time flag)
├── credits {voice, blueprint, group, analytics, naturalLanguage}
├── kudos_rewards {encouragements_sent, congratulations_sent}
├── subscription {tier, status, start, end, renewal, provider}
├── settings {notifications, display, dashboard_configuration}
├── timezone, push_token
└── terms_accepted_at

Workspace
├── name, icon, color
└── belongs_to → User

Category
├── name, workspace_name
├── is_blueprint, blueprint_id
├── integration (calendar link)
├── tasks[] (embedded task array)
└── belongs_to → User

Task (embedded in Category)
├── priority, content, value
├── active, public, recurring
├── start_date, deadline, timestamp
├── recur_details {every, days_of_week, behavior, flex}
├── checklist[] {content, completed, order}
├── reminders[] {trigger_time, type, sent, messages}
├── notes, blueprint_id, integration
└── template_id (if generated from recurring)

TemplateTask (recurring task template)
├── user_id, category_id
├── priority, content, value
├── recur_details
├── analytics {times_generated, completed, missed, streak}
└── flex_state

CompletedTask (archived)
├── (same fields as Task)
├── time_completed
└── time_taken

Post
├── images[], caption, size
├── category, task, blueprint (references)
├── groups[]
├── reactions {emoji → [user_ids]}
└── comments[] {user, content, parent_id}

Connection (friendship)
├── requester_id → User
├── receiver_id → User
└── status (pending, accepted, blocked)

Blueprint
├── name, description, tags, banner
├── duration, categories with tasks
├── public/private
└── usage analytics

CalendarConnection
├── provider (google/outlook/apple)
├── access_token, refresh_token, token_expiry
├── watch_channels[] {channel_id, resource_id, expiration}
└── is_primary, setup_complete

Activity (per user/month)
├── year, month
└── daily activity counts

RingState (per user/day, 30-day TTL)
├── user_id → User
├── date (midnight in user's timezone)
├── plan {current, target, closed}
├── do {current, target, closed}
├── share {current, target, closed}
├── all_closed
├── reward_claimed, reward_type, reward_amount
└── created_at, updated_at

Encouragement / Congratulation
├── sender → User
├── receiver → User
└── post_id (optional trigger)

Notification
├── user, type, content
├── read status
└── url (deep link)

Group
├── name, members[]
└── owner → User
```

### Entity Relationships

```
User (1) ──< (M) Workspaces
User (1) ──< (M) Categories
User (1) ──< (M) TemplateTasks
User (1) ──< (M) CompletedTasks
User (1) ──< (M) Posts
User (1) ──< (M) Groups
User (1) ──< (M) CalendarConnections
User (1) ──< (M) Notifications

Category (1) ──< (M) Tasks (embedded)
TemplateTask (1) ──< (M) Tasks (generated instances)
User (1) ──< (M) RingStates (one per day)

Post (1) ──< (M) Comments (embedded)
Post (M) ──< (M) Reactions
Post (M) ──< (M) Groups

Connection: User ──── User (bidirectional)
Encouragement: User → User
Congratulation: User → User
```

---

## API Endpoints

### Authentication (`/v1/auth/`)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/login` | Email/password login |
| POST | `/login-phone` | Phone login |
| POST | `/login-apple` | Apple Sign-In |
| POST | `/login-google` | Google Sign-In |
| POST | `/register` | Email/password signup |
| POST | `/register-apple` | Apple registration |
| POST | `/register-google` | Google registration |
| POST | `/login-token` | Token-based login |
| POST | `/send-otp` | Send OTP to phone |
| POST | `/verify-otp` | Verify OTP code |
| POST | `/login-otp` | Login with OTP |
| POST | `/logout` | Invalidate token |
| POST | `/update-push-token` | Update device push token |
| POST | `/accept-terms` | Accept terms & conditions |
| DELETE | `/delete-account` | Delete user account |

### Tasks (`/v1/user/tasks/`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Get user's tasks |
| POST | `/{category}` | Create task in category |
| GET | `/{id}` | Get task by ID |
| PATCH | `/{category}/{id}` | Update task |
| POST | `/complete/{category}/{id}` | Mark task complete |
| DELETE | `/{category}/{id}` | Delete task |
| POST | `/bulk/complete` | Bulk complete |
| POST | `/bulk/delete` | Bulk delete |
| POST | `/active/{category}/{id}` | Toggle active state |
| GET | `/active/{id}` | Get all active tasks |
| POST | `/{category}/{id}/notes` | Update notes |
| POST | `/{category}/{id}/checklist` | Update checklist |
| PATCH | `/category/{category}/task/{id}/deadline` | Update deadline |
| PATCH | `/category/{category}/task/{id}/priority` | Update priority |
| PATCH | `/category/{category}/task/{id}/value` | Update value |
| PATCH | `/category/{category}/task/{id}/content` | Update content |
| PATCH | `/category/{category}/task/{id}/recurring` | Update recurring config |
| PATCH | `/{category}/{id}/reminder` | Update reminders |
| POST | `/template/{templateId}/generate` | Generate from template |

### Natural Language (SSE Streaming)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/tasks/natural-language/intent/stream` | Intent classification |
| POST | `/tasks/natural-language/stream` | Create tasks from text/voice |
| POST | `/tasks/natural-language/query/stream` | Query tasks with NL |
| POST | `/tasks/natural-language/edit/stream` | Edit tasks with NL |

### Categories (`/v1/user/categories/`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Get all categories |
| POST | `/` | Create category |
| GET | `/{id}` | Get category |
| PATCH | `/{id}` | Update category |
| DELETE | `/{id}` | Delete category |
| GET | `/workspace/{workspace}` | Get by workspace |
| POST | `/{id}/tasks` | Get tasks (paginated) |
| PATCH | `/{id}/reorder` | Reorder tasks |
| PATCH | `/category/{id}/workspace` | Change workspace |
| PATCH | `/{id}/public` | Toggle public |

### Profiles (`/v1/profiles/`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Get all profiles |
| GET | `/{id}` | Get profile |
| PATCH | `/{id}` | Update profile |
| GET | `/email/{email}` | Find by email |
| GET | `/phone/{phone}` | Find by phone |
| GET | `/search` | Search profiles |
| GET | `/autocomplete` | Autocomplete search |
| GET | `/suggested` | Suggested users |
| POST | `/find-by-phone` | Bulk find by phone numbers |

### Connections (`/v1/connections/`)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/` | Send friend request |
| GET | `/` | Get all connections |
| GET | `/receiver` | Requests received |
| GET | `/requester` | Requests sent |
| POST | `/{id}/accept` | Accept request |
| DELETE | `/{id}` | Delete/reject |
| POST | `/block/{userId}` | Block user |
| DELETE | `/block/{userId}` | Unblock user |
| GET | `/blocked` | Get blocked list |

### Posts (`/v1/user/posts/`)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/` | Create post |
| GET | `/` | Get feed |
| GET | `/{id}` | Get post |
| PATCH | `/{id}` | Update post |
| DELETE | `/{id}` | Delete post |
| POST | `/{id}/reactions` | Add reaction |
| DELETE | `/{id}/reactions/{emoji}` | Remove reaction |
| POST | `/{id}/comments` | Add comment |
| PATCH | `/comments/{commentId}` | Update comment |
| DELETE | `/comments/{commentId}` | Delete comment |

### Rings (`/v1/user/rings/`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/today` | Today's ring state, productivity score, streak, reward availability |
| GET | `/history?days=N` | Ring history for last N days (max 30, default 7) |
| POST | `/reward` | Claim daily reward (requires all rings closed) |

### Congratulations — Beak (`/v1/user/congratulations/`)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/beak` | Send beak congratulation (with optional `grantCredits` for welcome credits) |

### Other Endpoints
| Group | Prefix | Purpose |
|-------|--------|---------|
| Calendar | `/v1/calendar/` | Google Calendar OAuth, sync, webhooks |
| Encouragements | `/v1/encouragements/` | Send/receive encouragements |
| Congratulations | `/v1/congratulations/` | Send/receive congratulations |
| Activity | `/v1/activity/` | Activity summaries (monthly/yearly) |
| Notifications | `/v1/notifications/` | Push notification management |
| Settings | `/v1/user/settings/` | Notification & display preferences |
| Groups | `/v1/groups/` | Group CRUD & member management |
| Blueprints | `/v1/user/blueprints/` | Blueprint CRUD |
| Referrals | `/v1/referrals/` | Referral links & redemption |
| Rewards | `/v1/rewards/` | Reward claiming & balances |
| Subscription | `/v1/subscription/` | Status, cancel, webhooks (Stripe/Apple) |
| Spaces | `/v1/spaces/` | File upload (presigned URLs) |
| Waitlist | `/v1/waitlist/` | Pre-launch waitlist |
| Health | `/health` | Server health check |

---

## iOS Widgets

| Widget | Size | Content |
|--------|------|---------|
| TodayTasksWidget | Small / Medium / Large | Today's tasks summary |
| WorkspaceSnapshotWidget | Small / Medium | Quick workspace overview |
| ActivityStreakWidget | Small / Medium | Current streak display |
| LockScreenCircularWidget | Lock Screen | Progress ring |
| LockScreenRectangularWidget | Lock Screen | Next due task |
| LockScreenInlineWidget | Lock Screen | Streak info |

---

## iOS Live Activities

Real-time Lock Screen and Dynamic Island displays for active tasks (iOS 16.1+).

### Active Task Activity
Shown when a task is currently being worked on:
- "ACTIVE" status badge with green indicator
- Elapsed time countdown timer
- Task name and workspace
- CTA buttons: **Mark Complete** (deep link with `?action=complete`) and **Open Task**
- Keep-alive: updates every 5 minutes to prevent iOS staleness

### Deadline Countdown Activity
Shown when a task deadline is within ~1 hour:
- Dynamic countdown timer to deadline
- Task name, workspace, and priority
- Depleting progress bar
- Color escalation: purple (>10 min) → orange (≤10 min) → gray (overdue)
- Status label: "Due Soon" → "Overdue"
- CTA buttons: **Complete** and **Open**
- Keep-alive: updates every 1 minute for color escalation, auto-dismisses 30 min after deadline

### Trigger Mechanism
- Backend cron finds tasks with upcoming start times (every 2 min) or approaching deadlines (every hour)
- Sends push notification with `type: "live_activity"` data payload
- Frontend receives notification and starts the appropriate Live Activity

---

## Push Notifications

Delivered via Firebase Cloud Messaging. Types include:
- Friend activity notifications
- Deadline reminders
- Encouragement/congratulation received
- Ring encouragement (friend taps your incomplete ring)
- All rings closed (sent to user + friends)
- Follow request received
- Comment/reaction on posts
- Live activity triggers (start time reached, deadline approaching)

Notification tap deep-links to relevant screen via URL routing.

---

## Authentication Flow

```
App Launch
├── Has token? → Validate → Home
├── Has seen onboarding? → Login screen
└── First launch → Onboarding flow
    └── Complete → Login/Register
        ├── Apple Sign-In
        ├── Google Sign-In
        └── Phone + OTP
            └── → JWT access + refresh tokens
                └── Stored in Secure Store
                    └── → Home
```

**Token management:**
- Access token: short-lived, sent as Bearer token
- Refresh token: long-lived, stored in DB and device
- Auto-refresh with mutex for concurrent requests (60s expiry buffer)
- 401 response triggers auto-logout

---

## Frontend State Management

| Context | Purpose |
|---------|---------|
| AuthContext | User auth state, login/logout mutations |
| TasksContext | Workspaces, categories, tasks with memoized filters |
| TaskCreationContext | Form state for creating/editing tasks |
| BlueprintContext | Blueprint creation form state |
| DrawerContext | Side drawer open/close state |
| FocusModeContext | Toggle to hide social tabs |
| SpotlightContext | Tutorial tooltip tracking |
| KudosContext | Encouragements & congratulations data |
| SelectedGroupContext | Active group for social features |
| CreateModalContext | Global task creation modal visibility |
| AlertContext | Global alert/dialog management |

**Caching:** TanStack React Query with 5-minute stale time, 10-minute GC, cache-first strategy with manual invalidation.

---

## Design System

**Colors:**
- Primary: `#854DFF` (purple)
- Success: `#1CF954` / `#5CFF95`
- Error: `#FF5C5F`
- Light background: white
- Dark background: `#13121F`

**Fonts:**
- **Fraunces** (500-600 weight, no italic): headings and display text
- **Outfit**: all functional UI text
- **Sofia Sans**: alternative sans-serif

**Animations:**
- Reanimated v4 for worklet-based animations
- React Spring for physics-based springs
- Moti for entrance animations
- Haptic feedback on tab selection and task actions

---

## Background Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| Calendar Watch Renewal | Every 6 hours + startup | Renew Google Calendar push subscription channels expiring within 3 days |
| Start Time Notifications | Every 2 minutes | Find tasks with start times in the past 2 min, send live activity push |
| Deadline Approaching Notifications | Every hour | Find tasks with deadlines in 59-61 min window, send live activity push |
| Ring Closure Notification | On ring close (2-min delay) | Notify user + friends when all three rings close for the day |

---

## Key User Flows

### Creating a Task (Manual)
1. Tap FAB → Create Modal opens
2. Enter task content, set priority, category
3. Optionally set start date, deadline, recurring rules
4. Save → task appears in category

### Creating Tasks (Voice)
1. Navigate to Voice screen
2. Tap to record → speech-to-text transcription
3. AI processes transcript → generates structured tasks with categories
4. Preview screen → edit/confirm
5. Tasks created in workspaces (1 naturalLanguage credit consumed)

### Creating Tasks (Text Dump)
1. Navigate to Text Dump screen
2. Type or paste free-form text
3. AI processes → generates structured tasks
4. Preview → confirm (1 naturalLanguage credit consumed)

### Completing Tasks (Review Mode)
1. Navigate to Review screen
2. Card deck of pending tasks appears
3. Swipe right to complete, left to skip
4. Visual feedback + haptic confirmation
5. Completed tasks archived with timestamp

### Social Posting
1. Complete a task
2. Navigate to Posting flow
3. Take/select photo
4. Add caption
5. Choose groups to share with
6. Publish → appears in friends' feeds

### Sending Kudos
1. View friend's profile or post
2. Send encouragement ("you got this!") or congratulation ("nice work!")
3. Push notification sent to recipient
4. Tracked in kudos rewards counters

### Calendar Sync
1. Settings → Calendar Integration
2. Google OAuth consent flow
3. Calendar events sync to Kindred tasks
4. Real-time updates via webhook push notifications
5. Watch channels auto-renewed every 6 hours

---

## Platform Permissions (iOS)

| Permission | Usage |
|------------|-------|
| Camera | Photos for posts and profile pictures |
| Microphone | Voice input for task creation |
| Speech Recognition | Voice-to-text transcription |
| Contacts | Find friends from phone contacts |
| Photo Library | Select images for posts |
| Notifications | Push notifications |
| Calendar | Google Calendar integration |
| Location | Nearby context (addresses) |
