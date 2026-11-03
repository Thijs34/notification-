import { useEffect, useState } from 'react';
import { api, device, installApp, urlBase64ToUint8Array } from './push.js';

export default function Receiver() {
  const [subscription, setSubscription] = useState(null);
  const [permission, setPermission] = useState(
    device.pushSupported ? Notification.permission : 'unsupported',
  );
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  // Already subscribed earlier? Show the "on" state and keep the server list in sync.
  useEffect(() => {
    if (!device.pushSupported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!sub) return;
        setSubscription(sub);
        saveOnServer(sub);
      })
      .catch(() => {});
  }, []);

  function saveOnServer(sub) {
    api('/api/subscribe', {
      method: 'POST',
      body: { subscription: sub, name: device.platform, platform: device.platform },
    }).catch(() => {});
  }

  async function install() {
    setMessage('');
    const outcome = await installApp();
    if (outcome === 'accepted') {
      setInstalled(true);
      setMessage('Installed. Open Push Test from your home screen.');
    } else if (outcome === 'unavailable') {
      setMessage('Tap ⋮ at the top right in Chrome, then “Install app”.');
    }
  }

  async function allow() {
    setBusy(true);
    setMessage('');
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return;
      const [reg, { publicKey }] = await Promise.all([
        navigator.serviceWorker.ready,
        api('/api/vapid-public-key'),
      ]);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      setSubscription(sub);
      saveOnServer(sub);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage('Arriving in 5 seconds. You can lock your phone.');
    try {
      await api('/api/send', {
        method: 'POST',
        body: { subscription, delay: 5, title: 'Push Test', body: 'Your notifications work.' },
      });
    } catch (err) {
      // No status = the phone paused the app while waiting; the push still goes out.
      if (err.status === 410) {
        await subscription.unsubscribe().catch(() => {});
        setSubscription(null);
      }
      if (err.status) setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    const { endpoint } = subscription;
    await subscription.unsubscribe().catch(() => {});
    setSubscription(null);
    setMessage('');
    api('/api/unsubscribe', { method: 'POST', body: { endpoint } }).catch(() => {});
  }

  let content;

  if (device.isIOS && !device.isStandalone) {
    content = (
      <>
        <h2>Add to Home Screen</h2>
        <p className="muted">iPhone only allows notifications for apps on the Home Screen.</p>
        <ol className="steps">
          <li>
            Tap <ShareIcon /> <b>Share</b> in Safari (on iOS 26: <b>•••</b> → <b>Share</b>)
          </li>
          <li>
            Tap <b>Add to Home Screen</b>
          </li>
          <li>
            Open <b>Push Test</b> from your Home Screen
          </li>
        </ol>
      </>
    );
  } else if (!device.pushSupported) {
    content = (
      <p className="muted">
        This browser can’t receive notifications. Open this page in Chrome on Android or Safari on
        iPhone.
      </p>
    );
  } else if (subscription) {
    content = (
      <>
        <h2>Notifications are on</h2>
        <button className="btn primary" onClick={sendTest} disabled={busy}>
          Send test notification
        </button>
        <button className="link" onClick={turnOff} disabled={busy}>
          Turn off
        </button>
      </>
    );
  } else {
    const showInstall = device.isAndroid && !device.isStandalone && !installed;
    content = (
      <>
        {showInstall && (
          <button className="btn primary" onClick={install}>
            Install app
          </button>
        )}
        <button
          className={`btn ${showInstall ? 'secondary' : 'primary'}`}
          onClick={allow}
          disabled={busy || permission === 'denied'}
        >
          Allow notifications
        </button>
        {permission === 'denied' && (
          <p className="muted">
            Notifications are blocked. Allow them for Push Test in your phone’s settings.
          </p>
        )}
      </>
    );
  }

  return (
    <div className="panel">
      {content}
      {message && <p className="message">{message}</p>}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M12 3v12M7.5 7.5 12 3l4.5 4.5M7 10H5.5A1.5 1.5 0 0 0 4 11.5v8A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
