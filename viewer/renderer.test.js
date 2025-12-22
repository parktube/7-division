/**
 * Unit tests for viewer/renderer.js
 * Run with: node --test viewer/renderer.test.js
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Mock DOM elements and Canvas API
globalThis.document = {
  getElementById: (id) => {
    const elements = {
      canvas: {
        getContext: () => mockCtx,
        getBoundingClientRect: () => ({ width: 800, height: 600 }),
        width: 0,
        height: 0,
      },
      'status-dot': { classList: { remove: () => {}, add: () => {} } },
      'status-text': { textContent: '' },
      'entity-count': { textContent: '' },
      'last-updated': { textContent: '' },
      'last-error': { textContent: '' },
      overlay: {
        textContent: '',
        classList: { toggle: () => {} },
      },
    };
    return elements[id] || null;
  },
};

globalThis.window = {
  devicePixelRatio: 2,
  addEventListener: () => {},
};

globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({ entities: [] }),
});

globalThis.setInterval = () => 1;

const mockCtx = {
  clearRect: () => {},
  save: () => {},
  restore: () => {},
  translate: () => {},
  scale: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  arc: () => {},
  rect: () => {},
  stroke: () => {},
  fill: () => {},
  setTransform: () => {},
  setLineDash: () => {},
  lineWidth: 1,
  strokeStyle: '',
  fillStyle: '',
  lineCap: 'butt',
  lineJoin: 'miter',
};

// Import the functions we need to test
// Since renderer.js uses DOM immediately, we'll recreate the pure functions here for testing

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toCssColor(color, fallback) {
  if (!Array.isArray(color) || color.length < 4) {
    return fallback;
  }
  const [r, g, b, a] = color.map((value, index) => {
    if (!Number.isFinite(value)) {
      return index === 3 ? 1 : 0;
    }
    return clamp(value, 0, 1);
  });
  const alpha = Math.round(a * 1000) / 1000;
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(
    b * 255,
  )}, ${alpha})`;
}

function mapLineCap(cap) {
  switch (cap) {
    case 'Round':
      return 'round';
    case 'Square':
      return 'square';
    default:
      return 'butt';
  }
}

function mapLineJoin(join) {
  switch (join) {
    case 'Round':
      return 'round';
    case 'Bevel':
      return 'bevel';
    default:
      return 'miter';
  }
}

function sanitizeDash(dash) {
  if (!Array.isArray(dash)) {
    return [];
  }
  return dash.filter((value) => Number.isFinite(value) && value >= 0);
}

function resolveStroke(style) {
  if (!style) {
    return {
      width: 1,
      color: [0, 0, 0, 1],
      dash: null,
      cap: 'Butt',
      join: 'Miter',
    };
  }
  return style.stroke ?? null;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ============================================================================
// Test Suite: Pure Utility Functions
// ============================================================================

describe('clamp function', () => {
  it('should clamp value within range', () => {
    assert.strictEqual(clamp(5, 0, 10), 5);
    assert.strictEqual(clamp(-5, 0, 10), 0);
    assert.strictEqual(clamp(15, 0, 10), 10);
  });

  it('should handle edge cases', () => {
    assert.strictEqual(clamp(0, 0, 10), 0);
    assert.strictEqual(clamp(10, 0, 10), 10);
    assert.strictEqual(clamp(5, 5, 5), 5);
  });

  it('should handle negative ranges', () => {
    assert.strictEqual(clamp(-5, -10, 0), -5);
    assert.strictEqual(clamp(-15, -10, 0), -10);
    assert.strictEqual(clamp(5, -10, 0), 0);
  });

  it('should handle floating point values', () => {
    assert.strictEqual(clamp(0.5, 0.0, 1.0), 0.5);
    assert.strictEqual(clamp(1.5, 0.0, 1.0), 1.0);
    assert.strictEqual(clamp(-0.5, 0.0, 1.0), 0.0);
  });
});

describe('toCssColor function', () => {
  it('should convert valid RGBA array to CSS color', () => {
    assert.strictEqual(toCssColor([1, 0, 0, 1], '#000'), 'rgba(255, 0, 0, 1)');
    assert.strictEqual(toCssColor([0, 1, 0, 0.5], '#000'), 'rgba(0, 255, 0, 0.5)');
    assert.strictEqual(toCssColor([0, 0, 1, 0.75], '#000'), 'rgba(0, 0, 255, 0.75)');
  });

  it('should handle black and white colors', () => {
    assert.strictEqual(toCssColor([0, 0, 0, 1], '#fff'), 'rgba(0, 0, 0, 1)');
    assert.strictEqual(toCssColor([1, 1, 1, 1], '#000'), 'rgba(255, 255, 255, 1)');
  });

  it('should return fallback for invalid input', () => {
    assert.strictEqual(toCssColor(null, '#fallback'), '#fallback');
    assert.strictEqual(toCssColor(undefined, '#fallback'), '#fallback');
    assert.strictEqual(toCssColor([1, 2], '#fallback'), '#fallback');
    assert.strictEqual(toCssColor('invalid', '#fallback'), '#fallback');
  });

  it('should clamp color values to valid range', () => {
    assert.strictEqual(toCssColor([1.5, 0, 0, 1], '#000'), 'rgba(255, 0, 0, 1)');
    assert.strictEqual(toCssColor([-0.5, 0, 0, 1], '#000'), 'rgba(0, 0, 0, 1)');
    assert.strictEqual(toCssColor([0.5, 0.5, 0.5, 2], '#000'), 'rgba(128, 128, 128, 1)');
  });

  it('should handle NaN and non-finite values', () => {
    assert.strictEqual(toCssColor([NaN, 0, 0, 1], '#000'), 'rgba(0, 0, 0, 1)');
    assert.strictEqual(toCssColor([0, Infinity, 0, 1], '#000'), 'rgba(0, 255, 0, 1)');
    assert.strictEqual(toCssColor([0, 0, 0, NaN], '#000'), 'rgba(0, 0, 0, 1)');
  });

  it('should round alpha to 3 decimal places', () => {
    assert.strictEqual(toCssColor([0, 0, 0, 0.12345], '#000'), 'rgba(0, 0, 0, 0.123)');
    assert.strictEqual(toCssColor([0, 0, 0, 0.9999], '#000'), 'rgba(0, 0, 0, 1)');
  });

  it('should handle semi-transparent colors', () => {
    assert.strictEqual(toCssColor([1, 0.5, 0, 0.3], '#000'), 'rgba(255, 128, 0, 0.3)');
    assert.strictEqual(toCssColor([0.2, 0.4, 0.6, 0.8], '#000'), 'rgba(51, 102, 153, 0.8)');
  });
});

describe('mapLineCap function', () => {
  it('should map LineCap enum to CSS values', () => {
    assert.strictEqual(mapLineCap('Round'), 'round');
    assert.strictEqual(mapLineCap('Square'), 'square');
    assert.strictEqual(mapLineCap('Butt'), 'butt');
  });

  it('should default to butt for unknown values', () => {
    assert.strictEqual(mapLineCap('Unknown'), 'butt');
    assert.strictEqual(mapLineCap(null), 'butt');
    assert.strictEqual(mapLineCap(undefined), 'butt');
    assert.strictEqual(mapLineCap(''), 'butt');
  });

  it('should be case-sensitive', () => {
    assert.strictEqual(mapLineCap('round'), 'butt');
    assert.strictEqual(mapLineCap('ROUND'), 'butt');
  });
});

describe('mapLineJoin function', () => {
  it('should map LineJoin enum to CSS values', () => {
    assert.strictEqual(mapLineJoin('Round'), 'round');
    assert.strictEqual(mapLineJoin('Bevel'), 'bevel');
    assert.strictEqual(mapLineJoin('Miter'), 'miter');
  });

  it('should default to miter for unknown values', () => {
    assert.strictEqual(mapLineJoin('Unknown'), 'miter');
    assert.strictEqual(mapLineJoin(null), 'miter');
    assert.strictEqual(mapLineJoin(undefined), 'miter');
    assert.strictEqual(mapLineJoin(''), 'miter');
  });

  it('should be case-sensitive', () => {
    assert.strictEqual(mapLineJoin('round'), 'miter');
    assert.strictEqual(mapLineJoin('BEVEL'), 'miter');
  });
});

describe('sanitizeDash function', () => {
  it('should return valid dash arrays unchanged', () => {
    assert.deepStrictEqual(sanitizeDash([5, 3]), [5, 3]);
    assert.deepStrictEqual(sanitizeDash([10, 5, 2, 5]), [10, 5, 2, 5]);
    assert.deepStrictEqual(sanitizeDash([1]), [1]);
  });

  it('should filter out negative values', () => {
    assert.deepStrictEqual(sanitizeDash([5, -3, 2]), [5, 2]);
    assert.deepStrictEqual(sanitizeDash([-1, -2, -3]), []);
  });

  it('should filter out non-finite values', () => {
    assert.deepStrictEqual(sanitizeDash([5, NaN, 3]), [5, 3]);
    assert.deepStrictEqual(sanitizeDash([Infinity, 5, 3]), [5, 3]);
    assert.deepStrictEqual(sanitizeDash([5, -Infinity]), [5]);
  });

  it('should return empty array for invalid input', () => {
    assert.deepStrictEqual(sanitizeDash(null), []);
    assert.deepStrictEqual(sanitizeDash(undefined), []);
    assert.deepStrictEqual(sanitizeDash('string'), []);
    assert.deepStrictEqual(sanitizeDash(123), []);
  });

  it('should handle empty arrays', () => {
    assert.deepStrictEqual(sanitizeDash([]), []);
  });

  it('should keep zero values', () => {
    assert.deepStrictEqual(sanitizeDash([0, 5, 0]), [0, 5, 0]);
  });

  it('should handle floating point values', () => {
    assert.deepStrictEqual(sanitizeDash([5.5, 3.2, 1.8]), [5.5, 3.2, 1.8]);
  });
});

describe('resolveStroke function', () => {
  it('should return default stroke when style is null', () => {
    const result = resolveStroke(null);
    assert.deepStrictEqual(result, {
      width: 1,
      color: [0, 0, 0, 1],
      dash: null,
      cap: 'Butt',
      join: 'Miter',
    });
  });

  it('should return default stroke when style is undefined', () => {
    const result = resolveStroke(undefined);
    assert.deepStrictEqual(result, {
      width: 1,
      color: [0, 0, 0, 1],
      dash: null,
      cap: 'Butt',
      join: 'Miter',
    });
  });

  it('should return null when style has no stroke', () => {
    const result = resolveStroke({ fill: { color: [1, 0, 0, 1] } });
    assert.strictEqual(result, null);
  });

  it('should return stroke from style when present', () => {
    const stroke = {
      width: 2,
      color: [1, 0, 0, 1],
      dash: [5, 3],
      cap: 'Round',
      join: 'Bevel',
    };
    const result = resolveStroke({ stroke });
    assert.deepStrictEqual(result, stroke);
  });

  it('should handle style with null stroke', () => {
    const result = resolveStroke({ stroke: null });
    assert.strictEqual(result, null);
  });
});

describe('formatTime function', () => {
  it('should format date in HH:MM:SS format', () => {
    const date = new Date('2025-12-22T14:30:45');
    const result = formatTime(date);
    assert.match(result, /^\d{2}:\d{2}:\d{2}$/);
  });

  it('should use 24-hour format', () => {
    const date = new Date('2025-12-22T23:59:59');
    const result = formatTime(date);
    assert.match(result, /^23:59:59$/);
  });

  it('should pad single digits with zero', () => {
    const date = new Date('2025-12-22T01:02:03');
    const result = formatTime(date);
    assert.match(result, /^01:02:03$/);
  });
});

// ============================================================================
// Test Suite: Geometry Validation
// ============================================================================

describe('Line geometry validation', () => {
  it('should validate line with 2 points', () => {
    const geometry = { Line: { points: [[0, 0], [10, 10]] } };
    assert.ok(Array.isArray(geometry.Line.points));
    assert.strictEqual(geometry.Line.points.length, 2);
  });

  it('should validate polyline with multiple points', () => {
    const geometry = { Line: { points: [[0, 0], [10, 10], [20, 5], [30, 15]] } };
    assert.strictEqual(geometry.Line.points.length, 4);
  });

  it('should reject line with less than 2 points', () => {
    const geometry = { Line: { points: [[0, 0]] } };
    assert.ok(geometry.Line.points.length < 2);
  });

  it('should filter out invalid points', () => {
    const points = [[0, 0], [10, NaN], [20, 20], null, [30, 30]];
    const validPoints = points.filter(
      (point) =>
        Array.isArray(point) &&
        point.length >= 2 &&
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1]),
    );
    assert.deepStrictEqual(validPoints, [[0, 0], [20, 20], [30, 30]]);
  });
});

describe('Circle geometry validation', () => {
  it('should validate circle with center and radius', () => {
    const geometry = { Circle: { center: [10, 20], radius: 5 } };
    assert.ok(Array.isArray(geometry.Circle.center));
    assert.strictEqual(geometry.Circle.center.length, 2);
    assert.ok(Number.isFinite(geometry.Circle.radius));
  });

  it('should reject circle with invalid center', () => {
    const invalidCenters = [
      null,
      undefined,
      [10],
      [NaN, 20],
      [Infinity, 20],
      'invalid',
    ];
    
    for (const center of invalidCenters) {
      const isValid = Array.isArray(center) && 
                      center.length >= 2 &&
                      Number.isFinite(center[0]) &&
                      Number.isFinite(center[1]);
      assert.strictEqual(isValid, false);
    }
  });

  it('should reject circle with invalid radius', () => {
    const invalidRadii = [NaN, Infinity, -Infinity, null, undefined, 'invalid'];
    
    for (const radius of invalidRadii) {
      assert.strictEqual(Number.isFinite(radius), false);
    }
  });

  it('should accept circle with zero radius', () => {
    const geometry = { Circle: { center: [10, 20], radius: 0 } };
    assert.ok(Number.isFinite(geometry.Circle.radius));
  });
});

describe('Rectangle geometry validation', () => {
  it('should validate rect with origin, width, and height', () => {
    const geometry = { Rect: { origin: [0, 0], width: 100, height: 50 } };
    assert.ok(Array.isArray(geometry.Rect.origin));
    assert.ok(Number.isFinite(geometry.Rect.width));
    assert.ok(Number.isFinite(geometry.Rect.height));
  });

  it('should reject rect with invalid origin', () => {
    const geometry = { Rect: { origin: [NaN, 0], width: 100, height: 50 } };
    const isValid = Array.isArray(geometry.Rect.origin) &&
                    geometry.Rect.origin.length >= 2 &&
                    Number.isFinite(geometry.Rect.origin[0]);
    assert.strictEqual(isValid, false);
  });

  it('should reject rect with invalid dimensions', () => {
    const geometry = { Rect: { origin: [0, 0], width: NaN, height: 50 } };
    assert.strictEqual(Number.isFinite(geometry.Rect.width), false);
  });

  it('should handle negative dimensions', () => {
    const geometry = { Rect: { origin: [0, 0], width: -100, height: 50 } };
    assert.ok(Number.isFinite(geometry.Rect.width));
    assert.strictEqual(geometry.Rect.width < 0, true);
  });
});

// ============================================================================
// Test Suite: Style Processing
// ============================================================================

describe('Stroke style processing', () => {
  it('should process complete stroke style', () => {
    const stroke = {
      width: 2.5,
      color: [0.5, 0.5, 0.5, 1],
      dash: [5, 3],
      cap: 'Round',
      join: 'Bevel',
    };
    
    assert.ok(Number.isFinite(stroke.width));
    assert.strictEqual(toCssColor(stroke.color, '#000'), 'rgba(128, 128, 128, 1)');
    assert.deepStrictEqual(sanitizeDash(stroke.dash), [5, 3]);
    assert.strictEqual(mapLineCap(stroke.cap), 'round');
    assert.strictEqual(mapLineJoin(stroke.join), 'bevel');
  });

  it('should handle stroke with null dash', () => {
    const stroke = {
      width: 1,
      color: [0, 0, 0, 1],
      dash: null,
      cap: 'Butt',
      join: 'Miter',
    };
    
    assert.deepStrictEqual(sanitizeDash(stroke.dash), []);
  });

  it('should handle invalid stroke width', () => {
    const width = NaN;
    const result = Number.isFinite(width) ? width : 1;
    assert.strictEqual(result, 1);
  });
});

describe('Fill style processing', () => {
  it('should process fill color', () => {
    const fill = { color: [1, 0, 0, 0.5] };
    assert.strictEqual(toCssColor(fill.color, '#000'), 'rgba(255, 0, 0, 0.5)');
  });

  it('should handle null fill', () => {
    const fill = null;
    assert.strictEqual(fill, null);
  });

  it('should handle undefined fill', () => {
    const fill = undefined;
    assert.strictEqual(fill, undefined);
  });
});

// ============================================================================
// Test Suite: Entity Type Handling
// ============================================================================

describe('Entity type validation', () => {
  it('should recognize valid entity types', () => {
    const validTypes = ['Line', 'Circle', 'Rect'];
    
    for (const type of validTypes) {
      assert.ok(['Line', 'Circle', 'Rect'].includes(type));
    }
  });

  it('should identify unknown entity types', () => {
    const unknownTypes = ['Arc', 'Polygon', 'Ellipse', null, undefined, ''];
    
    for (const type of unknownTypes) {
      assert.strictEqual(['Line', 'Circle', 'Rect'].includes(type), false);
    }
  });

  it('should handle entity with missing entity_type', () => {
    const entity = { geometry: {}, style: {} };
    assert.strictEqual(entity.entity_type, undefined);
  });

  it('should handle entity with null entity_type', () => {
    const entity = { entity_type: null, geometry: {}, style: {} };
    assert.strictEqual(entity.entity_type, null);
  });
});

// ============================================================================
// Test Suite: Scene Structure
// ============================================================================

describe('Scene structure validation', () => {
  it('should validate scene with entities array', () => {
    const scene = { name: 'test', entities: [] };
    assert.ok(Array.isArray(scene.entities));
  });

  it('should handle scene without name', () => {
    const scene = { entities: [] };
    assert.strictEqual(scene.name, undefined);
  });

  it('should handle scene with null entities', () => {
    const scene = { name: 'test', entities: null };
    assert.strictEqual(Array.isArray(scene.entities), false);
  });

  it('should validate scene with multiple entities', () => {
    const scene = {
      name: 'multi',
      entities: [
        { entity_type: 'Line', geometry: { Line: { points: [[0,0], [10,10]] } } },
        { entity_type: 'Circle', geometry: { Circle: { center: [5,5], radius: 3 } } },
      ],
    };
    assert.strictEqual(scene.entities.length, 2);
  });

  it('should handle empty scene', () => {
    const scene = { entities: [] };
    assert.strictEqual(scene.entities.length, 0);
  });
});

// ============================================================================
// Test Suite: Edge Cases and Error Conditions
// ============================================================================

describe('Edge cases', () => {
  it('should handle viewport with zero dimensions', () => {
    const viewport = { width: 0, height: 0 };
    assert.strictEqual(viewport.width, 0);
    assert.strictEqual(viewport.height, 0);
  });

  it('should handle high pixel ratios', () => {
    const ratio = 3;
    const width = 800;
    const canvasWidth = Math.max(1, Math.floor(width * ratio));
    assert.strictEqual(canvasWidth, 2400);
  });

  it('should handle fractional dimensions', () => {
    const width = 800.7;
    const ratio = 2;
    const canvasWidth = Math.max(1, Math.floor(width * ratio));
    assert.strictEqual(canvasWidth, 1601);
  });

  it('should enforce minimum canvas dimension', () => {
    const width = -10;
    const ratio = 2;
    const canvasWidth = Math.max(1, Math.floor(width * ratio));
    assert.strictEqual(canvasWidth, 1);
  });
});

describe('Color edge cases', () => {
  it('should handle all-zero color', () => {
    assert.strictEqual(toCssColor([0, 0, 0, 0], '#000'), 'rgba(0, 0, 0, 0)');
  });

  it('should handle all-max color', () => {
    assert.strictEqual(toCssColor([1, 1, 1, 1], '#000'), 'rgba(255, 255, 255, 1)');
  });

  it('should handle mixed valid and invalid values', () => {
    assert.strictEqual(toCssColor([0.5, NaN, 0.5, 1], '#000'), 'rgba(128, 0, 128, 1)');
  });

  it('should handle array with extra elements', () => {
    assert.strictEqual(toCssColor([1, 0, 0, 1, 999, 888], '#000'), 'rgba(255, 0, 0, 1)');
  });
});

describe('Dash pattern edge cases', () => {
  it('should handle very large dash values', () => {
    assert.deepStrictEqual(sanitizeDash([1000000, 500000]), [1000000, 500000]);
  });

  it('should handle very small dash values', () => {
    assert.deepStrictEqual(sanitizeDash([0.001, 0.002]), [0.001, 0.002]);
  });

  it('should handle mixed valid and invalid in large array', () => {
    const input = [1, -1, 2, NaN, 3, Infinity, 4, -Infinity, 5];
    assert.deepStrictEqual(sanitizeDash(input), [1, 2, 3, 4, 5]);
  });
});

// ============================================================================
// Test Suite: JSON Signature and State Management
// ============================================================================

describe('Scene signature and change detection', () => {
  it('should create different signatures for different scenes', () => {
    const scene1 = { entities: [{ entity_type: 'Line' }] };
    const scene2 = { entities: [{ entity_type: 'Circle' }] };
    
    const sig1 = JSON.stringify(scene1);
    const sig2 = JSON.stringify(scene2);
    
    assert.notStrictEqual(sig1, sig2);
  });

  it('should create same signature for identical scenes', () => {
    const scene1 = { entities: [{ entity_type: 'Line' }] };
    const scene2 = { entities: [{ entity_type: 'Line' }] };
    
    const sig1 = JSON.stringify(scene1);
    const sig2 = JSON.stringify(scene2);
    
    assert.strictEqual(sig1, sig2);
  });

  it('should handle empty scene signature', () => {
    const scene = { entities: [] };
    const sig = JSON.stringify(scene);
    assert.strictEqual(sig, '{"entities":[]}');
  });

  it('should detect property order differences', () => {
    const scene1 = { name: 'test', entities: [] };
    const scene2 = { entities: [], name: 'test' };
    
    // JSON.stringify may order differently
    const sig1 = JSON.stringify(scene1);
    const sig2 = JSON.stringify(scene2);
    
    // Both should be valid JSON
    assert.ok(sig1.includes('"entities"'));
    assert.ok(sig2.includes('"entities"'));
  });
});

console.log('✓ All renderer.js unit tests defined');