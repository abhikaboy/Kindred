# Analytics Page Redesign — Design Spec

**Date:** 2026-06-12
**Status:** Draft for review
**Surface:** `(activity)` tab (tab bar "Activity", page titled "Analytics") — `frontend/app/(logged-in)/(tabs)/(activity)/[id].tsx`

## Summary

Rebuild the tab-bar Analytics page as a **graph-first, customizable card stack** with a **personalized insight engine**. Category/workspace/tag is the dimension threaded through every chart. Narrative text (a written lede + one-line takeaways under charts) interprets the data instead of leaving the user to read dashboards.

The `(task)/analytics.tsx` "Coming Soon" stub is deleted as part of this work.

## Goals

- Every element either drives a next action or shapes weekly self-understanding; raw data displays (heatmap, totals) are demoted to optional cards.
- Insights are personalized and niche — mined from the user's open tasks, completed tasks, deadline behavior, and social graph; two users see materially different pages.
- Visuals carry the page: a range-adaptive hero chart, category-colored charts throughout, custom SVG components in Kindred's design language.

## Non-goals (deliberate cuts, research-grounded)

- **No daily composite score as hero.** Task-focused feedback helps; self-focused grading backfires (Kluger & DeNisi 1996). Productivity score may appear *inside* trend lines, never as a gauge greeting the user.
- **No leaderboards / friend output comparison** (Hanus & Fox 2015). Social analytics = kudos/support effects only.
- **No unbroken-chain framing.** Consistency and recovery, not perfect records (Lally et al. 2010). Existing product rule: the word "streak" never appears in copy — use "run", "consistent", "X weeks in".
- **No charts behind the minimum-sample gate.** No insights computed off a handful of data points.

## Page architecture

Top to bottom:

