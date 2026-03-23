import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CatalogApp } from './CatalogApp';

const root = document.getElementById('catalog-root');
if (!root) throw new Error('Missing #catalog-root');
createRoot(root).render(
  <StrictMode>
    <CatalogApp />
  </StrictMode>,
);
