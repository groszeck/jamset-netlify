const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const client = require('../neonClient')

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET environment variable')
}

const TOKEN_NAME = 'token'
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days
const isProduction = process.env.NODE_ENV === 'production'
const secureFlag = isProduction ? 'Secure;' : ''

async function signup(event) {
  try {
    const { email, password } = JSON.parse(event.body || '{}')
    if (!email || !password) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Email and password required' })
      }
    }
    const exists = await client.query('SELECT id FROM users WHERE email = $1', [email])
    if (exists.rows.length) {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'User already exists' })
      }
    }
    const password_hash = await bcrypt.hash(password, 10)
    const result = await client.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role',
      [email, password_hash]
    )
    const user = result.rows[0]
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: MAX_AGE })
    const cookie = `${TOKEN_NAME}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; ${secureFlag} SameSite=Lax`
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie
      },
      body: JSON.stringify({ user: { id: user.id, email: user.email, role: user.role } })
    }
  } catch (error) {
    console.error('Signup error:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

async function login(event) {
  try {
    const { email, password } = JSON.parse(event.body || '{}')
    if (!email || !password) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Email and password required' })
      }
    }
    const res = await client.query(
      'SELECT id, password_hash, email, role FROM users WHERE email = $1',
      [email]
    )
    if (!res.rows.length) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid credentials' })
      }
    }
    const user = res.rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid credentials' })
      }
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: MAX_AGE })
    const cookie = `${TOKEN_NAME}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; ${secureFlag} SameSite=Lax`
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie
      },
      body: JSON.stringify({ user: { id: user.id, email: user.email, role: user.role } })
    }
  } catch (error) {
    console.error('Login error:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

async function logout() {
  try {
    const cookie = `${TOKEN_NAME}=; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; ${secureFlag} SameSite=Lax`
    return {
      statusCode: 204,
      headers: { 'Set-Cookie': cookie }
    }
  } catch (error) {
    console.error('Logout error:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

async function getSession(event) {
  try {
    const cookieHeader = event.headers.cookie || ''
    const match = cookieHeader
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith(`${TOKEN_NAME}=`))
    if (!match) return null
    const token = match.split('=')[1]
    const payload = jwt.verify(token, JWT_SECRET)
    if (!payload || !payload.userId) return null
    const res = await client.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [payload.userId]
    )
    if (!res.rows.length) return null
    return res.rows[0]
  } catch (error) {
    console.error('getSession error:', error)
    return null
  }
}

exports.handler = async (event) => {
  const path = (event.path || '').toLowerCase()
  const method = event.httpMethod
  if (method === 'POST' && path.endsWith('/signup')) {
    return signup(event)
  }
  if (method === 'POST' && path.endsWith('/login')) {
    return login(event)
  }
  if (method === 'POST' && path.endsWith('/logout')) {
    return logout()
  }
  if (method === 'GET' && path.endsWith('/session')) {
    const session = await getSession(event)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: session })
    }
  }
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Not found' })
  }
}