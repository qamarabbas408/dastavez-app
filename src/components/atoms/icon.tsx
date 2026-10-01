/**
 * Cross-platform icon.
 *
 * `expo-symbols` renders SF Symbols on iOS and Material Symbols on Android
 * from a single declaration, and ships with Expo Go — no icon font, no
 * development build, and no third-party dependency.
 *
 * Each icon is declared once with a semantic name. Adding an icon means adding
 * one entry here rather than branching at call sites. Both symbol names are
 * validated by the compiler: the `ios` and `android` keys are checked against
 * the symbol catalogues in `expo-symbols`, so a typo is a type error rather
 * than a blank gap at runtime.
 */

import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

import { useTheme } from '@/hooks/use-theme';

/**
 * `ios` is the SF Symbol, `android` the Material Symbol. The pairs are chosen
 * to look alike, not just to share a meaning, so the platforms read as one app.
 */
const ICONS = {
  camera: { ios: 'camera.fill', android: 'photo_camera' },
  folder: { ios: 'folder.fill', android: 'folder_open' },
  gear: { ios: 'gearshape.fill', android: 'settings' },
  search: { ios: 'magnifyingglass', android: 'search' },
  trash: { ios: 'trash.fill', android: 'delete' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  document: { ios: 'doc.text.fill', android: 'description' },
  close: { ios: 'xmark', android: 'close' },
  'chevron-left': { ios: 'chevron.left', android: 'arrow_back' },
  'chevron-right': { ios: 'chevron.right', android: 'arrow_forward' },
  plus: { ios: 'plus', android: 'add' },
  pencil: { ios: 'pencil', android: 'edit' },
  rotate: { ios: 'rotate.right', android: 'rotate_right' },
  crop: { ios: 'crop', android: 'crop' },
  filter: { ios: 'camera.filters', android: 'photo_filter' },
  text: { ios: 'text.viewfinder', android: 'text_fields' },
  check: { ios: 'checkmark', android: 'check' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning' },
  info: { ios: 'info.circle.fill', android: 'info' },
  lock: { ios: 'lock.fill', android: 'lock' },
  flash: { ios: 'bolt.fill', android: 'flash_on' },
  eye: { ios: 'eye.fill', android: 'visibility' },
  flip: { ios: 'arrow.triangle.2.circlepath', android: 'sync' },
  scan: { ios: 'viewfinder', android: 'crop_free' },
  image: { ios: 'photo', android: 'image' },
  card: { ios: 'creditcard.fill', android: 'credit_card' },
  grid: { ios: 'square.grid.2x2.fill', android: 'apps' },
  home: { ios: 'house.fill', android: 'home' },
} as const satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

export type AppIconProps = {
  name: IconName;
  size?: number;
  /** Defaults to the theme foreground colour. */
  color?: string;
  style?: React.ComponentProps<typeof SymbolView>['style'];
  /**
   * Decorative by default, so screen readers skip it. Pass a label when the
   * icon is the only content of a control.
   */
  accessibilityLabel?: string;
};

export function AppIcon({ name, size = 20, color, style, accessibilityLabel }: AppIconProps) {
  const theme = useTheme();
  const glyph = ICONS[name];
  const decorative = accessibilityLabel === undefined;

  return (
    <SymbolView
      name={{ ios: glyph.ios, android: glyph.android }}
      size={size}
      tintColor={color ?? theme.text}
      style={style}
      {...(decorative
        ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const }
        : { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel })}
    />
  );
}
