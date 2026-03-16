import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary, RootApp } from './app';
import { bootstrapCoopBoardHandoff } from './board-handoff';
import { bootstrapReceiverPairingHandoff } from './pairing-handoff';
import { bootstrapReceiverShareHandoff } from './share-handoff';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found.');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('[coop] Service worker registration failed:', error);
    });
  });
}

const initialPairingInput = bootstrapReceiverPairingHandoff(window);
const initialBoardSnapshot = bootstrapCoopBoardHandoff(window);
const initialShareInput = bootstrapReceiverShareHandoff(window);

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RootApp
        initialBoardSnapshot={initialBoardSnapshot}
        initialPairingInput={initialPairingInput}
        initialShareInput={initialShareInput}
      />
    </ErrorBoundary>
  </React.StrictMode>,
);
