/**
 * Data URL resolver for Electron and web environments
 *
 * In Electron: Uses dataServer query parameter for data files
 * In Web (Vite): Uses relative paths (handled by Vite middleware)
 */

// Module state encapsulated behind accessors
let dataServerBase: string | null = null;

/**
 * Get current data server base URL (for testing/debugging)
 */
export function getDataServerBase(): string | null {
  return dataServerBase;
}

/**
 * Set data server base URL (mainly for testing)
 */
export function setDataServerBase(value: string | null): void {
  dataServerBase = value;
}

/**
 * Reset data server state (for testing and HMR)
 */
export function resetDataServerBase(): void {
  dataServerBase = null;
}

/**
 * Initialize the data server base URL from query parameters
 * Call this early in app initialization
 */
export function initDataServer(): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const serverUrl = params.get('dataServer');

  if (serverUrl) {
    dataServerBase = serverUrl;
  }
}

/**
 * Get the URL for a data file (scene.json, selection.json, sketch.json)
 * @param filename - The filename (e.g., 'scene.json', 'selection.json')
 * @returns The full URL to the data file
 */
export function getDataUrl(filename: string): string {
  // Ensure filename starts with /
  const normalizedFilename = filename.startsWith('/') ? filename : `/${filename}`;

  if (dataServerBase) {
    // Electron: use data server URL
    return `${dataServerBase}${normalizedFilename}`;
  }

  // Web/Vite: use relative path
  return normalizedFilename;
}

/**
 * Check if data server is configured (via dataServer query parameter)
 * True in Electron or when explicitly configured
 */
export function hasDataServer(): boolean {
  return dataServerBase !== null;
}

/**
 * @deprecated Use hasDataServer() instead - name better reflects actual behavior
 */
export function isElectronEnv(): boolean {
  return hasDataServer();
}
