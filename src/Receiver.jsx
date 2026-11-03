import { useEffect, useState } from 'react';
import { api, device, urlBase64ToUint8Array } from './push.js';

const DELAY_SECONDS = 5;

export default function Receiver() {
  const [registration, setRegistration] = useState(null);
  const [publicKey, setPublicKey] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [permission, setPermission] = useState(
    device.pushSupported ? Notification.permission : 'unsupported',
  );
  const [name, setName] = useState(() => localStorage.getItem('deviceName') || device.platform);
  const [storedOnServer, setStoredOnServer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);

  // Load the service worker, any existing subscription, and the server's public key.
  // Done up front so the "Enable" tap can go straight to the permission prompt (iOS needs that).
  useEffect(() => {
    if (!device.pushSupported) return;
    let cancelled = false;

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (cancelled) return;
      setRegistration(reg);
      setSubscription(sub);
      if (sub) saveOnServer(sub, name); // keep the server's device list in sync
    });

    api('/api/vapid-public-key')
      .then((data) => !cancelled && setPublicKey(data.publicKey))
      .catch((err) => !cancelled && setStatus({ type: 'error', text: err.message }));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Android/Chrome: offer an "Install app" button (optional there, push works in the browser too).
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function saveOnServer(sub, deviceName) {
    try {
      const { stored } = await api('/api/subscribe', {
        method: 'POST',
        body: { subscription: sub, name: deviceName, platform: device.platform },
      });
      setStoredOnServer(stored);
    } catch {
      setStoredOnServer(false);
    }
  }

  async function enable() {
    setBusy(true);
    setStatus(null);
    try {
      // Ask for permission first, straight from the tap. iOS ignores it otherwise.
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        throw new Error(
          result === 'denied'
            ? 'Notifications are blocked. See the instructions above to allow them.'
            : 'The permission prompt was dismissed. Tap the button to try again.',
        );
      }
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      setSubscription(sub);
      await saveOnServer(sub, name);
      setStatus({ type: 'ok', text: 'Notifications are on. Send yourself a test below.' });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setStatus(null);
    try {
      const { endpoint } = subscription;
      await subscription.unsubscribe();
      setSubscription(null);
      setStoredOnServer(null);
      await api('/api/unsubscribe', { method: 'POST', body: { endpoint } }).catch(() => {});
      setStatus({ type: 'info', text: 'Notifications turned off for this device.' });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest(delay) {
    setBusy(true);
    setStatus({
      type: 'info',
      text: delay
        ? `Push arrives in ${delay} seconds. Lock your phone or go to the home screen now!`
        : 'Sending…',
    });
    try {
      await api('/api/send', {
        method: 'POST',
        body: {
          subscription,
          delay,
          title: 'It works! 🎉',
          body: `Test push to ${name} (requested at ${new Date().toLocaleTimeString()})`,
        },
      });
      setStatus({ type: 'ok', text: 'Push sent. The notification should appear now.' });
    } catch (err) {
      if (err.status === 410) {
        await subscription.unsubscribe().catch(() => {});
        setSubscription(null);
        setStatus({ type: 'error', text: err.message });
      } else if (delay && !err.status) {
        // The phone suspended the page while we were waiting; the push was most likely still sent.
        setStatus({ type: 'info', text: 'The app was in the background. If you got the notification, it worked!' });
      } else {
        setStatus({ type: 'error', text: err.message });
      }
    } finally {
      setBusy(false);
    }
  }

  async function install() {
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  function onNameChange(e) {
    setName(e.target.value);
    localStorage.setItem('deviceName', e.target.value);
  }

  const ready = registration && publicKey;

  function renderMain() {
    // iOS: push only works inside a home-screen web app.
    if (device.isIOS && !device.isStandalone) {
      return (
        <>
          <h2>Step 1: Add to Home Screen</h2>
          <p>
            On iPhone and iPad, push notifications only work for web apps added to the home
            screen (iOS 16.4 or newer).
          </p>
          <ol className="steps">
            <li>
              Tap the <b>Share</b> button <ShareIcon /> in Safari. On iOS 26, tap <b>•••</b> first.
            </li>
            <li>
              Tap <b>Add to Home Screen</b>, then <b>Add</b>.
            </li>
            <li>
              Open <b>Push Test</b> from your home screen and tap <b>Enable notifications</b>.
            </li>
          </ol>
        </>
      );
    }

    if (!device.pushSupported) {
      return (
        <>
          <h2>Push not supported</h2>
          <p>
            {device.isIOS
              ? 'Update your device to iOS 16.4 or newer to receive web push notifications.'
              : 'This browser doesn’t support push notifications. Try Chrome on Android, or Safari on iOS 16.4+.'}
          </p>
        </>
      );
    }

    if (permission === 'denied') {
      return (
        <>
          <h2>Notifications are blocked</h2>
          {device.isIOS ? (
            <p>
              Open <b>Settings → Notifications → Push Test</b> and turn on <b>Allow Notifications</b>,
              then reopen the app.
            </p>
          ) : (
            <p>
              Tap the icon left of the address bar (or long-press the app icon → <b>App info</b>),
              open <b>Notifications</b>, allow them, and reload this page.
            </p>
          )}
        </>
      );
    }

    const nameField = (
      <label className="field">
        Device name (shown on the Send tab)
        <input
          value={name}
          maxLength={40}
          onChange={onNameChange}
          onBlur={() => subscription && saveOnServer(subscription, name)}
        />
      </label>
    );

    if (!subscription) {
      return (
        <>
          <h2>{device.isIOS ? 'Step 2: Enable notifications' : 'Enable notifications'}</h2>
          <p>
            {device.isIOS
              ? 'iOS only asks for permission after you tap the button below.'
              : 'Tap the button and allow notifications when your browser asks.'}
          </p>
          {nameField}
          <button className="btn primary" onClick={enable} disabled={!ready || busy}>
            {ready ? '🔔 Enable notifications' : 'Loading…'}
          </button>
          {installPrompt && (
            <button className="btn ghost" onClick={install}>
              Install as app (optional)
            </button>
          )}
        </>
      );
    }

    return (
      <>
        <h2>Notifications are on ✅</h2>
        {nameField}
        <div className="button-row">
          <button className="btn primary" onClick={() => sendTest(0)} disabled={busy}>
            Send test now
          </button>
          <button className="btn secondary" onClick={() => sendTest(DELAY_SECONDS)} disabled={busy}>
            Send in {DELAY_SECONDS}s
          </button>
        </div>
        <p className="hint">
          Tip: tap “Send in {DELAY_SECONDS}s” and lock your phone to see it on the lock screen. Or
          open this site on your PC and use the <b>Send</b> tab to type your own message.
        </p>
        <button className="btn ghost danger" onClick={disable} disabled={busy}>
          Turn off notifications
        </button>
      </>
    );
  }

  return (
    <>
      <section className="card">
        <h2>This device</h2>
        <ul className="checks">
          <Check label="Device" value={device.platform} />
          <Check
            label="Opened from home screen"
            value={device.isStandalone ? 'Yes' : 'No'}
            ok={device.isStandalone ? true : device.isIOS ? false : null}
          />
          <Check label="Push supported" value={device.pushSupported ? 'Yes' : 'No'} ok={device.pushSupported} />
          <Check
            label="Permission"
            value={permission}
            ok={permission === 'granted' ? true : permission === 'default' ? null : false}
          />
          <Check label="Subscribed" value={subscription ? 'Yes' : 'No'} ok={subscription ? true : null} />
          {subscription && (
            <Check
              label="Listed on Send tab"
              value={storedOnServer ? 'Yes' : storedOnServer === false ? 'No (no database)' : '…'}
              ok={storedOnServer}
            />
          )}
        </ul>
      </section>

      <section className="card">{renderMain()}</section>

      {status && <p className={`status ${status.type}`}>{status.text}</p>}
    </>
  );
}

function Check({ label, value, ok = null }) {
  const state = ok === true ? 'ok' : ok === false ? 'bad' : 'neutral';
  return (
    <li>
      <span className={`dot ${state}`} aria-hidden="true" />
      <span className="check-label">{label}</span>
      <span className="check-value">{value}</span>
    </li>
  );
}

function ShareIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 24 24" width="18" height="18" aria-label="Share icon">
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
