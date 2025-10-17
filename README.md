Calendar Blocker (Web + Server)

What it does
- Upload weekly calendar photos/screenshots
- OCR + parse time ranges per weekday
- Create "Blocked - Work" events in Google Calendar

Folders
- `server/`: Node/Express API, Google OAuth + Calendar, OCR (Tesseract)
- `web/`: Vite + React web UI (mobile-friendly, works on phone browsers)

Prereqs
- Node.js 18+
- A Google Cloud OAuth2 Client (Web app)
  - Authorized redirect URI: `http://localhost:4000/auth/google/callback`

Setup
1) Server env
   - Copy `server/.env.example` to `server/.env` and fill values:
     - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
     - `SESSION_SECRET` (random string)
     - `ALLOWED_ORIGIN=http://localhost:5173`
     - `DEFAULT_TIMEZONE` e.g., `America/Los_Angeles`
2) Install deps and run
   - In `server/`: `npm i` then `npm run dev`
   - In `web/`: `npm i` then `npm run dev`

Usage
1) Visit `http://localhost:5173` in your browser (desktop or phone on same network with port forwarding)
2) Click "Connect Google" and complete consent
3) Select the Monday of the week you’re blocking
4) Upload 1–10 clear images of your weekly schedule
5) Review detected blocks and click "Create Calendar Blocks"

Notes
- OCR is heuristic. Use weekday headers (Mon/Tue/…) and times like `9-5`, `9am-5pm`, `10:30-2:15pm`.
- The app only creates events titled "Blocked - Work" with private visibility and no other details.
- Timezone defaults to your browser’s; override if needed.
- You can change target calendar by sending `calendarId` in the block request; UI currently uses primary.

Next steps (optional)
- Add native wrapper (Capacitor/Expo) to ship as installable mobile app
- Improve OCR with Google Cloud Vision for higher accuracy
- Add manual correction UI for parsed blocks before creating events
- Persist tokens securely (e.g., DB + user accounts) instead of session-only

