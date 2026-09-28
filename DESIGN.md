# Kindred Design Guide

How Kindred should look and feel on mobile (`frontend/`), desktop (`desktop/`), and native surfaces (widgets, Live Activities). Read the anti-patterns first. Most bad Kindred UI isn't missing something; it has too much of something: too many containers, labels, borders, weights, or words.

The short version: **one surface, one headline, light text, soft depth, no decoration that doesn't carry meaning.**

---

## 1. Anti-patterns (do not do these)

### Structure and containers

- **No nested cards.** Never put a card inside a card, or a bordered box inside a bordered box. If a section is already on a surface, its children sit directly on it, separated by spacing, not by more boxes. When you feel the need for an inner card, use whitespace or a single hairline divider instead.
- **No card wrappers around whole sections.** A home-screen section is a title plus its content, laid out on the page. Don't wrap each section in its own rounded container.
- **No side-by-side columns competing for attention.** One full-width section per concern, stacked top to bottom, so the eye scans in one direction.
- **No blocking explainer modals or overlays** before a user can start ("This is a demo", "Here's how this works"). Let the flow explain itself, or fold the note into existing caption text.

### Labels and copy

- **No eyebrows.** Don't put a small uppercase, letter-spaced label ("TODAY", "THIS WEEK", "STATS") above a title or a block. It adds a line of noise and usually comes with oversized spacing around it. If the content needs a heading, use the section title style (section 4). If it doesn't, drop the label.
- **No crazy spacing around labels.** A label and the thing it labels belong together. Don't separate them with 24px+ gaps, or pad a caption so it floats alone.
- **No unnecessary subtitles.** Don't add a caption under a title that restates it ("Workspaces" / "Your workspaces"), explains the obvious ("Tap to open"), or describes the section ("See what your friends are up to"). Add a subtitle only when it carries live information: a count, a status, a time.
- **No stacked uppercase stat labels.** Three uppercase words stacked beside a metric read as noise. Let an icon carry the meaning and put the label in a tooltip or accessibility label.
- **No loud status pills.** Context like "Demo", "Beta", "Example" or "Preview" goes inline in the existing caption, in caption color (" · Demo"), never as an accent-colored badge.
- **No emojis. Anywhere.** Not in UI labels, empty states, notifications, toasts, commit messages, or copy. Use a Phosphor icon when you need an accent.
- **No marketing voice.** "Add a task" beats "Add a task — we'll sort out the details."

### Borders, fills, and depth

- **No borders by default.** A border has to earn its place: it's for inputs and for surfaces that would otherwise vanish into the background. Decorative outlines around groups, headers, or content blocks are out.
- **Soft shadows over borders.** When a surface needs to lift off the page, give it a soft, diffuse shadow (section 5). Don't use a hard 1px outline.
- **Never stack border + shadow + tinted fill** on the same element. Pick one way to separate it from the page.
- **No gray wells.** An input or empty row shouldn't read as a gray trough. In light mode it should look like an empty task row on the page (background fill, hairline edge). Dark mode keeps a raised surface.
- **No gray on light-purple tints.** Caption gray on a `primary` wash looks muddy. Text on a purple tint is `primary` or `text`.
- **No purple gradients as backgrounds** (widgets especially). Use the solid theme background.
- **No theme-gray cards on dark stages.** Full-screen composer stages use their own white-alpha palette (section 3), never the light theme's gray `lightened`/`tertiary` surfaces on black.
- **No thick `borderLeftWidth` accent strips** on rounded cards. They bend around the corner. Accent bars are separate, straight, square-cornered elements inset from the card edge.

### Type

- **No heavy-weight pileups.** One confident Fraunces headline per screen. Everything else is light Outfit. Don't surround the headline with 500 to 800 weight supporting lines.
- **No more than two or three text styles on one screen.**
- **No serif numerals or Fraunces in functional UI** (stats, widgets, counts). Fraunces is for display headings only.
- **No italic Fraunces.** Weights 500 to 600 only.
- **No hardcoded `fontFamily` or `fontWeight`.** Use `ThemedText` types.
- **No small captions as group headings.** "When", "Repeat" and "Priority" as tiny captions over controls read as bad heading styling. Group headings use the section title style.

### Motion and interaction

- **No input waiting on animation.** Taps apply immediately, and rapid taps are allowed. A new tap interrupts the previous motion. Never lock input until an animation finishes.
- **No flashy transitions.** No springs, scale pops, long slides, or staggered cascades for content swaps. Aim for motion that is almost invisible.
- **No hard cuts either.** Content that swaps should cross-fade, not snap.
- **No everything-at-once helpers.** Reveal one relevant prompt or suggestion at a time.

