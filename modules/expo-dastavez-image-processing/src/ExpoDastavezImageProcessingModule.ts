// Expo Modules Core loader for React Native / iOS / Android runtimes
let nativeModule: any = null;

try {
  // In native Expo apps, expo-modules-core provides requireNativeModule
  const globalAny = globalThis as any;
  if (globalAny.expo?.modules?.ExpoDastavezImageProcessing) {
    nativeModule = globalAny.expo.modules.ExpoDastavezImageProcessing;
  }
} catch {
  nativeModule = null;
}

export default nativeModule;
