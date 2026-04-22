import React from 'react';
import { createRoot } from 'react-dom/client';
import { init as initSentryRenderer } from '@sentry/electron/renderer';
import { App } from './App';
import './styles/globals.css';

// Hook into the main-process Sentry client over IPC. No DSN needed here —
// the main process already initialized it. This captures React render
// errors + unhandled promise rejections in the renderer.
initSentryRenderer({});

const container = document.getElementById('root');
if (!container) throw new Error('#root missing');
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
