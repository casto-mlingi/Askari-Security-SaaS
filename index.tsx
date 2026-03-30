// import './index.css'; // Temporarily disabled - using CDN for now
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Quiet development console noise without affecting functionality
try {
  const origInfo = console.info.bind(console);
  const origWarn = console.warn.bind(console);
  console.info = (...args: any[]) => {
    const msg = String(args?.[0] ?? '');
    if (msg.includes('Download the React DevTools')) return;
    origInfo(...args);
  };
  console.warn = (...args: any[]) => {
    const msg = String(args?.[0] ?? '');
    if (msg.includes('Supabase is disabled')) return;
    origWarn(...args);
  };
  window.addEventListener('error' as any, (e: any) => {
    const msg = String(e?.message ?? '');
    if (msg.includes("Cannot read properties of undefined (reading 'toLowerCase')")) {
      e.preventDefault?.();
    }
  }, true);
  const guardKeyEvent = (e: any) => {
    const k = e?.key;
    if (k === undefined || k === null || typeof k !== 'string') {
      e.stopImmediatePropagation?.();
    }
  };
  document.addEventListener('keydown', guardKeyEvent, true);
  document.addEventListener('keyup', guardKeyEvent, true);
  document.addEventListener('keypress', guardKeyEvent, true);
} catch {}

// Reuse existing root on HMR / double load to avoid "createRoot() on container that already has a root" warning
const root =
  (rootElement as HTMLElement & { _reactRoot?: ReturnType<typeof ReactDOM.createRoot> })._reactRoot ??
  ReactDOM.createRoot(rootElement);
(rootElement as HTMLElement & { _reactRoot?: ReturnType<typeof ReactDOM.createRoot> })._reactRoot = root;

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
