# Productivity Rings Card Redesign

## Summary

Redesign the ProductivityRings component on the profile page into a prominent card with an arc gauge for the productivity score, a score breakdown, and an expanded ring detail view with 7-day history and contextual CTAs. Tapping a ring triggers a full-screen blur overlay (expo-blur) that focuses attention on the card.

## Motivation

The current rings display is flat and easily overlooked. The score is shown as plain text with no visual weight. There is no way to act on a ring's guidance directly, and no historical context for how a ring has performed over the past week.

## Design

### Default (Collapsed) State

A single card with subtle drop shadow containing two vertical zones:

**Top: Score Arc Gauge**

- Semi-circle (180 degrees) SVG arc rendered with `react-native-svg`
- Arc fill color: `#854DFF` (primary purple), proportional to `score / 100`
- Arc track color: theme `tertiary`
- Score number centered inside the arc, Fraunces 600, 36px
- Min label "0" bottom-left of arc, "100" bottom-right, Outfit caption size
- Two stat pills beneath the arc:
  - "Rings: X/21" (closed rings in the 7-day window)
  - "Streak: X days"

**Bottom: Rings Row**

- Three tappable ring circles in a horizontal row: Plan, Do, Share
- Each shows `current/target` text or a checkmark icon when closed
- Labels beneath each ring: "PLAN", "DO", "SHARE" in Outfit 11px, letter-spacing 1

**Card Styling**

- `borderRadius: 16`
- Background: theme `card` or `secondary`
- Shadow: `shadowColor: #000`, `shadowOpacity: 0.08`, `shadowOffset: { width: 0, height: 4 }`, `shadowRadius: 12`, `elevation: 3`
- Horizontal padding: 20, vertical padding: 20
- Gap between arc section and rings row: 20

### Expanded State (Ring Tapped)

#### Blur Overlay

- `BlurView` from `expo-blur` covering the full screen behind the card
- Intensity: 15, tint: "dark"
- Background dim: `rgba(0, 0, 0, 0.4)`
- Rendered as a sibling at the `profile.tsx` ScrollView level (portal pattern, same as FABBackdrop)
- Tapping the overlay dismisses the expanded state
- Fade-in: `Animated.timing`, 250ms

#### Card Behavior

- Card scales to `1.03` with a stronger shadow to lift off the page
- Non-selected rings dim to 0.3 opacity
- Selected ring stays fully opaque
- Transition: `LayoutAnimation.easeInEaseOut`

#### Expanded Content (within card, below rings row)

1. **Ring header**: Ring name + progress, e.g. "Do - 2 / 3", Outfit 600 14px
2. **Guidance text**: Contextual hint per ring type:
   - Plan: "Create or schedule tasks to close this ring"
   - Do: "Complete tasks to close this ring"
   - Share: "Post an update or send kudos to close this ring"
3. **7-day history row**: Seven small circles (diameter ~12px) representing the last 7 days. Filled purple if that ring was closed on that day, theme `tertiary` fill if not. Day-of-week labels (M, T, W, T, F, S, S) beneath each dot in Outfit 10px caption color.
4. **CTAs**: Pill-shaped buttons in primary purple, Outfit font, white text.

| Ring  | CTA 1                                          | CTA 2                                            |
|-------|------------------------------------------------|--------------------------------------------------|
| Plan  | "Plan Today" -> `/(tabs)/(task)/daily`         | "Quick Add" -> `/(tabs)/(task)/voice`            |
| Do    | "View Tasks" -> `/(tabs)/(task)/today`         | -                                                |
| Share | "Make a Post" -> `/(logged-in)/posting/cameraview` | "Send Kudos" -> `/(logged-in)/kudos-rewards` |

### Score Breakdown (Future / On-Tap)

The full formula breakdown (base 50 + ring bonus up to 50 + streak bonus up to 7) is not shown by default. The two stat pills (Rings X/21, Streak X days) provide enough context. A future iteration could show the full breakdown when tapping the score number, but this is out of scope for this iteration.

## Architecture

### Component Tree

```
ProductivityRingsCard (new wrapper, replaces ProductivityRings)
  ScoreArc (new) - pure SVG semi-circle gauge
  RingsRow (extracted) - three ring circles, tap handlers
  ExpandedRingDetail (new) - history dots, guidance, CTAs
```

```
profile.tsx
  RingsBlurOverlay (new) - full-screen BlurView, rendered at ScrollView level
  ...
  ProductivityRingsCard
  ...
```

### State Management

- `expandedRing: RingKey | null` lives in `ProductivityRingsCard`
- Passed up to `profile.tsx` via a callback prop `onExpandChange(expanded: boolean)` to control blur overlay visibility (same pattern as DashboardStats `onExpandChange`)
- No new context or global state

### Data Flow

- `useRings()` hook already provides: `rings` (today's state), `score`, `history` (7-day array)
- History is filtered client-side by selected ring type to produce the 7-day dot row
- Closed ring count for the "Rings: X/21" pill is computed by iterating `history` and counting closed rings across all three types
- No backend changes required

### New Dependencies

None. `expo-blur` and `react-native-svg` are already in the project.

## Dashboard Cleanup

The rings are currently rendered on the dashboard home screen (`HomescrollContent.tsx:318`) in compact mode. For now, rings should only appear on the profile page. Remove the `ProductivityRings` import and usage from `HomescrollContent.tsx`.

## Files (updated)

| File | Change |
|------|--------|
| `components/profile/ProductivityRings.tsx` | Rewrite into `ProductivityRingsCard` with arc, card wrapper, expand logic |
| `components/profile/ScoreArc.tsx` | New - SVG semi-circle gauge component |
| `components/profile/ExpandedRingDetail.tsx` | New - history dots, guidance text, CTAs |
| `components/profile/RingsBlurOverlay.tsx` | New - full-screen BlurView overlay |
| `app/(logged-in)/(tabs)/(profile)/profile.tsx` | Render `RingsBlurOverlay`, pass expand state from card |
| `components/dashboard/HomescrollContent.tsx` | Remove `ProductivityRings` import and usage |
| `hooks/useRings.ts` | No changes |
| `api/rings.ts` | No changes |

## Out of Scope

- Full formula breakdown overlay (tapping score to see base/ring/streak segments)
- Animated ring fill on mount (can add later as polish)
- Horizontal bar alternative layout (will revisit if arc feels too large in practice)
- Rings on dashboard (may revisit placement later, excluded for now)