### Consistency

- **No bespoke one-offs.** A hand-rolled task row, hint, button or toggle "strays from the design used everywhere else" and reads as unfinished. Find the existing component and adapt it (section 6).
- **No desktop-only redesigns.** Desktop mirrors mobile's visual structure and exact values. Only the interaction adapts (hover instead of tap, popover instead of bottom sheet).
- **No theme-specific effects.** A glow, wash or bloom ships for both light and dark mode, on the same animation timeline.
- **No off-grid spacing.** Padding is a multiple of 4px. On desktop, avoid Tailwind half steps like `p-1.5` and `py-2.5`.
- **No suggestions without a reason.** "Suggested for you" must say why (for example, due again based on your usual rhythm), not replay old task titles.

---

## 2. Principles

1. **Borderless by default.** Content sits on the page. Use space to group and soft shadow to lift. Use a border only where an edge is functionally needed.
2. **One direction.** Full-width sections stacked vertically. Left-aligned by default.
3. **One headline.** A single Fraunces display line anchors a screen. Everything else is quiet.
4. **Every word earns its place.** Titles name things, captions carry live data, and nothing restates what is already visible.
5. **One product.** Mobile, desktop and native surfaces share components, values and copy. Shared constants live in `shared/` so the clients can't drift.
6. **Instant and quiet.** Input responds immediately. Motion is short, subtle and never in the way.

---

## 3. Color

Always read colors from the theme: `useThemeColor()` on mobile, CSS variables and Tailwind tokens on desktop. Never hardcode a hex that the theme already has.

| Token | Light | Dark | Use |
|---|---|---|---|
| `primary` | `#854DFF` | `#854DFF` | Main action, selection, links, active state |
| `text` | `#13121F` | `#FFFFFF` | Body and titles |
| `caption` | `#919090` | `#919090` | Secondary text, metadata |
| `background` | `#FFFFFF` | `#0c0c1a` | Page |
| `lightened` | `#F5F5F5` | `#171626` | Raised surface (dark-mode inputs, sheets) |
| `lightenedCard` | `#FAFAFAB8` | `#1a1929B8` | Task cards |
| `tertiary` | `#E5E5E5` | `#1F1D2E` | Hairlines, input edges, ring tracks |
| `success` / `warning` / `error` | `#1CF954` / `#FFD700` / `#FF5C5F` | `#5CFF95` / `#FFFF5C` / `#FF5C5F` | Priority dots, status |

- **Tints:** use `primary` plus an alpha suffix for washes, for example `primary + "14"` (8%) for a soft chip or `primary + "26"` (15%) for a today marker. Text on a tint is `primary`, not gray.
- **Ring colors** come from `shared/rings.ts` (`RING_COLORS`: plan `#854DFF`, do `#2F9BFF`, share `#FF6EC7`). A ring's track is its own color at `1A` alpha, not a neutral gray.
- **Dark composer stage** (quick capture, create composer): black gradient backdrop in both themes, white text, 60% white for secondary text, 10-16% white-alpha flat fills for chips and cards, solid white with dark text for the selected option, and `primary` only for the main action. Round icon buttons are circles.

---

## 4. Typography

Two families: **Fraunces** for display, **Outfit** for everything functional. Always go through `ThemedText`.

| Role | `ThemedText` type | Notes |
|---|---|---|
| Screen headline | `titleFraunces` / `fancyFrauncesHeading` | Fraunces 600 (the default). One per screen. Never lighten it. |
| Sheet/dialog heading | `fancyFrauncesSubheading` | Fraunces, for "How did today go?" style prompts |
| Section title | `default` at 17px (`SectionHeader variant="prominent"`; desktop `larger_default`) | Sentence case: "Activity Rings", "Personal Workspaces" |
| Row title / emphasis | `defaultSemiBold` | Task names in lists, legend labels |
| Body | `default` (OutfitLight) | Most text |
| Secondary | `caption` | Metadata, counts, status. Weight 400 or lighter. |

- Keep a screen to two or three of these.
- Numbers in functional UI (scores, counts, stats) use Outfit, with tabular figures where they align.
- Sentence case everywhere. No all-caps labels (see eyebrows above).

---

## 5. Space, shape, and depth

