import { SUBS_KEY, clip, deviceId, getRedis, httpError, isValidSubscription, route } from './_lib/shared.js';

// POST { subscription, name, platform } -> stores the device so the PC can push to it.
// Works without Redis too (returns stored: false), so "send to myself" still works.
export default route(['POST'], async (req, res) => {
  const { subscription, name, platform } = req.body || {};
  if (!isValidSubscription(subscription)) throw httpError(400, 'Invalid push subscription.');

  const redis = getRedis();
  if (!redis) return res.status(200).json({ stored: false });

  const id = deviceId(subscription.endpoint);
  const existing = await redis.hget(SUBS_KEY, id);
  const now = new Date().toISOString();
  await redis.hset(SUBS_KEY, {
    [id]: {
      subscription,
      name: clip(name, 40) || 'Unnamed device',
      platform: clip(platform, 20) || 'Unknown',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    },
  });
  res.status(200).json({ stored: true, id });
});
