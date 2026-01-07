/**
 * Viewport Capture Tool
 *
 * Captures the CAD viewer as a PNG screenshot for Claude to analyze.
 */

import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface CaptureOptions {
  url?: string;
  width?: number;
  height?: number;
  outputPath?: string;
  waitMs?: number;
}

export interface CaptureResult {
  success: boolean;
  path?: string;
  error?: string;
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
 */
export async function captureViewport(options: CaptureOptions = {}): Promise<CaptureResult> {
  const {
    // Default to Vite dev server, fall back to static server
    url = process.env.CAD_VIEWER_URL || 'http://localhost:5173',
    width = 1600,
    height = 1000,
    outputPath = resolve(__dirname, '../../viewer/capture.png'),
    waitMs = 2000,  // Wait for sketch to load
  } = options;

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
      // Dispatch wheel event to zoom in (zoom is centered on canvas)
      const canvas = document.querySelector('#cad-canvas canvas');
      if (canvas) {
        // Simulate zoom by dispatching custom event or using viewport context
        // For now, use window.__setZoom if available
        if ((window as unknown as { __setZoom?: (z: number) => void }).__setZoom) {
          (window as unknown as { __setZoom: (z: number) => void }).__setZoom(3);
          return true;
        }
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
    };
  }
}
