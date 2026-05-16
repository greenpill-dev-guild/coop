import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary, RootApp } from './app';
import { bootstrapCoopBoardHandoff } from './board-handoff';
import { bootstrapReceiverPairingHandoff } from './pairing-handoff';
import { registerReceiverServiceWorker } from './service-worker';
import { bootstrapReceiverShareHandoff } from './share-handoff';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found.');
}

registerReceiverServiceWorker();

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
