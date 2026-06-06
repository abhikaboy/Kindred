# components — Agent Guide

Shared, theme-aware UI components organized by domain (`cards/`, `inputs/`, `modals/`, `profile/`, `task/`, `daily/`, …).

## Key files
- `ThemedText.tsx` — semantic text component. 15+ `type`s (`default`, `heading`, `titleFraunces`, `subtitle`, `caption`, `hero`, …) with font/weight/size pre-baked. **Use these instead of inline font styles.**
- `ThemedView.tsx` — View with theme background; `noFlex`, `keyboardAvoiding` props.
- `types.ts` — shared component types (Priority, TaskItem, …).
- `cards/`, `inputs/` (e.g. `PrimaryButton`, `ThemedInput`), `modals/` (`@gorhom/bottom-sheet`).
- `task/WorkspacePager.tsx` — the task tab body (`react-native-pager-view`, one page per workspace, `offscreenPageLimit=1` so current ±1 stay mounted). Each page renders `task/WorkspaceContent.tsx`, which wraps its own `DragProvider`.
- `category.tsx` + `cards/TaskCard.tsx` — a `Category` registers its drop hit-rect (`measureInWindow`) and renders its task cards; a `TaskCard`'s long-press Pan gesture drives drag-to-move.

## Workspace rendering & drag-to-move
`(task)/index.tsx` → `WorkspacePager` → (per workspace) `WorkspaceContent` → `DragProvider` → `ScrollView` of `Category` → `TaskCard`. Long-press a card → after ~350ms a Pan gesture lifts it; moving it >10px drags between categories (drop via `dragContext.moveTask`); holding still ~1.2s instead opens the edit menu mid-press. See `contexts/AGENTS.md` (dragContext) and `utils/AGENTS.md` (dragHitTest).

## Conventions
- `const ThemedColor = useThemeColor()` then `ThemedColor.primary` (it's an object, not a function).
- Text: `<ThemedText type="subtitle" />`. Icons: `import { Plus } from "phosphor-react-native"` with `size`/`weight`.
- `PrimaryButton` variants: `ghost` / `outline` / `dottedOutline` / `secondary` / `lightened`.
- Borders use `ThemedColor.lightened`. Use `useSafeAreaInsets()` for edge padding.

## Gotchas
- Bottom-sheet modals need `PortalProvider` + `BottomSheetModalProvider` (set in root layout) or they render off-screen.
- Phosphor `weight="fill"` is ignored by icons without a fill variant.
- `Colors.ts` themes are compile-time (light/dark), no runtime custom themes.
- No render-helper functions inside components — extract a real component.
- **Drag is per-page: each `WorkspaceContent` has its own `DragProvider`/hit-rect map.** A drag only sees the categories on its own page, never another workspace's.
- **PagerView does not re-fire `onLayout` when it reveals an offscreen-mounted page**, so that page's hit-rects were empty/stale → drag silently did nothing (debug logs showed `lift … rects=0`, every drop `→ no-op`). Fix: `Category` re-measures on drag start (an `isDragging` effect), not just on layout. Don't remove that effect, and don't assume `onLayout` rects are current.
- **The drop-target highlight must not change layout.** It's an absolute overlay (behind tint + on-top purple border, `pointerEvents="none"`). Adding padding/border to the hovered `Category` instead grows it, shoves siblings, and re-stales their hit-rects mid-drag. A behind-the-cards overlay is also barely visible — keep the border as a top layer with `zIndex`.
