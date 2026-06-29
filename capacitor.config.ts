import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chitraspanda.spandakotha',
  appName: 'Spanda Kotha',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
