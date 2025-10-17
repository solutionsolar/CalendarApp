import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events'
];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Google OAuth env vars');
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });
}

export async function handleOAuthCallback(req, code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  req.session.tokens = tokens;
}

export async function getCalendarClient(req) {
  const tokens = req.session.tokens;
  if (!tokens) throw new Error('Not authed');
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export function ensureAuthed(req, res, next) {
  if (req.session && req.session.tokens) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

