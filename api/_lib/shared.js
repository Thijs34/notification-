// Shared helpers for the API routes. Files/folders starting with "_" inside
// /api are not deployed as endpoints by Vercel.
import { createHash, timingSafeEqual } from 'node:crypto';
import webpush from 'web-push';
import { Redis } from '@upstash/redis';

export const SUBS_KEY = 'push-test:subscriptions';

// High urgency + short TTL: deliver right away or not at all (it's a demo).
export const PUSH_OPTIONS = { TTL: 120, urgency: 'high' };

let vapidConfigured = false;
export function getWebPush() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw httpError(500, 'VAPID keys are not configured on the server (see README).');
  }
  if (!vapidConfigured) {
    webpush.setVapidDetails(
      VAPID_SUBJECT || 'mailto:push-test@example.com',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
    );
    vapidConfigured = true;
  }
  return webpush;
}

let redis;
/** Returns a Redis client, or null when no database is connected. */
export function getRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis ??= new Redis({ url, token });
  return redis;
}

export function requireRedis() {
  const client = getRedis();
  if (!client) {
    throw httpError(
      503,
      'No Redis database connected. In Vercel: Storage → Upstash Redis → connect to this project, then redeploy.',
    );
  }
  return client;
}

/** If ADMIN_PASSWORD is set, the request must send it in the x-admin-password header. */
export function requireAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return;
  const given = String(req.headers['x-admin-password'] ?? '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw httpError(401, 'Wrong or missing password.');
  }
}

export function deviceId(endpoint) {
  return createHash('sha256').update(endpoint).digest('hex').slice(0, 16);
}

export function isValidSubscription(sub) {
  return (
    sub &&
    typeof sub.endpoint === 'string' &&
    sub.endpoint.startsWith('https://') &&
    typeof sub.keys?.p256dh === 'string' &&
    typeof sub.keys?.auth === 'string'
  );
}

export function clip(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

export function buildPayload({ title, body }) {
  return JSON.stringify({
    title: clip(title, 80) || 'Push Test',
    body: clip(body, 400),
    url: '/',
  });
}

/** Push services answer 404/410 when a subscription is gone for good. */
export function isExpired(err) {
  return err?.statusCode === 404 || err?.statusCode === 410;
}

export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

/** Wraps a handler: method check + uniform JSON error responses. */
export function route(methods, handler) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!methods.includes(req.method)) {
      res.setHeader('Allow', methods.join(', '));
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      await handler(req, res);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(err);
      res.status(status).json({ error: err.message || 'Server error' });
    }
  };
}
