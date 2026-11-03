import {
  PUSH_OPTIONS,
  SUBS_KEY,
  buildPayload,
  deviceId,
  getRedis,
  getWebPush,
  httpError,
  isExpired,
  isValidSubscription,
  route,
} from './_lib/shared.js';

const MAX_DELAY_SECONDS = 10;

// POST { subscription, title, body, delay } -> pushes to that one subscription.
// Used by the phone's "send me a test" buttons. The optional delay gives you
// time to lock the phone / leave the app before the notification arrives.
export default route(['POST'], async (req, res) => {
  const { subscription, title, body, delay } = req.body || {};
  if (!isValidSubscription(subscription)) throw httpError(400, 'Invalid push subscription.');

  const webpush = getWebPush();
  const seconds = Math.min(Math.max(Number(delay) || 0, 0), MAX_DELAY_SECONDS);
  if (seconds) await new Promise((resolve) => setTimeout(resolve, seconds * 1000));

  try {
    await webpush.sendNotification(subscription, buildPayload({ title, body }), PUSH_OPTIONS);
  } catch (err) {
    if (isExpired(err)) {
      await getRedis()?.hdel(SUBS_KEY, deviceId(subscription.endpoint));
      throw httpError(410, 'This subscription has expired. Disable and re-enable notifications.');
    }
    throw httpError(502, `Push service rejected the message (${err.statusCode ?? 'network error'}): ${err.body || err.message}`);
  }
  res.status(200).json({ ok: true });
});
