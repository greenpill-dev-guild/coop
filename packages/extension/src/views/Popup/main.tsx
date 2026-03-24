import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerWebAuthnCredentialBridge } from '../../runtime/webauthn-bridge';
import { ErrorBoundary } from '../ErrorBoundary';
import { PopupApp } from './PopupApp';
import '../../global.css';
import './popup.css';

window.addEventListener('unhandledrejection', (event) => {
  console.warn('[coop:popup] unhandled rejection:', event.reason);
});

registerWebAuthnCredentialBridge();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PopupApp />
    </ErrorBoundary>
  </React.StrictMode>,
);
