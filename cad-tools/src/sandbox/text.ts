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
import { homedir } from 'os';
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
  // Ubuntu fonts
  'Ubuntu-R.ttf',
  'Ubuntu-M.ttf',
  'ubuntu/Ubuntu-R.ttf',
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
  const home = homedir();
  for (const dir of DEFAULT_FONT_PATHS) {
    // ~ 경로 확장 (homedir()가 빈 문자열이면 스킵)
    let expandedDir = dir;
    if (dir.startsWith('~')) {
      if (!home) continue;  // homedir()가 빈 문자열이면 이 경로 스킵
      expandedDir = dir.replace('~', home);
    }
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
 * Resolve font path and check cache (shared logic)
 * @returns [resolvedPath, cachedFont] or null if font not found
 */
function resolveFontWithCache(fontPath?: string): { path: string; cached: opentype.Font | null } | null {
  const resolvedPath = findFont(fontPath);
  if (!resolvedPath) {
    logger.error('[text] No font found. Please provide a font path.');
    return null;
  }
  return { path: resolvedPath, cached: fontCache.get(resolvedPath) || null };
}

/**
 * Cache font after loading (shared logic)
 */
function cacheLoadedFont(path: string, font: opentype.Font): opentype.Font {
  fontCache.set(path, font);
  logger.info(`[text] Font loaded: ${path}`);
  return font;
}

/**
 * Load font from file (with caching)
 */
export async function loadFont(fontPath?: string): Promise<opentype.Font | null> {
  const resolved = resolveFontWithCache(fontPath);
  if (!resolved) return null;
  if (resolved.cached) return resolved.cached;

  try {
    const font = await opentype.load(resolved.path);
    return cacheLoadedFont(resolved.path, font);
  } catch (err) {
    logger.error(`[text] Failed to load font: ${err}`);
    return null;
  }
}

/**
 * Load font synchronously (for QuickJS sandbox compatibility)
 */
export function loadFontSync(fontPath?: string): opentype.Font | null {
  const resolved = resolveFontWithCache(fontPath);
  if (!resolved) return null;
  if (resolved.cached) return resolved.cached;

  try {
    const font = opentype.loadSync(resolved.path);
    return cacheLoadedFont(resolved.path, font);
  } catch (err) {
    logger.error(`[text] Failed to load font: ${err}`);
    return null;
  }
}

/**
 * Convert opentype.Path to SVG path string with Y-flip (shared logic)
 * Validates each command for NaN/Infinity and skips invalid ones
 *
 * @param path - opentype.Path object
 * @param offsetX - X offset to apply
 * @param offsetY - Y offset (Y-flip: result = offsetY - cmd.y)
 * @returns SVG path string or empty string if invalid
 */
function pathToSvgString(
  path: opentype.Path,
  offsetX: number,
  offsetY: number
): string {
  const commands: string[] = [];

  for (const cmd of path.commands) {
    switch (cmd.type) {
      case 'M':
        if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) continue;
        commands.push(`M ${(offsetX + cmd.x).toFixed(2)},${(offsetY - cmd.y).toFixed(2)}`);
        break;
      case 'L':
        if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) continue;
        commands.push(`L ${(offsetX + cmd.x).toFixed(2)},${(offsetY - cmd.y).toFixed(2)}`);
        break;
      case 'C':
        if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y) ||
            !Number.isFinite(cmd.x1) || !Number.isFinite(cmd.y1) ||
            !Number.isFinite(cmd.x2) || !Number.isFinite(cmd.y2)) continue;
        commands.push(
          `C ${(offsetX + cmd.x1).toFixed(2)},${(offsetY - cmd.y1).toFixed(2)} ` +
          `${(offsetX + cmd.x2).toFixed(2)},${(offsetY - cmd.y2).toFixed(2)} ` +
          `${(offsetX + cmd.x).toFixed(2)},${(offsetY - cmd.y).toFixed(2)}`
        );
        break;
      case 'Q':
        if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y) ||
            !Number.isFinite(cmd.x1) || !Number.isFinite(cmd.y1)) continue;
        commands.push(
          `Q ${(offsetX + cmd.x1).toFixed(2)},${(offsetY - cmd.y1).toFixed(2)} ` +
          `${(offsetX + cmd.x).toFixed(2)},${(offsetY - cmd.y).toFixed(2)}`
        );
        break;
      case 'Z':
        commands.push('Z');
        break;
    }
  }

  const pathData = commands.join(' ');

  // Final validation for any remaining invalid values
  if (pathData.includes('NaN') || pathData.includes('Infinity')) {
    return '';
  }

  return pathData;
}

