/**
 * Home, All Documents, Tools, and Settings as native tabs.
 *
 * Native tabs are used rather than a JS tab bar because these are all genuine
 * top-level destinations, and the platform tab bar gives correct iOS and Android
 * behaviour for free (safe area, back behaviour, dynamic type).
 *
 * Icons are declared as an `sf` + `material` pair. Both render natively, so this
 * needs no icon font and no development build — it works in Expo Go.
 */

import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="house.fill" md={{ default: 'home', selected: 'home' }} />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="documents">
        <NativeTabs.Trigger.Icon
          sf="doc.text.fill"
          md={{ default: 'description', selected: 'description' }}
        />
        <NativeTabs.Trigger.Label>Documents</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tools">
        <NativeTabs.Trigger.Icon
          sf="square.grid.2x2.fill"
          md={{ default: 'apps', selected: 'apps' }}
        />
        <NativeTabs.Trigger.Label>Tools</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md={{ default: 'settings', selected: 'settings' }} />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
