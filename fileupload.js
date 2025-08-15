const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const Busboy = require('busboy')
const { v4: uuidv4 } = require('uuid')
const path = require('path')
const client = require('../neonClient')

const s3 = new S3Client({ region: process.env.AWS_REGION })
const BUCKET = process.env.AWS_S3_BUCKET
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10) // default 10MB

exports.handler = async (event, context) => {
  try {
    const user = context.clientContext && context.clientContext.user
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
    }
    const userId = user.sub || user.id || user.user_id

    switch (event.httpMethod) {
      case 'POST':
        return await uploadFile(event, userId)
      case 'GET':
        return await listFiles(userId)
      case 'DELETE':
        return await deleteFile(event, userId)
      default:
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) }
    }
  } catch (err) {
    console.error(err)
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) }
  }
}

function parseForm(event) {
  return new Promise((resolve, reject) => {
    const files = []
    const busboy = new Busboy({ headers: event.headers })
    busboy.on('file', (fieldname, fileStream, filename, encoding, mimetype) => {
      let fileSize = 0
      const buffers = []
      fileStream.on('data', chunk => {
        fileSize += chunk.length
        if (fileSize > MAX_FILE_SIZE) {
          reject(new Error('File too large'))
          fileStream.resume()
        } else {
          buffers.push(chunk)
        }
      })
      fileStream.on('end', () => {
        if (fileSize <= MAX_FILE_SIZE) {
          files.push({
            filename,
            mimetype,
            content: Buffer.concat(buffers),
            size: fileSize
          })
        }
      })
    })
    busboy.on('error', reject)
    busboy.on('finish', () => resolve(files))
    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body, 'utf8')
    busboy.end(body)
  })
}

async function uploadFile(event, userId) {
  let parsed
  try {
    parsed = await parseForm(event)
  } catch (err) {
    if (err.message === 'File too large') {
      return { statusCode: 413, body: JSON.stringify({ error: 'File exceeds maximum size' }) }
    }
    throw err
  }
  if (!parsed.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No files uploaded' }) }
  }
  const results = []
  for (const file of parsed) {
    // sanitize filename
    let base = path.basename(file.filename)
    base = base.replace(/[^a-zA-Z0-9._-]/g, '_')
    const key = `${userId}/${uuidv4()}-${base}`
    // upload to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: file.content,
        ContentType: file.mimetype
      })
    )
    // database transaction for versioning
    let insertRes
    try {
      await client.query('BEGIN')
      // lock on userId|filename to prevent race
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1 || '|' || $2))",
        [userId, base]
      )
      const versionRes = await client.query(
        'SELECT COALESCE(MAX(version),0) AS max FROM files WHERE user_id=$1 AND filename=$2',
        [userId, base]
      )
      const version = versionRes.rows[0].max + 1
      insertRes = await client.query(
        `INSERT INTO files (user_id, key, filename, mimetype, size, version, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW())
         RETURNING id, filename, mimetype, size, version, created_at`,
        [userId, key, base, file.mimetype, file.size, version]
      )
      await client.query('COMMIT')
    } catch (dbErr) {
      await client.query('ROLLBACK').catch(() => {})
      // cleanup orphaned S3 object
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
      } catch (delErr) {
        console.error('Failed to delete orphaned S3 object:', delErr)
      }
      throw dbErr
    }
    results.push(insertRes.rows[0])
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ files: results })
  }
}

async function listFiles(userId) {
  const res = await client.query(
    `SELECT id, filename, mimetype, size, version, created_at
     FROM files
     WHERE user_id=$1
     ORDER BY created_at DESC`,
    [userId]
  )
  return {
    statusCode: 200,
    body: JSON.stringify({ files: res.rows })
  }
}

async function deleteFile(event, userId) {
  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }
  const { fileId } = payload
  if (!fileId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'fileId is required' }) }
  }
  const res = await client.query(
    'SELECT key, user_id FROM files WHERE id=$1',
    [fileId]
  )
  if (!res.rowCount) {
    return { statusCode: 404, body: JSON.stringify({ error: 'File not found' }) }
  }
  const record = res.rows[0]
  if (record.user_id !== userId) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) }
  }
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: record.key
    })
  )
  await client.query('DELETE FROM files WHERE id=$1', [fileId])
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  }
}