// import './index.css'; // Temporarily disabled - using CDN for now
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

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