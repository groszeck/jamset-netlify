const { query } = require('../neonClient')

async function sendNotification(userId, message) {
  try {
    const { rows } = await query(
      `INSERT INTO notifications(user_id, message, sent_at, created_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING *`,
      [userId, message]
    )
    return rows[0]
  } catch (error) {
    console.error('sendNotification error', { userId, message, error })
    throw new Error('Failed to send notification')
  }
}

async function scheduleNotification(userId, message, time) {
  if (!time) {
    throw new Error('scheduleNotification failed: time parameter is required')
  }
  const date = new Date(time)
  if (isNaN(date.getTime())) {
    throw new Error(`scheduleNotification failed: invalid time parameter: ${time}`)
  }
  const scheduledAt = date.toISOString()
  try {
    const { rows } = await query(
      `INSERT INTO notifications(user_id, message, scheduled_at, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [userId, message, scheduledAt]
    )
    return rows[0]
  } catch (error) {
    console.error('scheduleNotification error', { userId, message, scheduledAt, error })
    throw new Error('Failed to schedule notification')
  }
}

async function getUserNotifications(userId) {
  try {
    const { rows } = await query(
      `SELECT *
       FROM notifications
       WHERE user_id = $1
       ORDER BY COALESCE(scheduled_at, created_at) DESC`,
      [userId]
    )
    return rows
  } catch (error) {
    console.error('getUserNotifications error', { userId, error })
    throw new Error('Failed to retrieve user notifications')
  }
}

module.exports = {
  sendNotification,
  scheduleNotification,
  getUserNotifications
}