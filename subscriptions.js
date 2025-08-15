const pool = require('./neonclient');

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
};

function success(statusCode, data) {
  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(data || {})
  };
}

function failure(statusCode, message) {
  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ error: message })
  };
}

function getUserId(context) {
  const user = context.clientContext && context.clientContext.user;
  if (!user || !user.sub) {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
  return user.sub;
}

function parseInteger(value, name) {
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const err = new Error(`Invalid ${name}`);
    err.statusCode = 400;
    throw err;
  }
  return parsed;
}

async function ensurePlanExists(planId) {
  const res = await pool.query('SELECT id FROM plans WHERE id = $1', [planId]);
  if (res.rowCount === 0) {
    const err = new Error('Plan not found');
    err.statusCode = 404;
    throw err;
  }
}

async function createSubscription(event, context) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    const err = new Error('Invalid JSON body');
    err.statusCode = 400;
    throw err;
  }
  if (body.planId == null) {
    const err = new Error('Missing planId');
    err.statusCode = 400;
    throw err;
  }
  const planId = parseInteger(body.planId, 'planId');
  await ensurePlanExists(planId);
  const userId = getUserId(context);
  const insert = `
    INSERT INTO subscriptions (user_id, plan_id, status, created_at, updated_at)
    VALUES ($1, $2, 'active', NOW(), NOW())
    RETURNING id, user_id AS "userId", plan_id AS "planId", status, created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  const { rows } = await pool.query(insert, [userId, planId]);
  return success(201, rows[0]);
}

async function updateSubscription(event, context) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    const err = new Error('Invalid JSON body');
    err.statusCode = 400;
    throw err;
  }
  if (body.subscriptionId == null || body.planId == null) {
    const err = new Error('Missing subscriptionId or planId');
    err.statusCode = 400;
    throw err;
  }
  const subscriptionId = parseInteger(body.subscriptionId, 'subscriptionId');
  const planId = parseInteger(body.planId, 'planId');
  await ensurePlanExists(planId);
  const userId = getUserId(context);
  const checkSub = await pool.query(
    'SELECT id FROM subscriptions WHERE id = $1 AND user_id = $2',
    [subscriptionId, userId]
  );
  if (checkSub.rowCount === 0) {
    const err = new Error('Subscription not found');
    err.statusCode = 404;
    throw err;
  }
  const update = `
    UPDATE subscriptions
    SET plan_id = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING id, user_id AS "userId", plan_id AS "planId", status, created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  const { rows } = await pool.query(update, [planId, subscriptionId]);
  return success(200, rows[0]);
}

async function cancelSubscription(event, context) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    const err = new Error('Invalid JSON body');
    err.statusCode = 400;
    throw err;
  }
  if (body.subscriptionId == null) {
    const err = new Error('Missing subscriptionId');
    err.statusCode = 400;
    throw err;
  }
  const subscriptionId = parseInteger(body.subscriptionId, 'subscriptionId');
  const userId = getUserId(context);
  const check = await pool.query(
    'SELECT id, status FROM subscriptions WHERE id = $1 AND user_id = $2',
    [subscriptionId, userId]
  );
  if (check.rowCount === 0) {
    const err = new Error('Subscription not found');
    err.statusCode = 404;
    throw err;
  }
  if (check.rows[0].status === 'canceled') {
    const err = new Error('Subscription already canceled');
    err.statusCode = 400;
    throw err;
  }
  const update = `
    UPDATE subscriptions
    SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
    WHERE id = $1
    RETURNING id, user_id AS "userId", plan_id AS "planId", status, created_at AS "createdAt", canceled_at AS "canceledAt", updated_at AS "updatedAt"
  `;
  const { rows } = await pool.query(update, [subscriptionId]);
  return success(200, rows[0]);
}

async function getSubscriptionStatus(event, context) {
  const params = event.queryStringParameters || {};
  if (params.subscriptionId == null) {
    const err = new Error('Missing subscriptionId');
    err.statusCode = 400;
    throw err;
  }
  const subscriptionId = parseInteger(params.subscriptionId, 'subscriptionId');
  const userId = getUserId(context);
  const { rows } = await pool.query(
    `
      SELECT id, user_id AS "userId", plan_id AS "planId", status,
             created_at AS "createdAt", canceled_at AS "canceledAt", updated_at AS "updatedAt"
      FROM subscriptions
      WHERE id = $1 AND user_id = $2
    `,
    [subscriptionId, userId]
  );
  if (rows.length === 0) {
    const err = new Error('Subscription not found');
    err.statusCode = 404;
    throw err;
  }
  return success(200, rows[0]);
}

exports.handler = async (event, context) => {
  try {
    const method = event.httpMethod || '';
    if (method === 'OPTIONS') {
      return { statusCode: 204, headers: DEFAULT_HEADERS, body: '' };
    }
    switch (method) {
      case 'POST':
        return await createSubscription(event, context);
      case 'PUT':
        return await updateSubscription(event, context);
      case 'DELETE':
        return await cancelSubscription(event, context);
      case 'GET':
        return await getSubscriptionStatus(event, context);
      default:
        return {
          statusCode: 405,
          headers: {
            ...DEFAULT_HEADERS,
            Allow: 'GET,POST,PUT,DELETE,OPTIONS'
          },
          body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }
  } catch (err) {
    const code = err.statusCode || 500;
    const msg = err.message || 'Internal Server Error';
    return failure(code, msg);
  }
};