import type { CapacitorConfig } from '@capacitor/cli';

// appId は Capacitor の識別子。Android の実際の applicationId (Google Play / IAP 検証用) は
// android/app/build.gradle の applicationId (= GOOGLE_PLAY_PACKAGE_NAME) を参照。
// 現状: app.vercel.kabu_9t7mdgybz_takamontas_projects.twa
const config: CapacitorConfig = {
  appId: 'com.takaapps.kabunavi',
  appName: 'kabuana',
  webDir: 'out'
};

export default config;
