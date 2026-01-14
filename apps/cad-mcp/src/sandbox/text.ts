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
  // Project local fonts (apps/cad-mcp/fonts)
  join(__dirname, '../../fonts'),
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

// Common default font names (Korean fonts prioritized for CJK support)
const DEFAULT_FONT_NAMES = [
  // Korean fonts - Windows
  'malgun.ttf',                    // 맑은 고딕 (Windows 기본)
  'NanumGothic.ttf',               // 나눔고딕
  'NanumBarunGothic.ttf',          // 나눔바른고딕
  // Korean fonts - macOS
  'AppleSDGothicNeo.ttc',          // Apple SD 산돌고딕 Neo
  'AppleGothic.ttf',               // Apple Gothic
  // Korean fonts - Linux
  'noto/NotoSansCJK-Regular.ttc',  // Noto Sans CJK
  'noto-cjk/NotoSansCJKkr-Regular.otf',
  'nanum/NanumGothic.ttf',
  // English fallback fonts
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
  color?: [number, number, number, number];  // RGBA [0-1]
}

/**
 * Result of text conversion
 */
export interface TextResult {
  path: string;        // Combined SVG path string (may have rendering issues)
  paths: string[];     // Individual glyph paths (recommended for correct rendering)
  isHole: boolean[];   // Whether each path is a hole (inner contour)
  points: [number, number][][]; // Polygon points for booleanDifference
  width: number;       // Text width
  height: number;      // Text height
  adjustedX: number;   // X after alignment adjustment
  adjustedY: number;   // Y after baseline adjustment
}

/**
 * Calculate signed area of a polygon using shoelace formula
 * Positive area = CCW (counter-clockwise)
 * Negative area = CW (clockwise)
 */
function calculateSignedArea(points: [number, number][]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i][0] * points[j][1];
    area -= points[j][0] * points[i][1];
  }
  return area / 2;
}

/**
 * Sample points along a quadratic Bezier curve
 * @param p0 Start point
 * @param p1 Control point
 * @param p2 End point
 * @param samples Number of samples (excluding start, including end). Must be >= 1.
 */
function sampleQuadraticBezier(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  samples: number = 4
): [number, number][] {
  // Ensure at least 1 sample (return endpoint)
  const actualSamples = Math.max(1, Math.floor(samples));
  const points: [number, number][] = [];
  for (let i = 1; i <= actualSamples; i++) {
    const t = i / actualSamples;
    const mt = 1 - t;
    // B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
    const x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0];
    const y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1];
    points.push([x, y]);
  }
  return points;
}

/**
 * Sample points along a cubic Bezier curve
 * @param p0 Start point
 * @param p1 Control point 1
 * @param p2 Control point 2
 * @param p3 End point
 * @param samples Number of samples (excluding start, including end). Must be >= 1.
 */
function sampleCubicBezier(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  samples: number = 4
): [number, number][] {
  // Ensure at least 1 sample (return endpoint)
  const actualSamples = Math.max(1, Math.floor(samples));
  const points: [number, number][] = [];
  for (let i = 1; i <= actualSamples; i++) {
    const t = i / actualSamples;
    const mt = 1 - t;
    // B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
    const x = mt*mt*mt*p0[0] + 3*mt*mt*t*p1[0] + 3*mt*t*t*p2[0] + t*t*t*p3[0];
    const y = mt*mt*mt*p0[1] + 3*mt*mt*t*p1[1] + 3*mt*t*t*p2[1] + t*t*t*p3[1];
    points.push([x, y]);
  }
  return points;
}

/**
 * Subpath result with hole detection and polygon points
 */
interface SubpathInfo {
  path: string;
  isHole: boolean;
  /** Polygon points in world coordinates (after Y-flip and offset) */
  points: [number, number][];
}

/**
 * Convert a single glyph path to array of SVG subpath strings with Y-flip
 * Each M...Z sequence becomes a separate string to handle multi-contour glyphs
 * (e.g., Korean characters like 녕 have multiple subpaths)
 * Also detects holes using winding direction (CW = hole in font coords)
 */
/**
 * Intermediate subpath data before hole detection
 */
interface RawSubpathData {
  path: string;
  points: [number, number][];
  area: number;
}