- **Spacing grid:** 4px. Common steps are 4, 8, 12, 16, 20 and 24. Page gutters use `HORIZONTAL_PADDING` on mobile.
- **Keep related things close:** a title sits 8-12px above its content. Separate sections by 24-48px. Don't separate a label from its content by more than the content's own internal gap.
- **Radii:** 12 for inputs, buttons and CTA rows (matching `PrimaryButton`); 16 for task cards and dialogs; full circles for icon buttons, avatars and dots; full-round pills for chips.
- **Soft shadow (preferred lift):** diffuse, low opacity, offset downward. For example `0 1px 2px rgba(0,0,0,0.03), 0 8px 28px -14px rgba(0,0,0,0.08)` on desktop, or the theme's `shadowSmall` (`0 1px 5px #0000001a`) on mobile. A focused input can fade in `0 8px 16px rgba(0,0,0,0.08)`.
- **Hero CTA glow:** only for the single main action on a screen. Use the login-button glow: shadow color `primary`, offset 0/6, opacity 0.3, radius 10.
- **Borders:** 1px `tertiary`, and only where the edge is functional: text inputs, and the established task card surface. A bordered surface never contains another bordered surface.

---

## 6. Components to reuse

Before building anything visual, find the existing piece.

| Need | Mobile | Desktop |
|---|---|---|
| Text | `ThemedText` | `ThemedText` |
| Icons | `phosphor-react-native` | `@phosphor-icons/react` |
| Task row | `TaskCard` (`lightenedCard`, 16 radius, priority dot) | `TaskItem` |
| Time and recurrence metadata | `TaskChip` (use the `inline` variant under titles, the `overdue` tone for lateness) | `TaskItem` chips |
| Main button | `components/inputs/PrimaryButton` | `components/PrimaryButton` |
| Mode switch | `components/ui/SegmentedControl` (`accent`, `icons`, `compact`) | `components/ui/segmented-control` |
| First-use hint | `HintBubble` + `useFirstTouchHint` | one-time caption hint in localStorage |
| Section title | `SectionHeader` (`variant="prominent"`) | `components/home/SectionHeader` (`variant="prominent"`) |
| Rings | `ConcentricRings` | `components/rings/ConcentricRings` |
| New task | `CreateComposer` (not the legacy `CreateModal` sheet) | `CreateTaskDialog` via `useCreate()` |
| Toasts | `showToast` (no default titles) | `sonner` `toast` |

- **Category accents:** a straight, square-cornered bar inset from the card edge, in the category color. The card keeps its own rounded corners.
- **Priority dot:** `primary` when in progress; otherwise `success`, `warning` or `error` by priority.
- **Times:** shown in a left-hand column outside the card when listing a schedule.

---

## 7. Motion

- **Content swaps** (suggestions, panels, prompts): about a 200ms fade with at most a few pixels of drift. Animate layout height changes the same way.
- **Progress fills** (rings, meters): about an 800ms ease-out. Empty rings keep a small visible sliver.
- **Taps:** the result applies on press-in. Nothing waits for an animation, and taps can be spammed.
- **Inside React Native `Modal`s:** prefer entering animations and layout transitions. Reanimated exiting animations inside a Modal can crash on iOS.

---

## 8. Copy

- Short, plain and in sentence case: "Add a task", "Quick log my day", "Nothing planned yet".
- Captions carry live facts: "3 open tasks from today to check off", "Working on X · for 12m".
- Errors say what failed and what to do: "Couldn't add task. Something went wrong on our end. Give it another try."
- Status goes inline: " · Due", " · Overdue", " · Demo".
- No emojis, no exclamation-heavy hype, no filler subtitles.

---

## 9. Before you ship a screen

- [ ] Is anything a card inside a card? Flatten it.
- [ ] Any uppercase eyebrow labels, or labels floating in extra space? Remove or restyle as a section title.
- [ ] Does every subtitle carry information the title doesn't? If not, delete it.
- [ ] Does every border have a functional reason? If not, remove it or replace it with a soft shadow.
- [ ] Is there exactly one Fraunces headline, with light Outfit around it? Are there three text styles or fewer?
- [ ] Is all padding on the 4px grid?
- [ ] Does it look right in both light and dark mode?
- [ ] Does it reuse the existing components from section 6?
- [ ] Does desktop match mobile's structure and values?
- [ ] Any emojis? Remove them.
- [ ] Does every tap respond instantly? Are transitions quiet?
- [ ] For new visual problems: did you check how strong apps solve it (Mobbin) before improvising?
