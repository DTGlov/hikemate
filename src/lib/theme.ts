// Design tokens — single source of truth for fonts, sizes, spacing, colors.
// Don't introduce hardcoded values in components. Add a token here first.
//
// Phase 9.1 lift: lock these values now so Phase 9's polish pass builds
// on top of them. New components MUST reference these instead of magic
// numbers; legacy components are being migrated incrementally.

export const fontFamily = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  bold: 'Geist_700Bold',
} as const;

/**
 * Locked type scale — 8 sizes, no others. If a design needs something
 * else, round to the nearest token rather than expanding the scale.
 */
export const fontSize = {
  caption: 11,
  small: 12,
  body: 14,
  bodyLarge: 16,
  subheading: 18,
  heading3: 22,
  heading2: 28,
  display: 36,
} as const;

/** Paired line heights for the type scale. */
export const lineHeight = {
  caption: 16,
  small: 16,
  body: 20,
  bodyLarge: 24,
  subheading: 26,
  heading3: 30,
  heading2: 36,
  display: 44,
} as const;

/** 4-point spacing grid. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Corner radii. Bumped from the previous scale (8/12/16) to feel more
 * modern; pill stays at 999 for fully rounded shapes.
 */
export const radius = {
  sm: 12, // buttons, input fields, small chips
  md: 16, // cards, surfaces, list rows
  lg: 20, // modals, sheets, hero containers
  pill: 999, // fully rounded pills (FABs, segmented controls, badges)
} as const;

/**
 * Color tokens. Brand teal stays `#0f766e`; the new `border` / `surface`
 * values support the Phase 9.1 "subtle 1px border on every card" pattern.
 * Use rgba so borders adapt to whatever background sits beneath them.
 */
export const colors = {
  brand: '#0f766e',
  brandActive: '#0e6b63',
  amber: '#fbbf24',
  danger: '#dc2626',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: 'rgba(0, 0, 0, 0.08)',
  borderStrong: 'rgba(0, 0, 0, 0.16)',
  borderOnDark: 'rgba(255, 255, 255, 0.12)',
  divider: '#f3f4f6',
  surface: '#ffffff',
  surfaceElevated: '#fafafa',
  surfaceMuted: '#f3f4f6',
} as const;

/** Convenience helper for `Text` style objects: pairs size + line height. */
export function textStyle(
  size: keyof typeof fontSize,
  weight: keyof typeof fontFamily = 'regular',
): { fontSize: number; lineHeight: number; fontFamily: string } {
  return {
    fontSize: fontSize[size],
    lineHeight: lineHeight[size],
    fontFamily: fontFamily[weight],
  };
}
