import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.takaapps.kabuana',
  appName: 'かぶあな',
  webDir: 'out',
  server: {
    // 本番サーバーURL（Vercel）
    url: 'https://kabu-ana.com',
    cleartext: false  // HTTPSのみ使用
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#ffffff'
  }
};

export default config;
