import { useEffect, useState } from 'react';
import { api } from './push.js';

export default function Sender() {
  const [password, setPassword] = useState(() => localStorage.getItem('adminPassword') || '');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [devices, setDevices] = useState([]);
  const [excluded, setExcluded] = useState(() => new Set()); // unchecked devices
  const [title, setTitle] = useState('Hello from my PC');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  const headers = (pw = password) => (pw ? { 'x-admin-password': pw } : {});

  async function loadDevices(pw = password) {
    try {
      const data = await api('/api/devices', { headers: headers(pw) });
      setDevices(data.devices);
      setNeedsPassword(false);
      setMessage('');
    } catch (err) {
      if (err.status === 401) setNeedsPassword(true);
      else setMessage(err.message);
    }
  }

  useEffect(() => {
    loadDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function unlock(e) {
    e.preventDefault();
    localStorage.setItem('adminPassword', password);
    loadDevices(password);
  }

  function toggle(id) {
    setExcluded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedIds = devices.filter((d) => !excluded.has(d.id)).map((d) => d.id);

  async function send(e) {
    e.preventDefault();
    setSending(true);
    setMessage('');
    try {
      const { results } = await api('/api/broadcast', {
        method: 'POST',
        headers: headers(),
        body: { title, body, ids: selectedIds },
      });
      const failed = results.filter((r) => !r.ok);
      setMessage(
        failed.length === 0
          ? `Sent to ${results.length} device${results.length === 1 ? '' : 's'}.`
          : `Sent to ${results.length - failed.length} of ${results.length}. Failed: ${failed
              .map((r) => `${r.name} (${r.error})`)
              .join(', ')}`,
      );
      if (failed.some((r) => r.removed)) loadDevices();
    } catch (err) {
      if (err.status === 401) setNeedsPassword(true);
      setMessage(err.message);
    } finally {
      setSending(false);
    }
  }

  if (needsPassword) {
    return (
      <form className="panel" onSubmit={unlock}>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
        />
        <button className="btn primary">Unlock</button>
      </form>
    );
  }

  return (
    <form className="panel" onSubmit={send}>
      <div className="row">
        <h2>Devices</h2>
        <button type="button" className="link" onClick={() => loadDevices()}>
          Refresh
        </button>
      </div>

      {devices.length === 0 ? (
        <p className="muted">No devices yet. Open this site on your phone and allow notifications.</p>
      ) : (
        <ul className="devices">
          {devices.map((d) => (
            <li key={d.id}>
              <label>
                <input type="checkbox" checked={!excluded.has(d.id)} onChange={() => toggle(d.id)} />
                <span className="device-name">{d.name}</span>
                <span className="muted small">{new Date(d.createdAt).toLocaleString()}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <input placeholder="Title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        rows={4}
        maxLength={400}
        placeholder="Message"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') e.currentTarget.form.requestSubmit();
        }}
      />
      <button
        className="btn primary"
        disabled={sending || selectedIds.length === 0 || !(title.trim() || body.trim())}
      >
        {sending ? 'Sending…' : 'Send'}
      </button>

      {message && <p className="message">{message}</p>}
    </form>
  );
}
