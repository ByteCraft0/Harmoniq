import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bytecraft.harmoniqlite',
  appName: 'Harmoniq Lite',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    Preferences: {
      group: 'HarmoniqLitePreferences',
    },
  },
};

export default config;
