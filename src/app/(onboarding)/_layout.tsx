/**
 * Onboarding stack: Welcome, then the mock unlock.
 *
 * Kept as its own group because the app locks independently of the tab
 * structure — a locked user should not be able to reach Settings.
 */

import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Back is not a gesture out of the lock screen: leaving the app locked
        // would show an empty document library.
        gestureEnabled: false,
      }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="unlock" />
    </Stack>
  );
}
