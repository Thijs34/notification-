import { httpError, route } from './_lib/shared.js';

// GET -> { publicKey } so the browser can create a push subscription.
export default route(['GET'], (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) throw httpError(500, 'VAPID_PUBLIC_KEY is not configured on the server (see README).');
  res.status(200).json({ publicKey });
});
