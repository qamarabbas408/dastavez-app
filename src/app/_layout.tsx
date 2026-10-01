/**
 * Root layout: gesture root, safe areas, theme, store, and the top-level stack.
 *
 * The first-launch redirect is not done here. Deciding the entry route in this
 * file would need an effect, which flashes the wrong screen on launch and trips
 * the `react-hooks/set-state-in-effect` lint rule. Instead `src/app/index.tsx`
 * renders a `<Redirect>` derived from store state, so the correct route is
 * chosen during the first render.
 *
 * Task screens (scan, import, edit, document) are declared here rather than
 * inside `(tabs)`, so they push above the tab bar and Back returns to the tabs.
 */

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { StoreProvider } from '@/store/store';

export default function RootLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
          <StoreProvider>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Stack
              screenOptions={{
                headerShown: false,
                // Matches the app background so switching between screens and
                // launching into a dark task screen does not flash white.
                contentStyle: { backgroundColor: colors.background },
              }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="scan/capture-preview" />
              <Stack.Screen name="scan/page-review" />
              <Stack.Screen name="import/source" />
              <Stack.Screen name="import/picker" />
              <Stack.Screen name="edit-save" />
              <Stack.Screen name="document/[id]/view" />
              <Stack.Screen name="document/[id]/export-confirm" />
              <Stack.Screen name="document/[id]/share-handoff" />
            </Stack>
          </StoreProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