function glyphPathToSvgSubpaths(
  path: opentype.Path,
  offsetX: number,
  offsetY: number
): SubpathInfo[] {
  // Validate input coordinates
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
    logger.warn(`[text] glyphPathToSvgSubpaths: invalid offset (${offsetX}, ${offsetY})`);
    return [];
  }

  const CURVE_SAMPLES = 4; // Number of samples per curve segment
  const rawSubpaths: RawSubpathData[] = [];
  let currentCommands: string[] = [];
  let currentPoints: [number, number][] = []; // For area calculation (original coords)
  let worldPoints: [number, number][] = []; // World coordinates (after transform)
  let cursorX = 0, cursorY = 0; // Current cursor position in original coords

  for (const cmd of path.commands) {
    switch (cmd.type) {
      case 'M':
        // Start new subpath - save previous if exists
        if (currentCommands.length > 0 && currentPoints.length > 0) {
          const pathData = currentCommands.join(' ');
          if (!pathData.includes('NaN') && !pathData.includes('Infinity')) {
            const area = calculateSignedArea(currentPoints);
            rawSubpaths.push({ path: pathData, points: [...worldPoints], area });
          }
          currentCommands = [];
          currentPoints = [];
          worldPoints = [];
        }
        if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) continue;
        currentCommands.push(`M ${(offsetX + cmd.x).toFixed(2)},${(offsetY - cmd.y).toFixed(2)}`);
        currentPoints.push([cmd.x, cmd.y]);
        worldPoints.push([offsetX + cmd.x, offsetY - cmd.y]);
        cursorX = cmd.x;
        cursorY = cmd.y;
        break;
      case 'L':
        if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) continue;
        currentCommands.push(`L ${(offsetX + cmd.x).toFixed(2)},${(offsetY - cmd.y).toFixed(2)}`);
        currentPoints.push([cmd.x, cmd.y]);
        worldPoints.push([offsetX + cmd.x, offsetY - cmd.y]);
        cursorX = cmd.x;
        cursorY = cmd.y;
        break;
      case 'C':
        if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y) ||
            !Number.isFinite(cmd.x1) || !Number.isFinite(cmd.y1) ||
            !Number.isFinite(cmd.x2) || !Number.isFinite(cmd.y2)) continue;
        currentCommands.push(
          `C ${(offsetX + cmd.x1).toFixed(2)},${(offsetY - cmd.y1).toFixed(2)} ` +
          `${(offsetX + cmd.x2).toFixed(2)},${(offsetY - cmd.y2).toFixed(2)} ` +
          `${(offsetX + cmd.x).toFixed(2)},${(offsetY - cmd.y).toFixed(2)}`
        );
        {
          // Sample cubic bezier curve for polygon approximation
          const samples = sampleCubicBezier(
            [cursorX, cursorY],
            [cmd.x1, cmd.y1],
            [cmd.x2, cmd.y2],
            [cmd.x, cmd.y],
            CURVE_SAMPLES
          );
          for (const [sx, sy] of samples) {
            currentPoints.push([sx, sy]);
            worldPoints.push([offsetX + sx, offsetY - sy]);
          }
        }
        cursorX = cmd.x;
        cursorY = cmd.y;
        break;
      case 'Q':
        if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y) ||
            !Number.isFinite(cmd.x1) || !Number.isFinite(cmd.y1)) continue;
        currentCommands.push(
          `Q ${(offsetX + cmd.x1).toFixed(2)},${(offsetY - cmd.y1).toFixed(2)} ` +
          `${(offsetX + cmd.x).toFixed(2)},${(offsetY - cmd.y).toFixed(2)}`
        );
        {
          // Sample quadratic bezier curve for polygon approximation
          const samples = sampleQuadraticBezier(
            [cursorX, cursorY],
            [cmd.x1, cmd.y1],
            [cmd.x, cmd.y],
            CURVE_SAMPLES
          );
          for (const [sx, sy] of samples) {
            currentPoints.push([sx, sy]);
            worldPoints.push([offsetX + sx, offsetY - sy]);
          }
        }
        cursorX = cmd.x;
        cursorY = cmd.y;
        break;
      case 'Z':
        currentCommands.push('Z');
        // End of subpath - save it
        if (currentCommands.length > 1 && currentPoints.length >= 3) {
          const pathData = currentCommands.join(' ');
          if (!pathData.includes('NaN') && !pathData.includes('Infinity')) {
            const area = calculateSignedArea(currentPoints);
            rawSubpaths.push({ path: pathData, points: [...worldPoints], area });
          }
        }
        currentCommands = [];
        currentPoints = [];
        worldPoints = [];
        break;
    }
  }

  // Handle unclosed paths (no Z at end)
  if (currentCommands.length > 0 && currentPoints.length >= 3) {
    const pathData = currentCommands.join(' ');
    if (!pathData.includes('NaN') && !pathData.includes('Infinity')) {
      const area = calculateSignedArea(currentPoints);
      rawSubpaths.push({ path: pathData, points: [...worldPoints], area });
    }
  }

  // Determine holes by absolute area comparison
  // The subpath with largest absolute area is the outer contour, rest are holes
  //
  // LIMITATION: This heuristic assumes a single outer contour per glyph.
  // Glyphs with multiple independent outer contours of similar size (e.g., ':' or '%')
  // may have incorrect hole detection. For such cases, the smaller contour would be
  // incorrectly marked as a hole. This works correctly for typical glyphs with
  // one outer boundary and internal holes (e.g., 'o', 'e', 'a', '8', Korean 'ㅇ').
  if (rawSubpaths.length === 0) return [];
  if (rawSubpaths.length === 1) {
    // Single subpath = always outer (no hole)
    return [{ path: rawSubpaths[0].path, isHole: false, points: rawSubpaths[0].points }];
  }

  // Find the index of the subpath with the largest absolute area
  let maxAbsArea = 0;
  let outerIndex = 0;
  for (let i = 0; i < rawSubpaths.length; i++) {
    const absArea = Math.abs(rawSubpaths[i].area);
    if (absArea > maxAbsArea) {
      maxAbsArea = absArea;
      outerIndex = i;
    }
  }

  // Convert to SubpathInfo with correct isHole flags
  // IMPORTANT: Always put outer first, then holes (for charGroup logic in index.ts)
  const subpaths: SubpathInfo[] = [];

  // First, add the outer contour
  subpaths.push({
    path: rawSubpaths[outerIndex].path,
    isHole: false,
    points: rawSubpaths[outerIndex].points,
  });

  // Then add all holes
  for (let i = 0; i < rawSubpaths.length; i++) {
    if (i !== outerIndex) {
      subpaths.push({
        path: rawSubpaths[i].path,
        isHole: true,
        points: rawSubpaths[i].points,
      });
    }
  }

  return subpaths;
}


