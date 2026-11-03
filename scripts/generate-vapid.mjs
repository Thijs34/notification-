// Generates a VAPID key pair and writes it to .env.local (used by `vercel dev`).
// Copy the same values into your Vercel project's Environment Variables.
// Run with: npm run vapid
import { existsSync, writeFileSync } from 'node:fs';
import webpush from 'web-push';

const file = new URL('../.env.local', import.meta.url);
if (existsSync(file) && !process.argv.includes('--force')) {
  console.log('.env.local already exists. Re-run with --force to overwrite it.');
  console.log('Note: new keys invalidate every existing subscription.');
  process.exit(0);
}

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
writeFileSync(
  file,
  [
    `VAPID_PUBLIC_KEY=${publicKey}`,
    `VAPID_PRIVATE_KEY=${privateKey}`,
    'VAPID_SUBJECT=mailto:you@example.com',
    'ADMIN_PASSWORD=',
    '',
  ].join('\n'),
);
console.log('Wrote new VAPID keys to .env.local');
