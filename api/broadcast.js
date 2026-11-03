import {
  PUSH_OPTIONS,
  SUBS_KEY,
  buildPayload,
  getWebPush,
  httpError,
  isExpired,
  requireAdmin,
  requireRedis,
  route,
} from './_lib/shared.js';

// POST { title, body, ids? } -> pushes to the selected devices (or all when ids is omitted).
export default route(['POST'], async (req, res) => {
  requireAdmin(req);
  const redis = requireRedis();
  const webpush = getWebPush();

  const { title, body, ids } = req.body || {};
  if (!String(title ?? '').trim() && !String(body ?? '').trim()) {
    throw httpError(400, 'Type a title or a message first.');
  }

  const all = (await redis.hgetall(SUBS_KEY)) || {};
  let targets = Object.entries(all);
  if (Array.isArray(ids)) targets = targets.filter(([id]) => ids.includes(id));
  if (targets.length === 0) throw httpError(400, 'No devices selected.');

  const payload = buildPayload({ title, body });
  const results = await Promise.all(
    targets.map(async ([id, device]) => {
      try {
        await webpush.sendNotification(device.subscription, payload, PUSH_OPTIONS);
        return { id, name: device.name, ok: true };
      } catch (err) {
        if (isExpired(err)) {
          await redis.hdel(SUBS_KEY, id);
          return { id, name: device.name, ok: false, removed: true, error: 'Subscription expired, device removed.' };
        }
        return { id, name: device.name, ok: false, error: `${err.statusCode ?? 'network error'}: ${err.body || err.message}` };
      }
    }),
  );
  res.status(200).json({ results });
});