/**
 * Result of glyph path conversion with hole detection
 */
export interface GlyphPathsResult {
  paths: string[];
  isHole: boolean[];
  /** Polygon points for each subpath (for booleanDifference) */
  points: [number, number][][];
}

/**
 * Convert text to array of glyph subpaths (multiple per character if needed)
 * This properly handles multi-contour glyphs (e.g., Korean 녕, English 'e', 'a')
 *
 * @param text - Text string
 * @param x - X position
 * @param y - Y position (baseline in CAD coordinates)
 * @param fontSize - Font size
 * @param font - Loaded opentype.Font
 * @returns Object with paths array and isHole array indicating which paths are holes
 */
export function textToGlyphPaths(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  font: opentype.Font
): GlyphPathsResult {
  // Validate input coordinates
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(fontSize) || fontSize <= 0) {
    logger.warn(`[text] textToGlyphPaths: invalid input (x=${x}, y=${y}, fontSize=${fontSize})`);
    return { paths: [], isHole: [], points: [] };
  }
  const scale = fontSize / font.unitsPerEm;
  const paths: string[] = [];
  const isHole: boolean[] = [];
  const points: [number, number][][] = [];
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
      // Get all subpaths for this glyph (handles multi-contour glyphs)
      const subpaths = glyphPathToSvgSubpaths(glyphPath, currentX, y);
      for (const sp of subpaths) {
        paths.push(sp.path);
        isHole.push(sp.isHole);
        points.push(sp.points);
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

  return { paths, isHole, points };
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

  // Get individual glyph paths with hole detection
  const glyphResult = textToGlyphPaths(text, adjustedX, adjustedY, fontSize, font);

  return {
    path: glyphResult.paths.join(' '), // Combined path for single entity (may have issues)
    paths: glyphResult.paths, // Individual glyph paths for separate entities
    isHole: glyphResult.isHole, // Which paths are holes (inner contours)
    points: glyphResult.points, // Polygon points for booleanDifference
    width: metrics.width,
    height: metrics.height,
    adjustedX,
    adjustedY,
  };
}