1. **Header** — "Analytics" (Fraunces), range switcher `W / M / 6M`, `Edit` button.
2. **Filter chip row** — `All` + one chip per category (colored dot) + tag chips. Selecting re-slices every card below. Categories come from `workspaces.flatMap(ws => ws.categories)` (NOT `useTasks().categories`, which is selected-workspace-only).
3. **Narrative lede card** — the insight engine's #1-ranked insight written out: Fraunces lede sentence + Outfit body with bolded stats + up to 2 action buttons.
4. **Hero chart card** — range-adaptive encoding:
   - `W`: stacked bars per day by category; tap-to-scrub (bar dims others, tooltip shows split, takeaway line rewrites for that day; tap-through to day's completed tasks).
   - `M / 6M`: trend lines — tasks/week (solid) + on-time rate (dashed second series).
   - Big Fraunces stat + delta in the card header.
5. **Category share card** — donut with center stat at `W`; 100% stacked band at `M/6M` with share-shift takeaway ("Work grew 32% → 41% since March").
6. **Pinned cards** (default order, user-customizable):
   - **Category rhythms** — per-category time-of-day ribbons.
   - **Insight cards** — engine's #2–4 ranked insights, interleaved between graph cards. Badge (e.g. "Deadline behavior"), title, body, inline evidence mini-chart, ≤2 actions.
   - **Category health tiles** — 2-col grid, one tile per category: count, trend sparkline in category color, health note ("84% on time" / "pushed 3.2×"). Tapping a tile applies its filter chip.
   - **Where you shine** — strengths card: the category/habit with the best on-time rate or most consistent rhythm ("Gym never moves — 9 weeks consistent, 100% on time"). Positively framed, always present when data supports it.
   - **What slips / runs late** — ranking of categories by pushed-off-ness and lateness: late-completion rate (finished past deadline), tasks sitting past their `startDate`, stale-open age. v1 computes this entirely from existing fields; the phase-3 reschedule counter sharpens it ("pushed 3.2× before happening").
   - **When you finish** — punch card (hour × weekday, colored by dominant category).
   - **Optional gallery cards:** year heatmap (the legacy heatmap survives here), kudos effect, pattern-spotted (correlation).
7. **Edit mode** — long-press or `Edit`: drag to reorder, remove, "Add cards" gallery sheet with mini-previews. Layout persisted per-user in AsyncStorage v1 (sync to user doc only if cross-device demand appears).

### Insight detail screen

Tapping an insight card or lede action pushes a detail screen: full-size evidence chart, receipts line ("based on your last 214 completed and 38 expired tasks"), affected-task list (e.g. open tasks past the cliff), and bulk actions (Schedule / Archive). Typed route under the `(activity)` group.

## Insight engine

### Detector interface

```ts
interface Detector {
  id: string;                       // also the novelty-cooldown key
  minSamples: number;               // gate: don't fire under this
  compute(corpus: AnalyticsCorpus): InsightCandidate | null;
}
interface InsightCandidate {
  effect: number;      // normalized effect size 0..1
  confidence: number;  // 0..1, sample-size driven
  headline: string;    // sentence-generated, copy rules applied
  body: string;
  evidence: EvidenceSpec;   // which mini-chart + its data
  actions: InsightAction[]; // navigate / schedule / archive / filter
}
```

**Ranking:** `score = effect × confidence × novelty(id)`. Novelty decays after an insight type fires and recovers over ~3 weeks, or immediately if the underlying number changes materially (>20% shift). Top candidate → narrative lede; next 2–3 → interleaved insight cards. Last-fired state lives in AsyncStorage.

**Sparse data:** below global minimums (< ~20 completed tasks), the page shows charts with honest empty/partial states and onboarding copy — never fabricated insights.

### Detector catalog (v1 set marked ★)

From completed tasks (`timeCompleted`, `timestamp`, `deadline`, `timeTaken`, `categoryID`, `priority`, `value`):

- ★ **Completion cliff** — age-at-completion distribution vs ages of open tasks → "71% done within 48h; after that, 19%."
- ★ **Deadline runner / early finisher** — histogram of (deadline − timeCompleted) + on-time rate; framed as workstyle, not flaw.
- ★ **Deadline leverage** — completion rate with vs without deadline → suggest deadlines for dateless stale tasks.
- ★ **Late pattern** — late-completion rate per category → "School runs late 40% of the time; Gym, never." Feeds the what-slips card.
- ★ **Strengths** — best on-time category + most consistent habit → feeds the where-you-shine card.
- ★ **Power windows** — hour×weekday completion clusters per category (visual twin: rhythms card).
- **Batching** — burst vs steady completion timing profile.

From open tasks:

- ★ **Priority inversion** — oldest high-priority open task vs count of low-priority tasks completed since it was created.
- ★ **Capacity check** — due-next-week count vs trailing median weekly throughput; names the category overflow lands on.
- **Graveyard** — age-bucketed open tasks; triage actions (schedule / archive).
- **Checklist effect** — completion rate with vs without checklist; suggest breaking down stale large tasks.

From the social graph (`encouragements[]`, `taggedUsers[]`):

- ★ **Encouragement effect** — completion latency for tasks cheered while open vs quiet ones; names top supporter.
- **Accountability tags** — completion rate when friends are tagged.

Cross-category:

- **Correlation** — day-level joins ("days that start at the gym end with 47% more Work finished"). Needs careful min-N and effect thresholds; phase 3.
- **Share shift** — category share drift across the selected range (feeds the band card takeaway).

Habit/template detectors (recovery, fading, adherence) stay available to the engine. The current page's recurring-task section is replaced in phase 1 by a **Habits card** in the default pinned set (reusing `RecurringTaskCard` data: adherence %, month dots, completed/missed) so no existing functionality is lost; it becomes removable like any card once edit mode ships.

### Copy rules

Insights are task-focused, never self-judging ("Pressure is your fuel, not your problem", not "You procrastinate"). No "streak". Sentence generators templated per detector with slots for names/numbers; rotate phrasings to slow staleness.

## Data plumbing

**v1 is fully client-side.** A `useAnalyticsCorpus` hook (React Query):

- Completed tasks: `GET /v1/user/tasks/completed` paginated — fetch up to ~500 / last 6 months.
- Open tasks: `useTasks()` context (already loaded).
- Templates: `getUserTemplatesAPI()` (already used on this page).
- Categories/tags: `workspaces.flatMap(ws => ws.categories)`.
- Rings history (`/v1/user/rings/history`) only if a gallery card needs it.

Selectors (pure functions, unit-testable) derive every chart series and feed detectors: `byDay(range, filter)`, `byCategory`, `byHourWeekday`, `deadlineDeltas`, `ageDistributions`, etc. `timeTaken` is a duration string — parse defensively.

**Backend additions (small, later phases):**

- **Reschedule counter** (phase 3): increment `timesRescheduled` on task when `startDate`/`deadline` is edited → powers "what slips". Accrues from deploy day.
- **Planned vs actual** (phase 3): v1 ships **deadline adherence by category** instead (zero new data). A true estimate field at task creation is optional later.
- A server-side summary aggregation endpoint only if >6-month horizons or payload size demand it.

**Category colors:** stable assignment from a fixed palette (purple `#8B5CF6`, teal, amber, rose, +2 more), hashed by category id, consistent across sessions; collisions acceptable beyond 6.

## Chart components

Custom SVG on the existing `react-native-svg` — no chart library. Shared building blocks (axis labels, legends, theming via `useThemeColor`, Fraunces stats / Outfit labels via `ThemedText` types):

`StackedBars` (scrubbable), `TrendLines` (multi-series), `Donut`, `Band100`, `RhythmRibbon`, `PunchCard`, `MiniSpark` (bar+line), `DeltaHistogram` (deadline runner), `DecayCurve` (cliff). Each is a focused component; no render-helper functions inside screens.

## Friend view

`(activity)/[id]` keeps serving friends' pages: friends see **heatmap + year total only** (today's behavior). The engine, insight cards, and customizable stack render exclusively on the owner's own page. Friend-visible analytics expansion is out of scope.

