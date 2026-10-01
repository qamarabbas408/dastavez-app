/**
 * Design tokens for Dastavez. The visual direction is calm and official:
 * restrained colour, generous spacing, and text that stays legible when the
 * user increases their font size.
 *
 * Every interactive control must be at least `touchTarget.min` tall. Do not
 * set fixed heights on anything that contains text, or large-text users will
 * get clipping.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#11151B',
    background: '#FFFFFF',
    backgroundElement: '#F2F4F7',
    backgroundSelected: '#E4E9F0',
    textSecondary: '#58616E',
    /** Calm, desaturated blue. Contrast on white is 6.9:1. */
    accent: '#1B4F8C',
    accentText: '#FFFFFF',
    accentSoft: '#E8EFF8',
    border: '#D3DAE3',
    danger: '#A32020',
    dangerSoft: '#FBEAEA',
    warning: '#8A5A00',
    warningSoft: '#FDF3E2',
    success: '#1B6B3A',
    /** Mock viewfinder / camera chrome. */
    viewfinder: '#0B0F14',
  },
  dark: {
    text: '#F2F5F8',
    background: '#0C1015',
    backgroundElement: '#181D24',
    backgroundSelected: '#242B34',
    textSecondary: '#A7B0BD',
    accent: '#7FB0E8',
    accentText: '#0C1015',
    accentSoft: '#16273C',
    border: '#2C343E',
    danger: '#F08A8A',
    dangerSoft: '#3A1D1D',
    warning: '#E8B563',
    warningSoft: '#33280F',
    success: '#74C99A',
    viewfinder: '#05070A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
});

/**
 * Minimum tappable size. 44pt is Apple's guidance, 48dp is Material's;
 * we use 48 on both so controls match across platforms.
 */
export const touchTarget = { min: 48 } as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 6,
  medium: 10,
  large: 16,
  pill: 999,
} as const;

/**
 * Horizontal page padding. Screens should not exceed `MaxContentWidth` so text
 * does not stretch to unreadable line lengths on tablets and foldables.
 */
export const MaxContentWidth = 640;

/**
 * Height of the tab bar's content area, excluding the home indicator. Add the
 * safe-area bottom inset to position anything above the tab bar: on a notched
 * iPhone the inset is the rest of the bar's height, so omitting it lets a
 * floating control sit inside the bar.
 */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;