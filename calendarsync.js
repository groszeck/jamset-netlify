const { google } = require('googleapis')
const pool = require('../utils/neonClient')
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type'
}

function getOAuthClient() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
}

async function syncWithGoogleCalendar(userId) {
  if (!userId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Missing userId' })
    }
  }
  const oAuth2Client = getOAuthClient()
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: JSON.stringify({ userId })
  })
  return {
    statusCode: 302,
    headers: {
      ...CORS_HEADERS,
      Location: authUrl
    }
  }
}

async function handleCallback(event) {
  const qs = event.queryStringParameters || {}
  const code = qs.code
  const state = qs.state
  if (!code || !state) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Missing code or state' })
    }
  }
  let userId
  try {
    userId = JSON.parse(state).userId
  } catch {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Invalid state' })
    }
  }
  const oAuth2Client = getOAuthClient()
  const { tokens } = await oAuth2Client.getToken(code)
  const scopeString = Array.isArray(tokens.scope)
    ? tokens.scope.join(' ')
    : tokens.scope || ''
  await pool.query(
    `INSERT INTO google_tokens(user_id, access_token, refresh_token, scope, token_type, expiry_date)
     VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       scope = EXCLUDED.scope,
       token_type = EXCLUDED.token_type,
       expiry_date = EXCLUDED.expiry_date`,
    [
      userId,
      tokens.access_token,
      tokens.refresh_token,
      scopeString,
      tokens.token_type,
      tokens.expiry_date
    ]
  )
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ success: true })
  }
}

async function listEvents(userId) {
  if (!userId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Missing userId' })
    }
  }
  const res = await pool.query(
    'SELECT access_token, refresh_token, scope, token_type, expiry_date FROM google_tokens WHERE user_id = $1',
    [userId]
  )
  if (!res.rows.length) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'No tokens found' })
    }
  }
  const { access_token, refresh_token, scope, token_type, expiry_date } = res.rows[0]
  const oAuth2Client = getOAuthClient()
  oAuth2Client.setCredentials({ access_token, refresh_token, scope, token_type, expiry_date })
  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client })
  const eventsRes = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: 50,
    singleEvents: true,
    orderBy: 'startTime'
  })
  const events = eventsRes.data.items || []
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ events })
  }
}

exports.handler = async function(event) {
  try {
    const params = event.queryStringParameters || {}
    const action = params.action
    if (event.httpMethod === 'GET') {
      if (action === 'sync') {
        return await syncWithGoogleCalendar(params.userId)
      }
      if (action === 'callback') {
        return await handleCallback(event)
      }
      if (action === 'list') {
        return await listEvents(params.userId)
      }
    }
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Invalid request' })
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message })
    }
  }
}