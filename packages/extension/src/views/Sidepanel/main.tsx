import React from 'react';
import ReactDOM from 'react-dom/client';
import { SidepanelApp } from './sidepanel-app';
import '../../global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <SidepanelApp />
  </React.StrictMode>,
);
