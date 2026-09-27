# Onboarding UX Audit

Status: first pass, done by reading the code (not tested on a device yet). Items
marked [verify] need checking on a real phone.

## Current flow

```
index -> /login (landing, always light mode)
  "Join Kindred" -> OnboardModal sheet (Phone / Apple / Google)
    Phone:  phone+OTP -> name+handle -> password -> welcome -> tutorial -> calendar -> home
    Social: name+handle -> welcome -> tutorial -> calendar -> home
  "Log in" -> same sheet -> /login-phone or social login
```

Counted on the phone path, a new user goes through about 6 screens and roughly
20 taps before reaching home. The tutorial is about 13 of those taps.

---

## P0: broken, or likely causing drop-off

1. **The terms checkbox is hidden behind the keyboard** (`(onboarding)/phone.tsx`).
   The phone field has `autoFocus`, and the code comment itself says the checkbox
   "sits below helper text, behind keyboard". "Send Code" stays disabled until the
   box is checked, and nothing says why. Users type a valid number, see a dead
   button, and get stuck. Fix: replace the checkbox with passive consent
   ("By continuing you agree to...") under the button, or move the checkbox above
   the fold. [verify on a small iPhone]

2. **Send-code failures are silent.** `sendOTPError` is only shown inside the
   `codeSent` branch. If the first send fails, the phone step shows nothing.

3. **The OTP is used twice** (`phone.tsx` ~l.97-138). `verifyOTP` runs, then 800ms
   later `loginWithOTP` runs with the same code to check whether the account
   exists. If the backend consumes codes on verify, login fails with a
   non-`ACCOUNT_NOT_FOUND` error, and the catch-all sends the user to
   **registration even when they already have an account**. That can produce
   duplicate or conflicting sign-ups. Needs a dedicated "does this phone exist"
   check. [verify backend OTP semantics]

4. **The "Log in" / "Sign up" footer link in OnboardModal does nothing**
   (`components/modals/OnboardModal.tsx:406-410`, the handler is an empty
   placeholder). It is a dead tap on the very first sheet.

5. **Handle availability is only checked at the final registration call.** The
   name screen validates format locally. A taken handle only comes back as an
   error toast at the password step, two screens later, and the user has to go
   back with no back button. Fix: check availability as the user types on the
   name screen, and auto-suggest a handle from their name.

6. **The tutorial can't be skipped** and swipe-back is off
   (`gestureEnabled: false`). It is long: category, task, swipe, 3 ring taps,
   toast, photo, post, feed, kudos x2, beak post, and the kudos modal. Only one
   analytics event covers the whole tutorial, so there's no way to see where
   people quit. Add a skip option and a per-beat `step_name`.

7. ~~Login has no country picker.~~ Not a real issue. `PhoneInput` (`components/inputs/PhoneInput.tsx`) has its own picker. The finding came from an out-of-date comment in `login-phone.tsx`, which has since been corrected.

## P1: friction and confusing copy

8. **The sheet title "Almost there!" shows on register** before the user has
   done anything. The subtitle is the same string in both branches
   (`mode === "login" ? "Choose your sign in method" : "Choose your sign in method"`).
   Suggestion: "Create your account" / "Welcome back".
9. **An extra tap to reach the auth options.** Landing, then "Join Kindred",
   then a sheet with 3 buttons. Put Phone/Apple/Google directly on the landing
   page. The sheet also needs a `setTimeout(50)` re-present hack to open
   reliably.
10. **Password step after OTP.** Phone users just proved who they are with a
    code, and login already supports OTP. Password plus confirm password is a
    whole extra screen. Make it optional (set later in settings) or drop confirm
    password, since the show/hide toggle already covers mistyping.
11. **The welcome screen is filler.** It's a static "You've joined the kindred
    family", and the button fades in after 1.2s. Merge it into the tutorial
    intro or drop it. This also clashes with the memory rule that input should
    never wait on an animation.
12. **Two progress systems that disagree.** The top bar reads 5/5 (full) on
    entering the tutorial, then the tutorial shows its own "Step x of 3" dots
    across two phases, and the calendar step has no bar. Social users start at
    2/4. Use one model, e.g. "Account / Try it / Connect".
13. **Mixed messages in the demo notice.** It says "This is a demo. Not your real
    workspace... Nothing to type yet", but it creates a real category and task in
    the Guide workspace and sends real kudos from beak. Pick one framing. The
    step-0 subtitle also leads with jargon ("Workspaces hold categories, and
    categories hold tasks").
14. **Timed auto-advances in the tutorial.** The feed "post" beat advances on its
    own after 1.7s, the ring cursor appears after 2.5s, the category creator
    mounts after 1.3s, and the task name types at 100ms per character. The
    pacing is set by the app, not the user. Tighten these, and make every beat
    advance instantly on tap.
15. **Rings explainer.** All three rings are visible, but the text describes one
    ring at a time, and "Tap to see the next ring" applies to the whole area.
    Show all three labels at once, or highlight the ring being described.
16. **No back buttons** on phone, name, or password. Only the iOS swipe works,
    and Android relies on the hardware back button. `login-phone` uses a text
    "← Back" that doesn't match the rest.
17. **Registration errors show raw `error.message`** in toasts. Map these to
    human-friendly copy.
18. **Calendar step:** only Google Calendar is offered, even though most users
    are on iOS with Apple Calendar. The claim "complete their tasks 3x as often"
    needs a source or should be softened. The same `CalendarBlank` icon appears
    twice.

## P2: polish and consistency

19. **Emojis in copy** break the no-emoji rule:
    - `"Account created successfully! 🎉"` (`name.tsx`, `password.tsx`)
    - `KUDOS_PREFILL = "nice work beak!! 🎉"` (`tutorial.tsx`)
20. **Theme flips mid-flow.** The landing page is hardcoded light
    (`Colors.light`), while every later screen follows the system theme. Dark
    mode users go from white to black on the first tap. The welcome screen also
    hardcodes `#854dff`.
21. **Default avatars are Pinterest URLs**, and they differ between the social
    and phone flows. There's no photo step, so the user's first post in the
    tutorial shows a stock avatar.
22. **Layout uses fixed fractions of screen height**
    (`paddingTop: screenHeight * 0.18-0.35`) and `Dimensions.get("screen")` on
    the landing page. [verify on SE / small Android]
23. **Spacing values aren't multiples of 4:** gap 18, paddingVertical 18, 6, 10,
    14, marginTop 6, etc. (OnboardModal, tutorial styles).
24. `isValidPhone` is `length >= 10` for every country code, which blocks
    valid shorter numbers.

## Bigger-picture gap

The tagline is "because doing it alone was never actually the plan", but
onboarding never connects the user to a single real friend. No contacts sync,
no invite, no "find people". The user finishes with only beak (a founder demo
account). Adding a find-or-invite-friends step, possibly in place of the welcome
screen, is likely the highest-leverage change for retention. Also consider where
notification permission is asked: it currently happens after landing in the app,
with no context for why.

## Suggested next steps

- Run the flow on a device (small iPhone plus Android) to confirm the P0 items
  and time each step.
- Add per-beat analytics to the tutorial, then look at the funnel.
- Quick wins (under 1 hour each): #1, #2, #4, #8, #19.

## Fix log

- 2026-09-27: Fixed #1 (consent line under the Send Code button replaces the checkbox), #2 (send errors now show on the phone step), #4 (the footer link switches the sheet between log in and sign up), #8 (sheet copy), and #19 (emojis removed). Not yet checked on a device.
