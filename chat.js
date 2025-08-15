const API_BASE = '/api'

export async function sendMessage(conversationId, userId, content, { signal } = {}) {
  const res = await fetch(`${API_BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, userId, content }),
    signal
  })
  if (!res.ok) throw new Error(`sendMessage failed: ${res.status} ${res.statusText}`)
  return await res.json()
}

export async function fetchMessages(conversationId, { limit = 100, before, signal } = {}) {
  const params = new URLSearchParams({ conversationId, limit: limit.toString() })
  if (before) params.append('before', before)
  const res = await fetch(`${API_BASE}/fetchMessages?${params.toString()}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    signal
  })
  if (!res.ok) throw new Error(`fetchMessages failed: ${res.status} ${res.statusText}`)
  return await res.json()
}

export function onNewMessage(conversationId, callback, onError) {
  const params = new URLSearchParams({ conversationId })
  const source = new EventSource(`${API_BASE}/streamMessages?${params.toString()}`)

  source.addEventListener('message', e => {
    try {
      const data = JSON.parse(e.data)
      callback(data)
    } catch (err) {
      if (onError) onError(err)
    }
  })

  source.addEventListener('error', e => {
    source.close()
    if (onError) onError(e)
  })

  return () => {
    source.close()
  }
}