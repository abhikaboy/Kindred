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

/**
 * Get duotone colors for a category
 * Returns primary and light colors for duotone effect
 */
export function getCategoryDuotoneColors(categoryId?: string, categoryName?: string) {
  const colorName = getCategoryColor(categoryId, categoryName);
  const colors = CATEGORY_COLORS[colorName];

  return {
    primary: colors.primary,
    light: colors.light,
    dark: colors.dark,
    colorName,
  };
}
