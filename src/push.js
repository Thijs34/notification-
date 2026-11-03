const ua = navigator.userAgent;
// iPadOS pretends to be a Mac; touch support gives it away.
const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
const isIOS = /iPad|iPhone|iPod/.test(ua) || isIPadOS;
const isAndroid = /Android/i.test(ua);

export const device = {
  isIOS,
  isAndroid,
  isMobile: isIOS || isAndroid,
  // True when launched from the home screen (required for push on iOS).
  isStandalone:
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true,
  // On iOS these APIs only exist inside a home-screen web app (iOS 16.4+).
  pushSupported: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
  platform: isIOS ? (/iPhone|iPod/.test(ua) ? 'iPhone' : 'iPad') : isAndroid ? 'Android' : 'Desktop',
};

// Android/Chrome install prompt. Caught at page load (before React renders).
// No preventDefault(), so Chrome can also show its own install popup.
let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  installEvent = e;
});

/** Opens Chrome's install dialog. Returns 'accepted', 'dismissed' or 'unavailable'. */
export async function installApp() {
  if (!installEvent) return 'unavailable';
  const e = installEvent;
  installEvent = null; // can only be used once
  e.prompt();
  const { outcome } = await e.userChoice;
  return outcome;
}

/** VAPID public keys are base64url strings; the Push API wants bytes. */
export function urlBase64ToUint8Array(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** Small fetch wrapper for our JSON API. Throws Error with .status on failure. */
export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try {
    data = JSON.parse(await res.text());
  } catch {
    throw Object.assign(new Error('Server not reachable.'), { status: res.status });
  }
  if (!res.ok) {
    throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  }
  return data;
}
