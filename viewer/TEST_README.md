# Viewer Tests

## Overview

This directory contains comprehensive unit tests for the JavaScript viewer/renderer module.

## Test File

- **renderer.test.js** - Unit tests for all pure functions and rendering logic in renderer.js

## Running Tests

```bash
# Run JavaScript tests only
npm run test:js

# Run Rust tests only
npm test

# Run all tests (Rust + JavaScript)
npm run test:all
```

## Test Coverage

The test suite covers:

### Pure Utility Functions
- `clamp()` - Value clamping with various ranges and edge cases
- `toCssColor()` - RGBA array to CSS color conversion with validation
- `mapLineCap()` - LineCap enum to CSS value mapping
- `mapLineJoin()` - LineJoin enum to CSS value mapping
- `sanitizeDash()` - Dash pattern validation and sanitization
- `resolveStroke()` - Stroke style resolution with defaults
- `formatTime()` - Time formatting for display

### Geometry Validation
- Line geometry with 2+ points validation
- Polyline support with multiple points
- Circle geometry validation (center, radius)
- Rectangle geometry validation (origin, dimensions)
- Invalid input handling (NaN, Infinity, null, undefined)

### Style Processing
- Stroke style application (width, color, dash, cap, join)
- Fill style processing
- Default style fallbacks
- Color clamping and validation

### Entity Type Handling
- Valid entity type recognition (Line, Circle, Rect)
- Unknown entity type detection
- Missing entity_type handling

### Scene Structure
- Scene with entities array validation
- Empty scene handling
- Multiple entities validation
- Scene name handling

### Edge Cases
- Zero/negative dimensions
- High pixel ratios
- Fractional dimensions
- All-zero and all-max colors
- Very large/small dash values
- Unicode in names
- Negative coordinates
- Floating point precision

### State Management
- Scene signature generation
- Change detection via JSON comparison
- Empty vs populated scene states

## Test Philosophy

Tests focus on:
1. **Pure functions** - Most renderer functions are pure and easily testable
2. **Input validation** - Comprehensive edge case and error condition coverage
3. **Type safety** - Validation of expected data structures
4. **Edge cases** - NaN, Infinity, null, undefined, negative values, etc.
5. **Real-world scenarios** - Multiple entities, various geometries, style combinations

## Adding New Tests

When adding new rendering features:

1. Add pure function tests for any new utility functions
2. Add validation tests for new geometry types
3. Add style processing tests for new style properties
4. Add integration scenarios with multiple entity types
5. Always test edge cases (null, undefined, NaN, Infinity)

## Node.js Built-in Test Runner

This project uses Node.js's built-in test runner (available in Node 18+), which provides:
- Native test support without external dependencies
- Fast execution
- Built-in assertion library
- Describe/it/beforeEach structure similar to Jest/Mocha

No additional test framework installation required!