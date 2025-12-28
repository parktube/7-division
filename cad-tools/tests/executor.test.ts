import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CADExecutor } from '../src/executor.js';

describe('CADExecutor', () => {
  let executor: CADExecutor;

  beforeEach(() => {
    executor = CADExecutor.create('test-scene');
  });

  afterEach(() => {
    executor.free();
  });

  describe('create', () => {
    it('should create executor with scene name', () => {
      expect(executor.getSceneName()).toBe('test-scene');
    });

    it('should start with zero entities', () => {
      expect(executor.getEntityCount()).toBe(0);
    });
  });

  describe('exec - primitives', () => {
    it('should draw rect', () => {
      const result = executor.exec('draw_rect', {
        name: 'wall',
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      });

      expect(result.success).toBe(true);
      expect(result.entity).toBe('wall');
      expect(result.type).toBe('rect');
      expect(executor.getEntityCount()).toBe(1);
    });

    it('should draw line', () => {
      const result = executor.exec('draw_line', {
        name: 'spine',
        points: [0, 0, 100, 100],
      });

      expect(result.success).toBe(true);
      expect(result.entity).toBe('spine');
      expect(result.type).toBe('line');
    });

    it('should draw circle', () => {
      const result = executor.exec('draw_circle', {
        name: 'head',
        x: 50,
        y: 50,
        radius: 25,
      });

      expect(result.success).toBe(true);
      expect(result.entity).toBe('head');
      expect(result.type).toBe('circle');
    });

    it('should draw arc', () => {
      const result = executor.exec('draw_arc', {
        name: 'door',
        cx: 0,
        cy: 0,
        radius: 50,
        start_angle: 0,
        end_angle: Math.PI / 2,
      });

      expect(result.success).toBe(true);
      expect(result.entity).toBe('door');
      expect(result.type).toBe('arc');
    });

    it('should draw rect with style object', () => {
      const result = executor.exec('draw_rect', {
        name: 'styled-wall',
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        style: {
          stroke: { color: [1, 0, 0, 1], width: 2 },
          fill: { color: [0.5, 0.5, 0.5, 0.5] },
        },
      });

      expect(result.success).toBe(true);
      expect(result.entity).toBe('styled-wall');

      // JSON에 스타일이 반영되었는지 확인
      const json = JSON.parse(executor.exportScene());
      const entity = json.entities.find((e: { metadata: { name: string } }) => e.metadata.name === 'styled-wall');
      expect(entity.style.stroke.color).toEqual([1, 0, 0, 1]);
      expect(entity.style.fill.color).toEqual([0.5, 0.5, 0.5, 0.5]);
    });
  });

  describe('exec - style', () => {
    beforeEach(() => {
      executor.exec('draw_rect', {
        name: 'box',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
    });

    it('should set stroke with object', () => {
      const result = executor.exec('set_stroke', {
        name: 'box',
        stroke: { color: [1, 0, 0, 1], width: 2 },  // 객체로 전달
      });

      expect(result.success).toBe(true);
      expect(result.entity).toBe('box');
    });

    it('should set fill with object', () => {
      const result = executor.exec('set_fill', {
        name: 'box',
        fill: { color: [0, 1, 0, 0.5] },  // 객체로 전달
      });

      expect(result.success).toBe(true);
    });

    it('should remove stroke', () => {
      const result = executor.exec('remove_stroke', { name: 'box' });
      expect(result.success).toBe(true);
    });

    it('should remove fill', () => {
      const result = executor.exec('remove_fill', { name: 'box' });
      expect(result.success).toBe(true);
    });

    it('should return false for unknown entity', () => {
      const result = executor.exec('set_stroke', {
        name: 'unknown',
        stroke: {},  // 객체로 전달
      });
      expect(result.success).toBe(false);
    });
  });

  describe('exec - export', () => {
    it('should export json', () => {
      executor.exec('draw_rect', {
        name: 'wall',
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      });

      const result = executor.exec('export_json', {});

      expect(result.success).toBe(true);
      expect(result.type).toBe('json');
      expect(result.data).toBeDefined();

      const json = JSON.parse(result.data!);
      expect(json.name).toBe('test-scene');
      expect(json.entities).toHaveLength(1);
    });
  });

  describe('exec - error handling', () => {
    it('should return error for unknown tool', () => {
      const result = executor.exec('unknown_tool', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });

    it('should reject draw_line with string array elements', () => {
      const result = executor.exec('draw_line', {
        name: 'bad-line',
        points: ['0', '0', '100', '100'],  // strings instead of numbers
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected number at points[0]');
    });

    it('should reject draw_line with nested array elements', () => {
      const result = executor.exec('draw_line', {
        name: 'bad-line',
        points: [[0, 0], [100, 100]],  // nested arrays
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected number at points[0]');
    });

    it('should reject draw_line with non-finite numbers', () => {
      const result = executor.exec('draw_line', {
        name: 'bad-line',
        points: [0, 0, NaN, 100],  // NaN is not finite
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected number at points[2]');
    });

    it('should reject draw_line with Infinity', () => {
      const result = executor.exec('draw_line', {
        name: 'bad-line',
        points: [0, 0, Infinity, 100],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected number at points[2]');
    });
  });

  describe('exportScene', () => {
    it('should return scene JSON', () => {
      executor.exec('draw_circle', { name: 'dot', x: 0, y: 0, radius: 5 });
      const json = executor.exportScene();
      expect(json).toContain('dot');
    });
  });

  describe('resource management - after free()', () => {
    it('should return error when exec called after free', () => {
      executor.free();
      const result = executor.exec('draw_circle', { name: 'c', x: 0, y: 0, radius: 5 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not initialized');
    });

    it('should throw when exportScene called after free', () => {
      executor.free();
      expect(() => executor.exportScene()).toThrow('not initialized or already freed');
    });

    it('should throw when getSceneName called after free', () => {
      executor.free();
      expect(() => executor.getSceneName()).toThrow('not initialized or already freed');
    });

    it('should throw when getEntityCount called after free', () => {
      executor.free();
      expect(() => executor.getEntityCount()).toThrow('not initialized or already freed');
    });

    it('should handle double free gracefully', () => {
      executor.free();
      // Second free should not throw
      expect(() => executor.free()).not.toThrow();
    });
  });
});
