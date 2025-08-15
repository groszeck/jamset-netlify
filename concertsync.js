const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const channels = new Map()
const CHANNEL_ID_REGEX = /^[a-zA-Z0-9_]+$/

export async function openSyncChannel(req, res) {
  const { channelId } = req.query
  if (!channelId || typeof channelId !== 'string' || !CHANNEL_ID_REGEX.test(channelId)) {
    res.status(400).send('Invalid or missing channelId')
    return
  }
  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.flushHeaders()
  } catch (err) {
    console.error('SSE setup error', err)
    res.status(500).end()
    return
  }
  let channel = channels.get(channelId)
  if (!channel) {
    let pgClient
    try {
      pgClient = createClient({ connectionString: process.env.DATABASE_URL })
      await pgClient.connect()
      await pgClient.query(`LISTEN "${channelId}"`)
    } catch (err) {
      console.error('Postgres LISTEN error', err)
      if (pgClient) {
        try { await pgClient.end() } catch (e) { console.error(e) }
      }
      res.status(500).end()
      return
    }
    pgClient.on('notification', msg => {
      let payload = null
      if (msg.payload) {
        try {
          payload = JSON.parse(msg.payload)
        } catch (e) {
          console.error('JSON parse error', e)
          return
        }
      }
      const data = JSON.stringify(payload)
      const message = `data: ${data}\n\n`
      channels.get(channelId).clients.forEach(clientRes => {
        clientRes.write(message)
      })
    })
    channel = { clients: [], pgClient }
    channels.set(channelId, channel)
  }
  channel.clients.push(res)
  req.on('close', async () => {
    try {
      channel.clients = channel.clients.filter(c => c !== res)
      if (channel.clients.length === 0) {
        try { await channel.pgClient.query(`UNLISTEN "${channelId}"`) } catch (e) { console.error('UNLISTEN error', e) }
        try { await channel.pgClient.end() } catch (e) { console.error('Client end error', e) }
        channels.delete(channelId)
      }
    } catch (e) {
      console.error('Cleanup error', e)
    }
  })
}

export async function broadcastSyncUpdate(req, res) {
  let channelId, data
  try {
    channelId = req.body?.channelId
    data = req.body?.data
  } catch {
    res.status(400).json({ error: 'Invalid request body' })
    return
  }
  if (!channelId || typeof channelId !== 'string' || !CHANNEL_ID_REGEX.test(channelId)) {
    res.status(400).json({ error: 'Invalid or missing channelId' })
    return
  }
  const payload = JSON.stringify(data)
  try {
    const queryText = `NOTIFY "${channelId}", $1`
    await pool.query(queryText, [payload])
    res.status(200).json({ success: true })
  } catch (err) {
    console.error('Postgres NOTIFY error', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function closeSyncChannel(req, res) {
  let channelId
  try {
    channelId = req.body?.channelId
  } catch {
    res.status(400).json({ error: 'Invalid request body' })
    return
  }
  if (!channelId || typeof channelId !== 'string' || !CHANNEL_ID_REGEX.test(channelId)) {
    res.status(400).json({ error: 'Invalid or missing channelId' })
    return
  }
  const channel = channels.get(channelId)
  if (!channel) {
    res.status(404).json({ error: 'Channel not found' })
    return
  }
  channel.clients.forEach(clientRes => {
    try { clientRes.end() } catch {}
  })
  try { await channel.pgClient.query(`UNLISTEN "${channelId}"`) } catch (err) { console.error('UNLISTEN error', err) }
  try { await channel.pgClient.end() } catch (err) { console.error('Client end error', err) }
  channels.delete(channelId)
  res.status(200).json({ success: true })
}