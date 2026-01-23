import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './main.css';
await import('katex/dist/katex.min.css');

import './i18n';
import useStore from './store/store';
import { get } from 'idb-keyval';
import { debug } from '@utils/debug';

const dbg = debug.tag('main');

// Apply theme from store before React renders to prevent flash
async function initializeTheme() {
  try {
    // Try to get theme from persisted store
    const persistedState = await get('fthr-write');
    if (persistedState) {
      let state = persistedState;
      if (persistedState.state) {
        state = persistedState.state;
      }
      if (state && state.theme && (state.theme === 'dark' || state.theme === 'light')) {
        document.documentElement.className = state.theme;
        return;
      }
    }
    
    // Check legacy localStorage
    const legacyTheme = localStorage.getItem('theme');
    if (legacyTheme === 'dark' || legacyTheme === 'light') {
      document.documentElement.className = legacyTheme;
      return;
    }
    
    // Get theme from store (might be default 'light' if not persisted yet)
    const theme = useStore.getState().theme;
    if (theme) {
      document.documentElement.className = theme;
    }
  } catch (error) {
    dbg.warn('Failed to initialize theme:', error);
    // Fallback to store state
    const theme = useStore.getState().theme;
    if (theme) {
      document.documentElement.className = theme;
    }
  }
}

// Initialize theme before rendering
await initializeTheme();

// Reset zoom level to 100% on startup (for web browser)
// Note: Browser zoom level cannot be programmatically changed for security reasons,
// but we can ensure CSS zoom is normalized. Electron apps handle zoom via electron/index.cjs
if (typeof window !== 'undefined' && !window.navigator.userAgent.includes('Electron')) {
  // Normalize CSS zoom to 100% (only affects page scaling, not browser zoom)
  (document.body.style as any).zoom = '1';
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