## Stub removal

- Delete `frontend/app/(logged-in)/(tabs)/(task)/analytics.tsx`.
- Repoint `components/dashboard/BottomDashboardCards.tsx:41` to the activity tab (typed `Href`).
- Remove the `/analytics` title mapping in `components/home/Drawer.tsx:100`.

## Error / empty / loading

- Skeletons reuse the page's existing shimmer pattern per card.
- Per-card error isolation: a failed selector/fetch collapses that card, never the page.
- New-user empty state: hero chart renders with zeroed axes + onboarding copy; insight slots hidden below minimums.

## Testing

- **Detectors:** pure-function unit tests against synthetic corpora fixtures (deadline-runner user, morning-batcher user, sparse new user) asserting gate behavior, effect sizes, and sentence output.
- **Selectors:** unit tests for range/filter slicing, timezone edges (day bucketing uses local time), `timeTaken` parsing.
- **Components:** render tests for chart components with fixed data; scrub interaction test for `StackedBars`. (Mock both `react-native-worklets` and `react-native-reanimated` if any animated import sneaks in.)
- Bar: `tsc` (14 pre-existing DatePager errors are baseline), `go test -short -race ./...` for any backend change.

## Phasing

- **Phase 1 — the visual page:** card registry + fixed default order (no edit mode), header/range/chips, hero chart (bars + lines), share card (donut/band), rhythms, category tiles, Habits card, stub removal. Heatmap becomes a card at the bottom.
- **Phase 2 — the engine:** corpus hook + selectors, ★ detectors, ranking/novelty, narrative lede card, interleaved insight cards, where-you-shine + what-slips + punch-card cards, insight detail screen, sparse-data states.
- **Phase 3 — customization & depth:** edit mode + add-card gallery + persistence, reschedule counter (backend) upgrading what-slips, correlation detector, share-shift insight, kudos-effect card.

Each phase ships independently; the page is never in a broken intermediate state.
