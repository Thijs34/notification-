import { useEffect, useState } from 'react';
import { api } from './push.js';

export default function Sender() {
  const [password, setPassword] = useState(() => localStorage.getItem('adminPassword') || '');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [devices, setDevices] = useState(null);
  const [excluded, setExcluded] = useState(() => new Set()); // unchecked devices
  const [title, setTitle] = useState('Hello from my PC 👋');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  const authHeaders = (pw = password) => (pw ? { 'x-admin-password': pw } : {});

  async function loadDevices(pw = password) {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/api/devices', { headers: authHeaders(pw) });
      setDevices(data.devices);
      setNeedsPassword(false);
    } catch (err) {
      if (err.status === 401) setNeedsPassword(true);
      setError(err.message);
    } finally {
      setLoading(false);
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

  const selectedIds = (devices || []).filter((d) => !excluded.has(d.id)).map((d) => d.id);

  async function send(e) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setResults(null);
    try {
      const data = await api('/api/broadcast', {
        method: 'POST',
        headers: authHeaders(),
        body: { title, body, ids: selectedIds },
      });
      setResults(data.results);
      if (data.results.some((r) => r.removed)) loadDevices();
    } catch (err) {
      if (err.status === 401) setNeedsPassword(true);
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <section className="card">
        <div className="row-between">
          <h2>Devices</h2>
          <button className="btn small ghost" onClick={() => loadDevices()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {needsPassword && (
          <form className="password-form" onSubmit={unlock}>
            <input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button className="btn primary small">Unlock</button>
          </form>
        )}

        {devices?.length === 0 && (
          <p className="muted">
            No devices yet. Open <b>{window.location.origin}</b> on your phone, enable notifications,
            then press Refresh.
          </p>
        )}

        {devices?.length > 0 && (
          <ul className="devices">
            {devices.map((d) => (
              <li key={d.id}>
                <label>
                  <input type="checkbox" checked={!excluded.has(d.id)} onChange={() => toggle(d.id)} />
                  <span className="device-name">{d.name}</span>
                  <span className={`tag ${d.platform.toLowerCase()}`}>{d.platform}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className="card" onSubmit={send}>
        <h2>Message</h2>
        <label className="field">
          Title
          <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          Message
          <textarea
            rows={4}
            maxLength={400}
            value={body}
            placeholder="Type your notification text…"
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') e.currentTarget.form.requestSubmit();
            }}
          />
        </label>
        <button
          className="btn primary"
          disabled={sending || selectedIds.length === 0 || !(title.trim() || body.trim())}
        >
          {sending
            ? 'Sending…'
            : `Send to ${selectedIds.length} device${selectedIds.length === 1 ? '' : 's'}`}
        </button>
        <p className="hint">Ctrl + Enter sends.</p>
      </form>

      {results && (
        <section className="card">
          <h2>Result</h2>
          <ul className="results">
            {results.map((r) => (
              <li key={r.id} className={r.ok ? 'ok' : 'bad'}>
                {r.ok ? '✓' : '✗'} {r.name}
                {r.error && <span className="muted">: {r.error}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p className="status error">{error}</p>}
    </>
  );
}
