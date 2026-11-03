import { useState } from 'react';
import Receiver from './Receiver.jsx';
import Sender from './Sender.jsx';
import { device } from './push.js';

export default function App() {
  // Phones only get the receive screen. Computers open on "Send".
  const [tab, setTab] = useState(device.isMobile ? 'receive' : 'send');

  return (
    <div className="app">
      <header className="header">
        <img src="/icons/icon-192.png" alt="" width="64" height="64" />
        <h1>Push Test</h1>
      </header>

      {!device.isMobile && (
        <nav className="tabs">
          <button className={tab === 'send' ? 'active' : ''} onClick={() => setTab('send')}>
            Send
          </button>
          <button className={tab === 'receive' ? 'active' : ''} onClick={() => setTab('receive')}>
            Receive
          </button>
        </nav>
      )}

      {tab === 'receive' ? <Receiver /> : <Sender />}
    </div>
  );
}
