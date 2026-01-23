/**
 * Debug utility for conditional logging
 * 
 * Logs are only output when debug mode is enabled.
 * Debug mode can be enabled via:
 * - Environment variable: VITE_DEBUG=true
 * - Local storage: localStorage.setItem('debug', 'true')
 * - URL parameter: ?debug=true
 */

const DEBUG_ENV = import.meta.env.VITE_DEBUG === 'true';
const DEBUG_STORAGE = typeof window !== 'undefined' && localStorage.getItem('debug') === 'true';
const DEBUG_URL = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'true';

let debugEnabled = DEBUG_ENV || DEBUG_STORAGE || DEBUG_URL;

/**
 * Enable or disable debug mode
 */
export function setDebugMode(enabled: boolean): void {
  debugEnabled = enabled;
  if (typeof window !== 'undefined') {
    if (enabled) {
      localStorage.setItem('debug', 'true');
    } else {
      localStorage.removeItem('debug');
    }
  }
}

/**
 * Check if debug mode is enabled
 */
export function isDebugMode(): boolean {
  return debugEnabled;
}

/**
 * Debug logger - only logs when debug mode is enabled
 */
export const debug = {
  log: (...args: unknown[]): void => {
    if (debugEnabled) {
      console.log(...args);
    }
  },
  
  error: (...args: unknown[]): void => {
    if (debugEnabled) {
      console.error(...args);
    }
  },
  
  warn: (...args: unknown[]): void => {
    if (debugEnabled) {
      console.warn(...args);
    }
  },
  
  info: (...args: unknown[]): void => {
    if (debugEnabled) {
      console.info(...args);
    }
  },
  
  /**
   * Log with a prefix tag for easier filtering
   */
  tag: (tag: string) => ({
    log: (...args: unknown[]): void => {
      if (debugEnabled) {
        console.log(`[${tag}]`, ...args);
      }
    },
    error: (...args: unknown[]): void => {
      if (debugEnabled) {
        console.error(`[${tag}]`, ...args);
      }
    },
    warn: (...args: unknown[]): void => {
      if (debugEnabled) {
        console.warn(`[${tag}]`, ...args);
      }
    },
    info: (...args: unknown[]): void => {
      if (debugEnabled) {
        console.info(`[${tag}]`, ...args);
      }
    },
  }),
};

// Auto-detect debug mode on module load
if (typeof window !== 'undefined') {
  // Check URL params on load
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('debug') === 'true') {
    debugEnabled = true;
    localStorage.setItem('debug', 'true');
  }
}
