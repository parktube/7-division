/**
 * Viewport Capture Tool
 *
 * Captures the CAD viewer as a PNG screenshot for Claude to analyze.
 */

import puppeteer from 'puppeteer';
import { existsSync, mkdirSync } from 'fs';
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
 */
export async function captureViewport(options: CaptureOptions = {}): Promise<CaptureResult> {
  const {
    url = 'http://localhost:8000/index.html',
    width = 800,
    height = 600,
    outputPath = resolve(__dirname, '../../viewer/capture.png'),
    waitMs = 1000,
  } = options;

  let browser;
  try {
    logger.debug('Starting viewport capture', { url, width, height, outputPath });

    // Ensure output directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Launch headless browser (Puppeteer v22+ uses new headless by default)
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

    // Wait for scene to render
    await new Promise(resolve => setTimeout(resolve, waitMs));

    // Capture screenshot
    await page.screenshot({ path: outputPath, type: 'png' });

    await browser.close();

    return {
      success: true,
      path: outputPath,
    };
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
