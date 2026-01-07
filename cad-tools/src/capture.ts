/**
 * Viewport Capture Tool
 *
 * Captures the CAD viewer as a PNG screenshot for Claude to analyze.
 * Auto-detects environment:
 * - Windows/Mac: Try Electron first, fall back to Puppeteer
 * - Linux: Use Puppeteer for web viewer
 */

import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface CaptureOptions {
  url?: string;
  width?: number;
  height?: number;
  outputPath?: string;
  waitMs?: number;
  forceMethod?: 'electron' | 'puppeteer';
}

export interface CaptureResult {
  success: boolean;
  path?: string;
  error?: string;
  method?: 'electron' | 'puppeteer';
}

/**
 * Get the default userData path for Electron (platform-specific)
 */
function getElectronUserDataPath(): string {
  const appName = 'CADViewer';
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', appName);
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    return join(appData, appName);
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(xdgConfig, appName);
}

/**
 * Try to capture from Electron's data server
 * Returns null if Electron is not running
 */
async function tryElectronCapture(outputPath: string): Promise<CaptureResult | null> {
  // Electron's data server writes port to a file or we can try common ports
  // For now, try to read from a known port file or scan
  const userDataPath = getElectronUserDataPath();
  const portFilePath = join(userDataPath, '.server-port');

  try {
    // First try to read the port from file (if Electron writes it)
    let port: number | undefined;
    try {
      const portData = await fs.readFile(portFilePath, 'utf-8');
      port = parseInt(portData.trim(), 10);
    } catch (err) {
      // Port file doesn't exist - Electron app may not be running
      logger.debug('Electron port file not found', { path: portFilePath, error: String(err) });
    }

    // If we have a port, try the capture endpoint
    if (port) {
      const response = await fetch(`http://127.0.0.1:${port}/capture?path=${encodeURIComponent(outputPath)}`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const result = await response.json() as CaptureResult;
        return { ...result, method: 'electron' };
      }
    }

    return null;
  } catch (err) {
    logger.debug('Electron capture failed', { error: String(err) });
    return null;
  }
}

/**
 * Capture the viewer viewport as a PNG
 *
 * Captures the full viewport including:
 * - CAD shapes (scene.json entities)
 * - Sketch overlay (red freehand drawings)
 * - Selection indicators (blue dashed borders)
 * - Lock indicators (orange solid borders)
 * - Grid and rulers (if enabled)
 *
 * Auto-detects capture method:
 * - Tries Electron first (if available)
 * - Falls back to Puppeteer for web viewer
 */
export async function captureViewport(options: CaptureOptions = {}): Promise<CaptureResult> {
  const {
    // Default to Vite dev server, fall back to static server
    url = process.env.CAD_VIEWER_URL || 'http://localhost:5173',
    width = 1600,
    height = 1000,
    outputPath = resolve(__dirname, '../../viewer/capture.png'),
    waitMs = 2000,  // Wait for sketch to load
    forceMethod,
  } = options;

  // Try Electron first on Windows/Mac (unless forced to use Puppeteer)
  if (forceMethod !== 'puppeteer' && (process.platform === 'win32' || process.platform === 'darwin')) {
    logger.debug('Trying Electron capture first');
    const electronResult = await tryElectronCapture(outputPath);
    if (electronResult?.success) {
      logger.debug('Electron capture succeeded');
      return electronResult;
    }
    logger.debug('Electron capture not available, falling back to Puppeteer');
  }

  // Skip Puppeteer if forced to use Electron
  if (forceMethod === 'electron') {
    return {
      success: false,
      error: 'Electron capture not available (is the Electron app running?)',
      method: 'electron',
    };
  }

  let browser;
  try {
    logger.debug('Starting viewport capture', { url, width, height, outputPath });

    // Ensure output directory exists (async to avoid blocking event loop)
    const outputDir = dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Launch headless browser (Puppeteer v22+ uses new headless mode by default)
    logger.debug('Launching headless browser');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height });

    // Navigate to viewer with increased timeout
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for scene and sketch to render
    await new Promise(resolve => setTimeout(resolve, waitMs));

    // Set zoom level (3x for better precision)
    const zoomApplied = await page.evaluate(() => {
      // Use window.__setZoom if exposed by the viewer
      type WindowWithZoom = Window & { __setZoom?: (z: number) => void };
      const win = window as WindowWithZoom;
      if (win.__setZoom) {
        win.__setZoom(3);
        return true;
      }
      return false;
    });
    logger.debug('Zoom setting', { zoomApplied, targetZoom: 3 });
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for zoom to apply

    // Find the canvas container element
    const canvasElement = await page.$('#cad-canvas');

    if (canvasElement) {
      // Capture only the canvas area
      await canvasElement.screenshot({ path: outputPath, type: 'png' });
    } else {
      // Fallback to full page if canvas not found
      logger.debug('Canvas element not found, capturing full page');
      await page.screenshot({ path: outputPath, type: 'png' });
    }

    await browser.close();

    logger.debug('Viewport capture completed successfully', { outputPath });

    return {
      success: true,
      path: outputPath,
      method: 'puppeteer',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Viewport capture failed', { error: errorMessage });

    if (browser) {
      await browser.close();
    }
    return {
      success: false,
      error: errorMessage,
      method: 'puppeteer',
    };
  }
}
