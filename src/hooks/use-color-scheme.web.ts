import { useSyncExternalStore } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

function subscribe(onChange: () => void) {
  const subscription = Appearance.addChangeListener(onChange);
  return () => subscription.remove();
}

function getSnapshot(): ColorSchemeName {
  return Appearance.getColorScheme() ?? 'unspecified';
}

/**
 * On web the server has no access to the user's color scheme, so the first
 * client render must match the server's `light` default. `useSyncExternalStore`
 * handles the hydration handoff without a cascading setState render.
 */
export function useColorScheme(): ColorSchemeName {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'light');
}
