import React from 'react';
import ReactDOM from 'react-dom/client';
import { RootApp } from './app';
import { bootstrapCoopBoardHandoff } from './board-handoff';
import { bootstrapReceiverPairingHandoff } from './pairing-handoff';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found.');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

const initialPairingInput = bootstrapReceiverPairingHandoff(window);
const initialBoardSnapshot = bootstrapCoopBoardHandoff(window);

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RootApp
      initialBoardSnapshot={initialBoardSnapshot}
      initialPairingInput={initialPairingInput}
    />
  </React.StrictMode>,
);
