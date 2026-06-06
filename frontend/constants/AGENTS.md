# constants — Agent Guide

App-wide config: theme colors, spacing, links, integrations, subscription settings.

## Key files
- `Colors.ts` — light/dark palettes with identical semantic slots (`text`, `background`, `primary`, `error`, `success`, `lightened`, …). Accessed via `useThemeColor()`; `initTheme()` switches mode.
- `subscription.ts` — `SUBSCRIPTIONS_ENABLED` flag (currently false → subscription UI hidden), product IDs, RevenueCat key, entitlement ID.
- `integrationDictionary.tsx` — name→{icon (Phosphor), url, app-only/browser flags} lookup; extend by adding entries.
- `spacing.ts` — responsive padding (% of viewport, computed at module load).
- `appLinks.ts`, `Icons.ts`, `kudos.ts`, `spotlightConfig.ts`.

## Conventions
- Export `as const` for literal type inference / autocomplete.
- Both theme objects must define the same slots so UI can index `Colors[theme].x`.

## Gotchas
- Don't pair gray on light-purple tints (design rule).
- `spacing.ts` reads `Dimensions` at module load — be mindful if screen size changes post-init.
- `Icons.ts` URLs are external hosts; they break if those hosts go down.
