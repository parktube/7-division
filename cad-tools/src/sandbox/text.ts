/**
 * Text Module - Convert text to bezier paths using opentype.js
 *
 * Converts text strings into SVG path commands that can be rendered
 * using the existing drawBezier infrastructure.
 */

import opentype from 'opentype.js';
import { existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Font cache to avoid reloading
const fontCache = new Map<string, opentype.Font>();

// Default font paths to search
const DEFAULT_FONT_PATHS = [
  // Project local fonts
  join(__dirname, '../../../fonts'),
  // Linux system fonts
  '/usr/share/fonts/truetype',
  '/usr/share/fonts/opentype',
  // macOS system fonts
  '/System/Library/Fonts',
  '/Library/Fonts',
  '~/Library/Fonts',
  // Windows fonts
  'C:\\Windows\\Fonts',
];

// Common default font names
const DEFAULT_FONT_NAMES = [
  'NotoSans-Regular.ttf',
  'DejaVuSans.ttf',
  'Arial.ttf',
  'Helvetica.ttf',
  'LiberationSans-Regular.ttf',
];

/**
 * Find a font file by searching common locations
 */
function findFont(fontPath?: string): string | null {
  // If explicit path provided, use it
  if (fontPath) {
    const resolved = resolve(fontPath);
    if (existsSync(resolved)) {
      return resolved;
    }
    logger.warn(`[text] Font not found at: ${fontPath}`);
    return null;
  }

  // Search default locations
  for (const dir of DEFAULT_FONT_PATHS) {
    const expandedDir = dir.replace('~', process.env.HOME || '');
    if (!existsSync(expandedDir)) continue;

    for (const name of DEFAULT_FONT_NAMES) {
      const fullPath = join(expandedDir, name);
      if (existsSync(fullPath)) {
        logger.info(`[text] Found default font: ${fullPath}`);
        return fullPath;
      }
    }
  }

  return null;
}

/**
 * Load font from file (with caching)
 */
export async function loadFont(fontPath?: string): Promise<opentype.Font | null> {
  const resolvedPath = findFont(fontPath);
  if (!resolvedPath) {
    logger.error('[text] No font found. Please provide a font path.');
    return null;
  }

  // Check cache
  const cached = fontCache.get(resolvedPath);
  if (cached) {
    return cached;
  }

  try {
    const font = await opentype.load(resolvedPath);
    fontCache.set(resolvedPath, font);
    logger.info(`[text] Font loaded: ${resolvedPath}`);
    return font;
  } catch (err) {
    logger.error(`[text] Failed to load font: ${err}`);
    return null;
  }
}

/**
 * Load font synchronously (for QuickJS sandbox compatibility)
 */
export function loadFontSync(fontPath?: string): opentype.Font | null {
  const resolvedPath = findFont(fontPath);
  if (!resolvedPath) {
    logger.error('[text] No font found. Please provide a font path.');
    return null;
  }

  // Check cache
  const cached = fontCache.get(resolvedPath);
  if (cached) {
    return cached;
  }

  try {
    const font = opentype.loadSync(resolvedPath);
    fontCache.set(resolvedPath, font);
    logger.info(`[text] Font loaded: ${resolvedPath}`);
    return font;
  } catch (err) {
    logger.error(`[text] Failed to load font: ${err}`);
    return null;
  }
}

/**
 * Convert text to SVG path string
 *
 * @param text - Text string to convert
 * @param x - X position
 * @param y - Y position
 * @param fontSize - Font size in pixels
 * @param font - Loaded opentype.Font
 * @returns SVG path string compatible with drawBezier
 */
export function textToPath(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  font: opentype.Font
): string {
  // Get path from font
  const path = font.getPath(text, x, y, fontSize);

  // Convert to SVG path string
  return path.toPathData(2); // 2 decimal places precision
}

/**
 * Get text metrics
 */
export function getTextMetrics(
  text: string,
  fontSize: number,
  font: opentype.Font
): { width: number; height: number; ascender: number; descender: number } {
  const scale = fontSize / font.unitsPerEm;
  const ascender = font.ascender * scale;
  const descender = font.descender * scale;

  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const glyph = font.charToGlyph(text[i]);
    width += (glyph.advanceWidth || 0) * scale;

    // Kerning
    if (i < text.length - 1) {
      const nextGlyph = font.charToGlyph(text[i + 1]);
      const kerning = font.getKerningValue(glyph, nextGlyph);
      width += kerning * scale;
    }
  }

  return {
    width,
    height: ascender - descender,
    ascender,
    descender,
  };
}

/**
 * TextOptions for drawText function
 */
export interface TextOptions {
  fontPath?: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * Result of text conversion
 */
export interface TextResult {
  path: string;        // SVG path string
  width: number;       // Text width
  height: number;      // Text height
  adjustedX: number;   // X after alignment adjustment
  adjustedY: number;   // Y after baseline adjustment
}

/**
 * Convert text to bezier path with options
 *
 * @param text - Text string
 * @param x - X position (interpretation depends on align)
 * @param y - Y position (baseline)
 * @param fontSize - Font size
 * @param options - Text options (fontPath, align)
 * @returns TextResult with path and metrics
 */
export function convertText(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  options: TextOptions = {}
): TextResult | null {
  const font = loadFontSync(options.fontPath);
  if (!font) {
    return null;
  }

  const metrics = getTextMetrics(text, fontSize, font);

  // Calculate adjusted X based on alignment
  let adjustedX = x;
  switch (options.align) {
    case 'center':
      adjustedX = x - metrics.width / 2;
      break;
    case 'right':
      adjustedX = x - metrics.width;
      break;
    // 'left' is default, no adjustment needed
  }

  // Note: opentype.js uses y as baseline, CAD uses y as center
  // We'll keep y as-is and let users handle baseline positioning
  const adjustedY = y;

  const path = textToPath(text, adjustedX, adjustedY, fontSize, font);

  return {
    path,
    width: metrics.width,
    height: metrics.height,
    adjustedX,
    adjustedY,
  };
}
