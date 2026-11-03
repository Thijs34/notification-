import { SUBS_KEY, deviceId, getRedis, httpError, route } from './_lib/shared.js';

// POST { endpoint } -> removes the device from the list.
export default route(['POST'], async (req, res) => {
  const { endpoint } = req.body || {};
  if (typeof endpoint !== 'string' || !endpoint) throw httpError(400, 'Missing endpoint.');

  const redis = getRedis();
  if (redis) await redis.hdel(SUBS_KEY, deviceId(endpoint));
  res.status(200).json({ ok: true });
});
