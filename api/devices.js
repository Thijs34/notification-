import { SUBS_KEY, requireAdmin, requireRedis, route } from './_lib/shared.js';

// GET -> { devices: [{ id, name, platform, createdAt, updatedAt }] }
export default route(['GET'], async (req, res) => {
  requireAdmin(req);
  const redis = requireRedis();
  const all = (await redis.hgetall(SUBS_KEY)) || {};
  const devices = Object.entries(all)
    .map(([id, d]) => ({ id, name: d.name, platform: d.platform, createdAt: d.createdAt, updatedAt: d.updatedAt }))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  res.status(200).json({ devices });
});
