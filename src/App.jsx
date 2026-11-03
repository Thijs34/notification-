import { useEffect, useState } from 'react';
import Receiver from './Receiver.jsx';
import Sender from './Sender.jsx';
import { device } from './push.js';

const TABS = { receive: 'Receive', send: 'Send' };

export default function App() {
  // Phones start on "Receive", computers on "Send". #receive / #send in the URL overrides.
  const [tab, setTab] = useState(() => {
    const fromHash = window.location.hash.slice(1);
    if (fromHash in TABS) return fromHash;
    return device.isMobile ? 'receive' : 'send';
  });

  useEffect(() => {
    window.history.replaceState(null, '', `#${tab}`);
  }, [tab]);

  return (
    <div className="app">
      <header className="header">
        <img src="/icons/icon-192.png" alt="" width="44" height="44" />
        <div>
          <h1>Push Test</h1>
          <p>Web push notifications on iOS &amp; Android</p>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {Object.entries(TABS).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'active' : ''}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main>{tab === 'receive' ? <Receiver /> : <Sender />}</main>
    </div>
  );
}
