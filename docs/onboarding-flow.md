# Kindred Onboarding Flow

A hand-off reference for the first-run experience: every route, what the user sees, what state is written, and where the code lives. Derived from the code at `main` (HEAD `78827c78`). Copy is quoted verbatim from the source.

**Screenshots:** captured from the iOS simulator, in `docs/onboarding-flow/`. Captured: phone, name, password, welcome, calendar. **Not captured:** login (redirects signed-in users to Home) and the guided tutorial (same redirect, so the tutorial's guest-only steps are documented from code only). See [Capturing screenshots](#capturing-screenshots).

---

## 1. Summary

Kindred has two first-run paths, decided at cold start by `frontend/app/index.tsx`:

| Path | Who | Entry | Ends at |
|---|---|---|---|
| **A. Guest** (default) | Fresh install, never signed in on this device | Silent guest session, no login screen | Guest tutorial → Home (task tab) |
| **B. Account signup** | User taps "Join Kindred" on `/login` | Phone / Apple / Google / email sign-up sheet | Name → (Password) → Welcome → Tutorial → Calendar → Home |

Returning users who are logged out land on `/login`. Returning users with a stored session go straight to Home (or to the guest tutorial if unfinished).

---

## 2. Route map

Routes live in `frontend/app/`. The `(onboarding)` group is a `Stack` with `headerShown: false`, slide-from-right animation, white content background (`app/(onboarding)/_layout.tsx`). The tutorial sets `gestureEnabled: false`, and its `BackHandler` swallows Android back, so Skip is the only exit mid-tutorial.

```
/ (index.tsx: splash + routing decision)
├── /login            (landing: "Join Kindred" / "Log in")
│   └── OnboardModal  (bottom sheet: register or login)
│       ├── /(onboarding)/phone      ← "Continue with Phone" (signup)
│       ├── Apple / Google sign-in   → register directly, skip name+password screens
│       └── /(onboarding)/name       ← only when a new phone/social account needs a profile
│           └── /(onboarding)/password  (email/password signup only)
├── /(onboarding)/welcome     "Welcome! You've joined the kindred family"
├── /(onboarding)/tutorial    guided demo of first task + share
├── /(onboarding)/calendar    "Connect your calendar"
└── /(logged-in)/(tabs)/(task)   Home
```

Guest entry skips `/login` entirely and opens `/(onboarding)/tutorial` directly.

---

## 3. Cold-start routing (`app/index.tsx`, `utils/guestEntry.ts`)

Decision order, evaluated once per launch:

1. `maybeForceFirstLaunch()` (dev reset hook, `utils/resetFirstLaunch.ts`).
2. **User already in context** → guest: `routeForGuest(id)`; otherwise Home.
3. **Stored tokens exist** → read cached user.
   - Guest → `routeForGuest`.
   - Real user → Home. The logged-in layout verifies the session.
   - Tutorial routes sit outside the logged-in layout, so for a guest the index verifies with `fetchAuthData()` before routing.
   - `authenticated` → route per user; `unverified-offline` → keep the cached route; rejected → fall through to signed-out.
4. **Never signed in on this device** (`getHasEverSignedIn()` false) → `enterAsNewGuest()` creates a guest session and calls `routeForGuest`. If guest creation fails (offline, 5xx), fall back to `/login`.
5. **Otherwise** → `/login`.
6. Any thrown error → `/login`.

`routeForGuest(userId)` reads AsyncStorage key `guestTutorialDoneKey(userId)`. `"true"` means Home, anything else means the guest tutorial. The key lives in `constants/authStorageKeys`.

While this runs, the screen shows `EnhancedSplashScreen`.

---

## 4. Landing (`app/login.tsx`)

Headline and CTA copy:

- Hero: `AuthHeroCard` with `onboardinghero.png` below it.
- Primary button: **"Create my Account"** → opens `OnboardModal` in `register` mode.
- Secondary text: **"Already have an account?"** → opens the sheet in `login` mode.
- Guests reach this screen from Home's "Log in" link with `?mode=login`, and the sheet opens automatically after 300 ms.
- If a guest signs in with a real account on this screen, it pushes to `/`.

The e2e flow `frontend/e2e/flows/01_landing.yaml` asserts "human centered productivity", "Join Kindred", and "Log in". Those strings are the intended landing copy, but I did not confirm them against `AuthHeroCard` in this pass.

---

## 5. Signup sheet (`components/modals/OnboardModal.tsx`)

Modal with title and provider options. Mode switches between `register` and `login`.

| Option | Register label | Login label | Behavior |
|---|---|---|---|
| Phone | **Continue with Phone** | same | Register → `/(onboarding)/phone`. Login → `/login-phone` |
| Apple | **Continue with Apple** | **Sign in with Apple** | `AppleAuthentication.signInAsync` with FULL_NAME + EMAIL scopes. Register path carries `appleId` into `OnboardingProvider` and routes to `/(onboarding)/name` |
| Google | **Continue with Google** | **Sign in with Google** | `useGoogleAuth`. Same register-vs-login split, with `googleId` stored |
| Email | (not in the sheet) | | Email/password signup is reached from `name` → `password` |

Login-mode Apple and Google sign-in push straight to `/(logged-in)/(tabs)/(task)`. Login-mode phone goes to `/login-phone`, a separate screen (not the onboarding phone screen).

---

## 6. Phone verification (`app/(onboarding)/phone.tsx`)

This is the entry screen for signup via phone, and step 1 of the progress bar.

**Phase A: enter number**
- Title: **"What's your phone number?"**. Subtitle: **"We'll send you a verification code"**.
- Country picker (`react-native-country-codes-picker`, default `+1`).
- Input placeholder: `(555) 123-4567`. US numbers auto-format to `(XXX) XXX-XXXX`.
- Hint under the field: **"Standard messaging rates may apply"**.
- Screenshot: `docs/onboarding-flow/01-phone.png`
- Button: **Send Code**. Enabled when ≥ 10 digits. Shows "Sending code..." while in flight.
- Legal links below the button open the Notion Terms of Service and Privacy Policy.

**Phase B: verify** (animated transition; phase A slides up and fades out, phase B slides in)
- 4-digit OTP (`react-native-otp-entry`).
- Button: **Verify**. Enabled at 4 digits.
- Resend countdown starts at 30 s. Resend is only enabled after it reaches 0.
- Changing the number resets the timer and the code.
- A wrong code shakes the input (±10 px, 50 ms steps).
- Toast on success: **"Phone number verified"**.

**API:** `POST /v1/auth/send-otp` and `POST /v1/auth/verify-otp` (via `hooks/useVerification.tsx`).

**After verification:** the screen tries `loginWithOTP(phone, code)` (`POST /v1/auth/login/otp`).
- Success → the account already exists. `router.replace("/")`, which means the user is signed in and skips signup.
- `ACCOUNT_NOT_FOUND` → new user. Continues to `/(onboarding)/name`.
- Any other error → also continues to `/(onboarding)/name`, after logging.

---

## 7. Name and handle (`app/(onboarding)/name.tsx`)

- Progress: step 3 of 5 (or 3 of 4 for social auth, which skips phone verification).
- Title: **"Introduce yourself"** (Fraunces).
- Field 1: label **Name**, placeholder `Enter your name`, max 50 chars, autofocus.
- Field 2: label **Handle**, prefix `@`, placeholder `kindred_handle`, max 29 chars, no autocap or autocorrect. A typed `@` is stripped.
- Button: **Continue** (shows "Creating account..." while loading). Disabled until name ≥ 2 chars and handle ≥ 1 char.
- Name and Handle show red asterisks (required).
- Screenshot: `docs/onboarding-flow/02-name.png`

Validation (`hooks/useOnboarding.tsx`):
- Name: 2–50 chars. Errors: "Display name is required", "Display name must be at least 2 characters", "Display name must be less than 50 characters".
- Handle: letters, digits, `_`, `-`, total length 2–30 including the `@`. Errors: "Handle is required", "Handle can only contain letters, numbers, underscores, and hyphens".

Routing from here:
- **Social auth (Apple or Google):** calls `registerWithApple` / `registerWithGoogle` with a default avatar, toasts "Account created successfully", then `router.replace("/(onboarding)/welcome")`. Password is skipped.
- **Email / phone:** pushes to `/(onboarding)/password`.

---

## 8. Password (`app/(onboarding)/password.tsx`)

- Progress: step 4 of 5.
- Title: **"Create a password"**.
- Field 1: label **Password**, placeholder `Enter password`. Helper text while typing, under 8 chars: "N more character(s) needed".
- Field 2: label **Confirm Password**, placeholder `Confirm password`. Error after submit if mismatched: "Passwords do not match".
- Button: **Continue** → `registerWithEmail(defaultAvatar)`. Min 8 chars for the password.
- On success: toast "Account created successfully", then `router.replace("/(onboarding)/welcome")`.
- On failure: toast with the server message, or "Unable to create account. Please try again."

**API:** `POST /v1/auth/register`. Google, Apple: `/v1/auth/register/google`, `/v1/auth/register/apple`.

- Screenshot: `docs/onboarding-flow/03-password.png`

Note: `DEFAULT_PICTURE` is a hard-coded external Pinterest URL. The user doesn't choose an avatar during onboarding.

---

## 9. Welcome (`app/(onboarding)/welcome.tsx`)

- Progress: last step (4 of 4 for social, 5 of 5 otherwise).
- Decorative SVG shapes fade in with a slide-up.
- Copy: **"Welcome!"** (Fraunces 24), then **"You've joined the kindred family"** with "kindred" in purple `#854dff`.
- Single button **Next** (`testID="onboard-next-btn"`) → `router.push("/(onboarding)/tutorial")`. The button fades in after about 1.2 s.
- Screenshot: `docs/onboarding-flow/04-welcome.png`

---

## 10. Guided tutorial (`app/(onboarding)/tutorial.tsx`)

This is the core "aha" moment. It's a scripted run through real components, using the demo workspace **"(Not Real) Workspace"**. It's labeled "Demo" on every step so example tasks don't read as the user's own.

Steps (`STEP_*` constants):

| Idx | Constant | Prompt title | Subtitle | What happens |
|---|---|---|---|---|
| 0 | `STEP_CATEGORY` | **Create a workspace** → **Create a category** | "A workspace holds one part of your life, like work, school, or home" → "Categories group related tasks inside a workspace" | Taps "Create workspace", then creates category prefilled **"My Tasks"** |
| 1 | `STEP_TASK` | **Add a task** | "Tap the category to create one" | Animated cursor taps the category; create modal prefilled **"Go for a 15-minute walk"** |
| 2 | `STEP_COMPLETE` | **Complete your task** | "Swipe right to mark it done" | Cursor demonstrates swipe-right every 3 s; user swipes to complete |
| 3 | `STEP_RINGS` | (rings explainer) | Plan / Do / Share ring cards | Explains the three rings (see below) |
| 4 | `STEP_SHARE` | (share sheet) | | Account users only: share a post with a photo, caption preview |
| 5 | `STEP_CONGRATS` | (feed) | | Account users only: receives a congrats message from **beak** (a founder, "Kindred HQ") with a GIF, then a sample kudos exchange |

Progress UI: `OnboardingProgressBar` plus `PhaseProgress` labels "Do your first task · Step N of 4 · Demo" (guests) or "Do your first task" / "Share it" (accounts).

**The rings explainer (step 3):**

| Ring | Goal | Progress copy |
|---|---|---|
| Plan | "Put 2 tasks on today's list" | "Your walk counts as 1 of 2." |
| Do | "Finish 3 tasks" | "Swiping your walk done made it 1 of 3." |
| Share | "Post a win or send a friend kudos" | "Still open. You'll close it next." |

**Guest vs. account divergence:**
- **Guests stop at step 3.** The only button is **Continue** → `handleGuestFinish`. That writes `guestTutorialDoneKey(userId) = "true"`, sets the workspace selection to home, and `router.replace` to Home. Tapping Continue again is guarded.
- **Accounts continue** through share and congrats. The **Continue** at the end calls `router.push("/(onboarding)/calendar")`.

**Skip** (available on every step): records analytics with `skipped: true`, `skipped_at_step`, and `is_guest`. Then:
- Writes AsyncStorage flags `${userId}-home-tour-seen`, `${userId}-intro-tour-seen`, `${userId}-quicksetup` = `"true"`, so the Home tour, intro tour, and quick-setup sheet don't stack on arrival. Guests also get the guest-done key.
- If the practice category was created but not completed, it deletes it, so the seeded Guide workspace doesn't show two tasks.
- Guests → `promptAccountAfterSkippingTutorial()`, then Home. The account overlay opens with reason `skipped-tutorial`.
- Accounts → `/(onboarding)/calendar`.

---

### Captured tutorial frames (guest path, iOS simulator)

| Frame | File | What it shows |
|---|---|---|
| Step 1 | `07-tutorial-1-create-workspace.png` | "Create a workspace" prompt, "Create workspace" button, "Step 1 of 4 · Demo" |
| Step 1b | `08-tutorial-2.png` | "(Not Real) Workspace" with "My Tasks" category, "Create a category" prompt, "Tap to create" hint on the + button |
| Step 2 | `09-tutorial-3.png` | "Add a task" prompt, cursor tapping "My Tasks" |
| Step 2b | `10-tutorial-4.png` | Create-task sheet prefilled with "Go for a 15-minute walk" in My Tasks, "Tap add" hint |
| Step 3 | `11-tutorial-5.png` | Task created, "Complete your task" / "Swipe right to mark it done" |
| Step 4 | `12-tutorial-6.png` | "Meet your daily rings" explainer, Plan ring card (1/2), "Tap to continue · 1 of 3" |
| After | `14-home-after-guest-tutorial.png` | Home with the Productivity Score intro sheet, opened after the guest tutorial finished |

Not yet captured: the Do and Share ring explainer cards (the Continue taps for those were not captured, and the frame I took after the first Continue already showed Home). Guests skip the share sequence and congrats steps (see section 10).

## 11. Calendar (`app/(onboarding)/calendar.tsx`)

- Icon: phosphor `CalendarBlank` duotone in a 96 px circle, pops in with a spring.
- Title: **"Connect your calendar"**.
- Subtitle: **"See your schedule alongside your tasks so nothing falls through the cracks"**.
- Stat card: **"Kindred users who connect their calendar complete their tasks 3x as often"**.
  - ⚠️ This is a marketing claim hard-coded in the UI. I found no source for the 3x figure in the repo. Verify before reuse.
- Primary button: **Connect Google Calendar** → `connectGoogleCalendar()` returns `auth_url`, opened with `WebBrowser.openAuthSessionAsync(url, "kindred://")`.
  - On success with `connectionId`, opens `CalendarSetupBottomSheet` to finish setup.
  - Fallback: checks `getCalendarConnections()` for a pending or complete connection.
  - Failure toast: "Couldn't connect calendar. You can try again later."
- Secondary: **Skip for now** → `ONBOARDING_COMPLETED` → `/(logged-in)/(tabs)/(task)`.
- Screenshot: `docs/onboarding-flow/05-calendar.png`
- After setup completes: toast **"Calendar connected!"**, `ONBOARDING_COMPLETED`, route to Home.

---

## 12. After onboarding

- Home (`/(logged-in)/(tabs)/(task)`) is the destination for everyone.
- **Home tour and intro tour** (`hooks/useHomeTour.ts`) run on first Home visit unless their `-seen` flag is set. Skipping the tutorial sets those flags.
- **Guest account overlay** (`hooks/useAccountOverlay.ts`) prompts guests to create an account at these points:
  - `skipped-tutorial`: right after skipping.
  - `task-limit`: once a guest has `GUEST_TASK_LIMIT = 3` self-made tasks. Shows after `TASK_PROMPT_DELAY_MS = 1500`.
  - `social`: on feed, search, friends, or profile surfaces, once per surface per app session.
  - `login-link`: from Home's "Log in" link.
  - Dismiss methods: scrim, "Not now", back. Dismissing runs the request's `onDismiss`.
- **Onboarding checklist card** (`components/dashboard/OnboardingChecklist.tsx`, spec in `docs/superpowers/specs/2026-05-30-onboarding-checklist-design.md`). The four items are: make first task, send first kudos, add a friend, close all 3 rings. The card is **not mounted** in any screen in this snapshot, so it does not appear to users today. Its logic is in `utils/onboardingChecklist.ts` and has tests in `__tests__/onboardingChecklist.test.ts`.

---

## 13. Persisted state

| Key | Written by | Meaning |
|---|---|---|
| `guestTutorialDoneKey(userId)` | Guest tutorial finish or skip | Guest may enter Home |
| `${userId}-home-tour-seen` | Tutorial skip | Suppress Home tour |
| `${userId}-intro-tour-seen` | Tutorial skip | Suppress intro tour |
| `${userId}-quicksetup` | Tutorial skip | Suppress quick-setup sheet |
| `guestTaskCountKey(userId)` | Task creation | Guest task count for the limit |
| Auth tokens and cached user | Auth hooks | Session restore |

---

## 14. Analytics

Events are in `utils/analytics.ts`.

- `ONBOARDING_STEP_VIEWED` and `ONBOARDING_STEP_COMPLETED` carry `step_name` and `step_index`.
- Step indices: `PRODUCTIVITY 0`, `POSITIVITY 1`, `PHONE 2`, `NAME 3`, `PASSWORD 4`, `WELCOME 5`, `TUTORIAL 6`. Note that `PRODUCTIVITY` and `POSITIVITY` belong to the retired intro screens. The phone screen currently reports `index 2`, and the progress bar uses 1-based numbers, so the two schemes differ.
- `ONBOARDING_COMPLETED` fires on calendar connect or skip, and when a guest finishes the tutorial it fires `ONBOARDING_STEP_COMPLETED` only.
- Tutorial skip adds `skipped`, `skipped_at_step`, and `is_guest`.

---

## 15. Progress bar

`components/onboarding/OnboardingProgressBar.tsx` takes `currentStep` and `totalSteps`. Totals:

- Signup via phone or email: **5** steps.
- Apple or Google signup: **4** steps (no phone verification, no password).

The tutorial and calendar screens show the total for the path the user took.

---

## 16. Known gaps and stale docs

- **`frontend/e2e/flows/02_onboarding_intro.yaml` and `03_onboarding_skip.yaml`** assert the old intro screens ("Productivity is something", "Something rooted in", "Built around positive", `onboard-next-btn`). Those screens are no longer the entry path. Either the flows are stale or they need updating.
- **`docs/onboarding-ux-audit.md` and `docs/onboarding-real-setup-plan.md`** predate the guest tutorial. Read them for history, not as current state.
- **Calendar "3x" stat** has no visible source. Confirm with product before shipping it.
- **Checklist card** is unmounted.
- **Default avatar** on every new account is a fixed external image URL, not a user choice.
- **Legal links** point to Notion pages, not in-app screens.

---

## 17. Key files

| Concern | File |
|---|---|
| Cold-start routing | `frontend/app/index.tsx` |
| Guest routing helpers | `frontend/utils/guestEntry.ts` |
| Landing | `frontend/app/login.tsx`, `frontend/components/auth/AuthHeroCard.tsx`, `AuthCtaBlock.tsx` |
| Signup sheet | `frontend/components/modals/OnboardModal.tsx` |
| Onboarding stack | `frontend/app/(onboarding)/_layout.tsx` |
| Phone | `frontend/app/(onboarding)/phone.tsx`, `hooks/useVerification.tsx` |
| Name | `frontend/app/(onboarding)/name.tsx` |
| Password | `frontend/app/(onboarding)/password.tsx` |
| Welcome | `frontend/app/(onboarding)/welcome.tsx` |
| Tutorial | `frontend/app/(onboarding)/tutorial.tsx` |
| Calendar | `frontend/app/(onboarding)/calendar.tsx` |
| Onboarding state and validation | `frontend/hooks/useOnboarding.tsx` |
| Analytics | `frontend/utils/analytics.ts` |
| Account overlay | `frontend/hooks/useAccountOverlay.ts` |
| Home tour | `frontend/hooks/useHomeTour.ts` |
| Checklist (unmounted) | `frontend/components/dashboard/OnboardingChecklist.tsx`, `utils/onboardingChecklist.ts` |
| Backend auth | `backend/internal/handlers/auth/operations.go`, `backend/api-spec.yaml` |

Backend endpoints used: `/v1/auth/send-otp`, `/v1/auth/verify-otp`, `/v1/auth/login/otp`, `/v1/auth/register`, `/v1/auth/register/apple`, `/v1/auth/register/google`, plus guest creation (`auth/guest.go`).

---

## Capturing screenshots

The app is installed on the booted simulator as `Kindred` (`frontend/ios/build/dd/Build/Products/Debug-iphonesimulator/Kindred.app`). Metro is running on 8081. `simctl launch` failed with code 4, so the route I used was a deep link:

```sh
xcrun simctl openurl booted "kindred://phone"
```

The first time, iOS shows **"Open in 'Kindred'?"**. Tap **Open** once by hand. After that, deep links open without the prompt. Then capture each screen:

```sh
xcrun simctl io booted screenshot docs/onboarding-flow/01-phone.png
```

Routes to capture: `phone`, `name`, `password`, `welcome`, `tutorial`, `calendar`, and `login`. For a true first-run guest, reinstall or clear app data first. `tutorial` needs the backend running for workspace creation.

Captured so far: `01-phone`, `02-name`, `03-password`, `04-welcome`, `05-calendar`. Login and tutorial redirected to Home because the simulator account is signed in. To capture them, sign out or use a fresh install, then rerun the `openurl` and `screenshot` steps for `login` and `tutorial`.
