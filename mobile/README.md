Calendar Blocker – Mobile Wrapper (Capacitor)

This wraps the existing web app for Android/iOS. It loads the Vite dev server in development and the built web assets for production.

Prereqs
- Android Studio (for Android) / Xcode (for iOS)
- Node 18+

Dev (live reload from Vite)
1) Start API server (in `server/`):
   - `npm run dev`
   - Ensure `ALLOWED_ORIGIN` in `server/.env` includes `http://<LAN_IP>:5173`
2) Start web app with LAN host (in `web/`):
   - `npm run dev -- --host`
   - Note the URL, e.g., `http://192.168.1.10:5173`
3) Configure Capacitor dev URL (in `mobile/capacitor.config.ts`):
   - Set `server.url` to the Vite URL from step 2
4) Install deps and add platform (in `mobile/`):
   - `npm i`
   - `npm run cap:add:android` (and/or `npm run cap:add:ios`)
5) Run on device/emulator:
   - `npm run cap:run:android` (or open with `npm run cap:open:android` and press run)

Production build
1) Build web assets: `npm run build:web`
2) Sync to native: `npm run cap:sync`
3) Open native project and build: `npm run cap:open:android` or `npm run cap:open:ios`

Notes
- The server CORS allows `capacitor://localhost` by default and any origins in `ALLOWED_ORIGIN`.
- Google OAuth redirect must be reachable on mobile; for LAN testing set `GOOGLE_REDIRECT_URI` to use your machine’s LAN IP and add it to OAuth client authorized redirect URIs.
- On-device camera works via the web `<input type="file" accept="image/*">` control.

