import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // iOSのBundle Identifierと揃える（iOSリリース準備）
  appId: 'com.takaapps.kabunavi',
  appName: 'Kabuana',
  webDir: 'out'
};

export default config;
