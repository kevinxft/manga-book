import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './globals.css';

if (navigator.userAgent.includes('Macintosh')) {
  document.documentElement.classList.add('platform-darwin');
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
