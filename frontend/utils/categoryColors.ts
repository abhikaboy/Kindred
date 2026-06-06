/**
 * Category color mapping utilities
 * Provides consistent color assignment and duotone styling for calendar events
 */

export const CATEGORY_COLORS = {
  red: {
    primary: '#ef4444',
    light: '#fee2e2',
    dark: '#dc2626',
  },
  green: {
    primary: '#22c55e',
    light: '#dcfce7',
    dark: '#16a34a',
  },
  blue: {
    primary: '#3b82f6',
    light: '#dbeafe',
    dark: '#2563eb',
  },
  yellow: {
    primary: '#eab308',
    light: '#fef9c3',
    dark: '#ca8a04',
  },
  purple: {
    primary: '#a855f7',
    light: '#f3e8ff',
    dark: '#9333ea',
  },
  orange: {
    primary: '#f97316',
    light: '#ffedd5',
    dark: '#ea580c',
  },
} as const;

export type CategoryColorName = keyof typeof CATEGORY_COLORS;

/**
 * Get a consistent color for a category based on its ID or name
 * Uses a simple hash to ensure the same category always gets the same color
 */
export function getCategoryColor(categoryId?: string, categoryName?: string): CategoryColorName {
  const colorKeys = Object.keys(CATEGORY_COLORS) as CategoryColorName[];

  // Use categoryId if available, otherwise fall back to categoryName
  const identifier = categoryId || categoryName || 'default';

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = ((hash << 5) - hash) + identifier.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  // Get positive index
  const index = Math.abs(hash) % colorKeys.length;
  return colorKeys[index];
}

export type ColorScheme = 'light' | 'dark';

/** Append an alpha channel to a 6-digit hex color (e.g. '#ef4444' + 0.3 → '#ef44444d'). */
function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

/**
 * Get duotone colors for a category.
 * In dark mode the pastel `light` fills wash out, so the chip `background`
 * becomes a translucent tint of the hue (~30% opacity) and `dark` (used for
 * borders/text/dots) brightens to the vivid `primary` so it stays legible.
 */
export function getCategoryDuotoneColors(
  categoryId?: string,
  categoryName?: string,
  scheme: ColorScheme = 'light'
) {
  const colorName = getCategoryColor(categoryId, categoryName);
  const colors = CATEGORY_COLORS[colorName];
  const isDark = scheme === 'dark';

  return {
    primary: colors.primary,
    // Pastel — kept in both modes for text drawn on a solid `primary` fill.
    light: colors.light,
    dark: isDark ? colors.primary : colors.dark,
    // Theme-aware chip fill.
    background: isDark ? withAlpha(colors.primary, 0.3) : colors.light,
    colorName,
  };
}