/**
 * Convert text to SVG path string
 *
 * @param text - Text string to convert
 * @param x - X position
 * @param y - Y position (baseline position in CAD coordinates - Y up)
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
  // Validate input coordinates
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(fontSize) || fontSize <= 0) {
    logger.warn(`[text] Invalid coordinates or fontSize: x=${x}, y=${y}, fontSize=${fontSize}`);
    return '';
  }

  // Get path from font (opentype uses Y-down coordinate system)
  const path = font.getPath(text, 0, 0, fontSize);

  // Convert using shared helper
  const pathData = pathToSvgString(path, x, y);

  if (!pathData) {
    logger.error(`[text] Generated path contains invalid values for text: '${text}'`);
  }

  return pathData;
}

/**
 * Get text metrics
 */
export function getTextMetrics(
  text: string,
  fontSize: number,
  font: opentype.Font
): { width: number; height: number; ascender: number; descender: number } {
  // Validate fontSize
  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    throw new RangeError(`[text] getTextMetrics: invalid fontSize (${fontSize}). Must be a positive number.`);
  }
  if (!font.unitsPerEm || font.unitsPerEm <= 0) {
    throw new RangeError(`[text] getTextMetrics: invalid font.unitsPerEm (${font.unitsPerEm})`);
  }

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
  path: string;        // Combined SVG path string (may have rendering issues)
  paths: string[];     // Individual glyph paths (recommended for correct rendering)
  width: number;       // Text width
  height: number;      // Text height
  adjustedX: number;   // X after alignment adjustment
  adjustedY: number;   // Y after baseline adjustment
}

/**
 * Convert a single glyph path to SVG path string with Y-flip
 * Uses shared pathToSvgString helper for consistency
 */
function glyphPathToSvg(
  path: opentype.Path,
  offsetX: number,
  offsetY: number
): string {
  // Validate input coordinates
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
    logger.warn(`[text] glyphPathToSvg: invalid offset (${offsetX}, ${offsetY})`);
    return '';
  }

  const result = pathToSvgString(path, offsetX, offsetY);
  if (!result) {
    logger.warn('[text] glyphPathToSvg: generated path contains invalid values');
  }
  return result;
}


/**
 * Convert text to array of glyph paths (one per character)
 * This avoids the issue of connecting lines between glyphs
 *
 * @param text - Text string
 * @param x - X position
 * @param y - Y position (baseline in CAD coordinates)
 * @param fontSize - Font size
 * @param font - Loaded opentype.Font
 * @returns Array of SVG path strings, one per glyph
 */
export function textToGlyphPaths(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  font: opentype.Font
): string[] {
  // Validate input coordinates
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(fontSize) || fontSize <= 0) {
    logger.warn(`[text] textToGlyphPaths: invalid input (x=${x}, y=${y}, fontSize=${fontSize})`);
    return [];
  }
  const scale = fontSize / font.unitsPerEm;
  const paths: string[] = [];
  let currentX = x;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Skip space characters (no visible glyph)
    if (char === ' ') {
      const spaceGlyph = font.charToGlyph(char);
      currentX += (spaceGlyph.advanceWidth || 0) * scale;
      continue;
    }

    const glyph = font.charToGlyph(char);
    const glyphPath = glyph.getPath(0, 0, fontSize);

    if (glyphPath.commands.length > 0) {
      const pathStr = glyphPathToSvg(glyphPath, currentX, y);
      if (pathStr.length > 0) {
        paths.push(pathStr);
      }
    }

    // Advance X position
    currentX += (glyph.advanceWidth || 0) * scale;

    // Apply kerning if not last character
    if (i < text.length - 1) {
      const nextGlyph = font.charToGlyph(text[i + 1]);
      const kerning = font.getKerningValue(glyph, nextGlyph);
      currentX += kerning * scale;
    }
  }

  return paths;
}

/**
 * Convert text to bezier path with options
 *
 * @param text - Text string
 * @param x - X position (interpretation depends on align)
 * @param y - Y position (baseline)
 * @param fontSize - Font size
 * @param options - Text options (fontPath, align)
 * @returns TextResult with paths (array) and metrics
 */
export function convertText(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  options: TextOptions = {}
): TextResult | null {
  // Validate input coordinates
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(fontSize) || fontSize <= 0) {
    logger.warn(`[text] convertText: invalid input (x=${x}, y=${y}, fontSize=${fontSize})`);
    return null;
  }

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

  const adjustedY = y;

  // Get individual glyph paths to avoid connecting lines
  const paths = textToGlyphPaths(text, adjustedX, adjustedY, fontSize, font);

  return {
    path: paths.join(' '), // Combined path for single entity (may have issues)
    paths, // Individual glyph paths for separate entities
    width: metrics.width,
    height: metrics.height,
    adjustedX,
    adjustedY,
  };
}
