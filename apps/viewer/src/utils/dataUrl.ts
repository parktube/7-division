/**
 * Data URL resolver for Electron and web environments
 *
 * In Electron: Uses dataServer query parameter for data files
 * In Web (Vite): Uses relative paths (handled by Vite middleware)
 */

let dataServerBase: string | null = null;

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
 * Check if running in Electron (has dataServer parameter)
 */
export function isElectronEnv(): boolean {
  return dataServerBase !== null;
}
