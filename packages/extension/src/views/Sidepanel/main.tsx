import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '../ErrorBoundary';
import { SidepanelApp } from './SidepanelApp';
import '../../global.css';

window.addEventListener('unhandledrejection', (event) => {
  console.warn('[coop:sidepanel] unhandled rejection:', event.reason);
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SidepanelApp />
    </ErrorBoundary>
  </React.StrictMode>,
);
