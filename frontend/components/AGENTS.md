# components — Agent Guide

Shared, theme-aware UI components organized by domain (`cards/`, `inputs/`, `modals/`, `profile/`, `task/`, `daily/`, …).

## Key files
- `ThemedText.tsx` — semantic text component. 15+ `type`s (`default`, `heading`, `titleFraunces`, `subtitle`, `caption`, `hero`, …) with font/weight/size pre-baked. **Use these instead of inline font styles.**
- `ThemedView.tsx` — View with theme background; `noFlex`, `keyboardAvoiding` props.
- `types.ts` — shared component types (Priority, TaskItem, …).
- `cards/`, `inputs/` (e.g. `PrimaryButton`, `ThemedInput`), `modals/` (`@gorhom/bottom-sheet`).

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
