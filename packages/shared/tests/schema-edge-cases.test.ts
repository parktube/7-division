import { describe, it, expect } from 'vitest';
import {
  TransformSchema,
  StyleSchema,
  MetadataSchema,
  BoundsSchema,
  ComputedSchema,
  EntitySchema,
  SceneTreeNodeSchema,
  WSMessageSchema,
  type Transform,
  type Entity,
} from '../src/index';
import { z } from 'zod';

// ─── Helper: Stroke & CSSColor schemas aren't exported, so we test them
// indirectly through sketch_update messages ───────────────────────────

const ts = Date.now();

describe('TransformSchema – edge cases', () => {
  it('should accept identity transform', () => {
    const identity: Transform = {
      translate: [0, 0],
      rotate: 0,
      scale: [1, 1],
    };
    expect(TransformSchema.parse(identity)).toEqual(identity);
  });

  it('should accept transform with optional pivot', () => {
    const result = TransformSchema.safeParse({
      translate: [10, -20],
      rotate: 45,
      scale: [2, 0.5],
      pivot: [100, 100],
    });
    expect(result.success).toBe(true);
    expect(result.data?.pivot).toEqual([100, 100]);
  });

  it('should reject translate with 3 elements', () => {
    const result = TransformSchema.safeParse({
      translate: [1, 2, 3],
      rotate: 0,
      scale: [1, 1],
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing rotate field', () => {
    const result = TransformSchema.safeParse({
      translate: [0, 0],
      scale: [1, 1],
    });
    expect(result.success).toBe(false);
  });

  it('should accept negative scale values', () => {
    const result = TransformSchema.safeParse({
      translate: [0, 0],
      rotate: 0,
      scale: [-1, -1],
    });
    expect(result.success).toBe(true);
  });
});

describe('StyleSchema – edge cases', () => {
  it('should accept empty style (no fill, no stroke)', () => {
    const result = StyleSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept null fill', () => {
    const result = StyleSchema.safeParse({ fill: null });
    expect(result.success).toBe(true);
  });

  it('should accept null stroke', () => {
    const result = StyleSchema.safeParse({ stroke: null });
    expect(result.success).toBe(true);
  });

  it('should accept full style with all stroke options', () => {
    const result = StyleSchema.safeParse({
      fill: { color: [0.2, 0.4, 0.6, 1.0] },
      stroke: {
        width: 2,
        color: [0, 0, 0, 1],
        dash: [5, 3],
        cap: 'round',
        join: 'miter',
      },
    });
    expect(result.success).toBe(true);
  });

  it('should accept stroke with null dash', () => {
    const result = StyleSchema.safeParse({
      stroke: {
        width: 1,
        color: [1, 1, 1, 1],
        dash: null,
      },
    });
    expect(result.success).toBe(true);
  });

  it('should reject fill with wrong color tuple length', () => {
    const result = StyleSchema.safeParse({
      fill: { color: [1, 0, 0] }, // needs 4 elements (RGBA)
    });
    expect(result.success).toBe(false);
  });
});

describe('BoundsSchema', () => {
  it('should accept valid bounds', () => {
    const result = BoundsSchema.safeParse({
      min: [-100, -50],
      max: [100, 50],
    });
    expect(result.success).toBe(true);
  });

  it('should accept zero-area bounds (point)', () => {
    const result = BoundsSchema.safeParse({
      min: [0, 0],
      max: [0, 0],
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing max', () => {
    const result = BoundsSchema.safeParse({ min: [0, 0] });
    expect(result.success).toBe(false);
  });
});

describe('MetadataSchema', () => {
  it('should accept empty metadata', () => {
    expect(MetadataSchema.safeParse({}).success).toBe(true);
  });

  it('should accept full metadata', () => {
    const result = MetadataSchema.safeParse({
      name: 'Layer 1 Circle',
      layer: 'foreground',
      locked: true,
      z_index: 10,
    });
    expect(result.success).toBe(true);
  });

  it('should accept null layer', () => {
    const result = MetadataSchema.safeParse({ layer: null });
    expect(result.success).toBe(true);
  });
});

describe('ComputedSchema', () => {
  it('should accept empty computed', () => {
    expect(ComputedSchema.safeParse({}).success).toBe(true);
  });

  it('should accept full computed data', () => {
    const result = ComputedSchema.safeParse({
      world_bounds: { min: [0, 0], max: [100, 100] },
      local_bounds: { min: [-50, -50], max: [50, 50] },
      center: [50, 50],
      size: [100, 100],
    });
    expect(result.success).toBe(true);
  });
});

describe('EntitySchema – edge cases', () => {
  const baseEntity = {
    id: 'test-entity',
    entity_type: 'Circle' as const,
    geometry: { Circle: { center: [0, 0], radius: 25 } },
    transform: { translate: [0, 0], rotate: 0, scale: [1, 1] },
    style: {},
  };

  it('should validate minimal entity', () => {
    const result = EntitySchema.safeParse(baseEntity);
    expect(result.success).toBe(true);
  });

  it('should validate entity with all optional fields', () => {
    const full = {
      ...baseEntity,
      metadata: { name: 'My Circle', layer: 'main', locked: false, z_index: 5 },
      children: ['child1', 'child2'],
      parent_id: 'group1',
      computed: {
        world_bounds: { min: [-25, -25], max: [25, 25] },
        center: [0, 0],
        size: [50, 50],
      },
    };
    const result = EntitySchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it('should reject invalid entity_type', () => {
    const result = EntitySchema.safeParse({
      ...baseEntity,
      entity_type: 'Triangle', // not in enum
    });
    expect(result.success).toBe(false);
  });

  it.each(['Circle', 'Rect', 'Line', 'Polygon', 'Arc', 'Bezier', 'Text', 'Group'] as const)(
    'should accept entity_type "%s"',
    (entityType) => {
      const result = EntitySchema.safeParse({
        ...baseEntity,
        entity_type: entityType,
      });
      expect(result.success).toBe(true);
    },
  );

  it('should reject entity without id', () => {
    const { id, ...noId } = baseEntity;
    const result = EntitySchema.safeParse(noId);
    expect(result.success).toBe(false);
  });
});

describe('SceneTreeNodeSchema – recursive', () => {
  it('should validate flat node', () => {
    const result = SceneTreeNodeSchema.safeParse({
      id: 'node1',
      name: 'Node 1',
      type: 'Circle',
      zOrder: 0,
    });
    expect(result.success).toBe(true);
  });

  it('should validate nested children', () => {
    const result = SceneTreeNodeSchema.safeParse({
      id: 'group1',
      name: 'Group',
      type: 'Group',
      zOrder: 0,
      children: [
        { id: 'child1', name: 'Child 1', type: 'Rect', zOrder: 1 },
        {
          id: 'subgroup',
          name: 'Sub Group',
          type: 'Group',
          zOrder: 2,
          children: [
            { id: 'deep', name: 'Deep Node', type: 'Line', zOrder: 3 },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('sketch_update – CSS color validation', () => {
  const makeSketchMsg = (color: string) => ({
    type: 'sketch_update',
    data: {
      strokes: [
        {
          id: 'stroke-1',
          points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
          color,
          width: 2,
        },
      ],
    },
    timestamp: ts,
  });

  it('should accept hex color #fff', () => {
    expect(WSMessageSchema.safeParse(makeSketchMsg('#fff')).success).toBe(true);
  });

  it('should accept hex color #ff0000', () => {
    expect(WSMessageSchema.safeParse(makeSketchMsg('#ff0000')).success).toBe(true);
  });

  it('should accept hex color with alpha #ff000080', () => {
    expect(WSMessageSchema.safeParse(makeSketchMsg('#ff000080')).success).toBe(true);
  });

  it('should accept rgb() format', () => {
    expect(WSMessageSchema.safeParse(makeSketchMsg('rgb(255,0,0)')).success).toBe(true);
  });

  it('should accept rgba() format', () => {
    expect(WSMessageSchema.safeParse(makeSketchMsg('rgba(255,0,0,0.5)')).success).toBe(true);
  });

  it('should accept named color', () => {
    expect(WSMessageSchema.safeParse(makeSketchMsg('red')).success).toBe(true);
  });

  it('should reject empty string color', () => {
    expect(WSMessageSchema.safeParse(makeSketchMsg('')).success).toBe(false);
  });

  it('should reject numeric string as color', () => {
    expect(WSMessageSchema.safeParse(makeSketchMsg('12345')).success).toBe(false);
  });
});

describe('selection_update – client message', () => {
  it('should accept selection with locked and hidden entities', () => {
    const msg = {
      type: 'selection_update',
      data: {
        selected_entities: ['e1', 'e2'],
        locked_entities: ['e3'],
        hidden_entities: ['e4'],
      },
      timestamp: ts,
    };
    expect(WSMessageSchema.safeParse(msg).success).toBe(true);
  });

  it('should accept selection_update with only required fields', () => {
    const msg = {
      type: 'selection_update',
      data: {
        selected_entities: [],
      },
      timestamp: ts,
    };
    expect(WSMessageSchema.safeParse(msg).success).toBe(true);
  });
});
