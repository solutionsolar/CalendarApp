import { CapacitorConfig } from '@capacitor/cli';

// During dev you can point to your Vite dev server below.
// Replace <LAN_IP> with your machine's LAN IP (e.g., 192.168.1.10)
// And start the web app with: npm run dev -- --host
const config: CapacitorConfig = {
  appId: 'com.example.calendarblocker',
  appName: 'Calendar Blocker',
  webDir: '../web/dist',
  server: {
    url: 'http://<LAN_IP>:5173',
    cleartext: true
  }
};

export default config;

