import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CADExecutor } from '../src/executor.js';
import { ToolRegistry } from '../src/tool-registry.js';

describe('CADExecutor', () => {
  let executor: CADExecutor;
  let tempRequestsDir: string | null = null;

  beforeEach(() => {
    // 테스트 격리: 임시 디렉토리에 빈 tool-requests.json 생성
    tempRequestsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cad-tools-requests-'));
    const requestsPath = path.join(tempRequestsDir, 'tool-requests.json');
    fs.writeFileSync(requestsPath, '[]\n');
    ToolRegistry.resetInstance();
    ToolRegistry.getInstance(requestsPath);

    executor = CADExecutor.create('test-scene');
  });

  afterEach(() => {
    executor.free();
    ToolRegistry.resetInstance();
    if (tempRequestsDir) {
      fs.rmSync(tempRequestsDir, { recursive: true, force: true });
      tempRequestsDir = null;
    }
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

    it('should draw arc with angle_unit degree', () => {
      const result = executor.exec('draw_arc', {
        name: 'door_deg',
        cx: 0,
        cy: 0,
        radius: 50,
        start_angle: 0,
        end_angle: 90,
        angle_unit: 'degree',
      });

      expect(result.success).toBe(true);
      expect(result.entity).toBe('door_deg');

      // Verify angle is stored as radians
      const json = JSON.parse(executor.exportScene());
      const entity = json.entities.find((e: { metadata: { name: string } }) => e.metadata.name === 'door_deg');
      expect(entity.geometry.Arc.end_angle).toBeCloseTo(Math.PI / 2);
    });

    it('should draw arc with angle_unit radian (explicit)', () => {
      const result = executor.exec('draw_arc', {
        name: 'door_rad',
        cx: 0,
        cy: 0,
        radius: 50,
        start_angle: 0,
        end_angle: Math.PI / 2,
        angle_unit: 'radian',
      });

      expect(result.success).toBe(true);

      const json = JSON.parse(executor.exportScene());
      const entity = json.entities.find((e: { metadata: { name: string } }) => e.metadata.name === 'door_rad');
      expect(entity.geometry.Arc.end_angle).toBeCloseTo(Math.PI / 2);
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

    it('should export svg', () => {
      executor.exec('draw_circle', {
        name: 'head',
        x: 50,
        y: 50,
        radius: 25,
      });

      const result = executor.exec('export_svg', {});

      expect(result.success).toBe(true);
      expect(result.type).toBe('svg');
      expect(result.data).toBeDefined();
      expect(result.data).toContain('<svg');
      expect(result.data).toContain('</svg>');
      expect(result.data).toContain('<circle');
      expect(result.data).toContain('cx="50"');
      expect(result.data).toContain('cy="50"');
      expect(result.data).toContain('r="25"');
    });

    it('should export svg with transform', () => {
      executor.exec('draw_rect', {
        name: 'box',
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      });
      executor.exec('translate', { name: 'box', dx: 10, dy: 20 });
      executor.exec('rotate', { name: 'box', angle: Math.PI / 2 });

      const result = executor.exec('export_svg', {});

      expect(result.success).toBe(true);
      expect(result.data).toContain('<rect');
      expect(result.data).toContain('transform=');
      expect(result.data).toContain('translate(10, 20)');
      expect(result.data).toContain('rotate(90)');
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

  describe('exec - transforms', () => {
    beforeEach(() => {
      executor.exec('draw_rect', { name: 'box', x: 0, y: 0, width: 100, height: 50 });
    });

    it('should translate entity', () => {
      const result = executor.exec('translate', { name: 'box', dx: 10, dy: 20 });

      expect(result.success).toBe(true);
      expect(result.entity).toBe('box');

      // Verify transform in JSON
      const json = JSON.parse(executor.exportScene());
      const entity = json.entities.find((e: { metadata: { name: string } }) => e.metadata.name === 'box');
      expect(entity.transform.translate).toEqual([10, 20]);
    });

    it('should accumulate translate values', () => {
      executor.exec('translate', { name: 'box', dx: 10, dy: 20 });
      executor.exec('translate', { name: 'box', dx: 5, dy: -5 });

      const json = JSON.parse(executor.exportScene());
      const entity = json.entities.find((e: { metadata: { name: string } }) => e.metadata.name === 'box');
      expect(entity.transform.translate).toEqual([15, 15]);
    });

    it('should return error for non-existent entity', () => {
      const result = executor.exec('translate', { name: 'unknown', dx: 10, dy: 20 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Entity not found');
    });

    it('should rotate entity', () => {
      const result = executor.exec('rotate', { name: 'box', angle: Math.PI / 2 });

      expect(result.success).toBe(true);
      expect(result.entity).toBe('box');

      // Verify transform in JSON
      const json = JSON.parse(executor.exportScene());
      const entity = json.entities.find((e: { metadata: { name: string } }) => e.metadata.name === 'box');
      expect(entity.transform.rotate).toBeCloseTo(Math.PI / 2);
    });

    it('should accumulate rotate values', () => {
      executor.exec('rotate', { name: 'box', angle: Math.PI / 4 });
      executor.exec('rotate', { name: 'box', angle: Math.PI / 4 });

      const json = JSON.parse(executor.exportScene());
      const entity = json.entities.find((e: { metadata: { name: string } }) => e.metadata.name === 'box');
      expect(entity.transform.rotate).toBeCloseTo(Math.PI / 2);
    });

    it('should return error for rotate non-existent entity', () => {
      const result = executor.exec('rotate', { name: 'unknown', angle: Math.PI });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Entity not found');
    });

    it('should rotate entity with angle_unit degree', () => {
      const result = executor.exec('rotate', { name: 'box', angle: 90, angle_unit: 'degree' });

      expect(result.success).toBe(true);
      expect(result.entity).toBe('box');

      // Verify angle is stored as radians
      const json = JSON.parse(executor.exportScene());
      const entity = json.entities.find((e: { metadata: { name: string } }) => e.metadata.name === 'box');
      expect(entity.transform.rotate).toBeCloseTo(Math.PI / 2);
    });

    it('should rotate entity with angle_unit radian (explicit)', () => {
      const result = executor.exec('rotate', { name: 'box', angle: Math.PI / 4, angle_unit: 'radian' });

      expect(result.success).toBe(true);

      const json = JSON.parse(executor.exportScene());
      const entity = json.entities.find((e: { metadata: { name: string } }) => e.metadata.name === 'box');
      expect(entity.transform.rotate).toBeCloseTo(Math.PI / 4);
    });

    it('should scale entity', () => {
      const result = executor.exec('scale', { name: 'box', sx: 2, sy: 0.5 });

      expect(result.success).toBe(true);
      expect(result.entity).toBe('box');

      // Verify transform in JSON
      const json = JSON.parse(executor.exportScene());
      const entity = json.entities.find((e: { metadata: { name: string } }) => e.metadata.name === 'box');
      expect(entity.transform.scale).toEqual([2, 0.5]);
    });

    it('should accumulate scale values (multiplicatively)', () => {
      executor.exec('scale', { name: 'box', sx: 2, sy: 2 });
      executor.exec('scale', { name: 'box', sx: 1.5, sy: 0.5 });

      const json = JSON.parse(executor.exportScene());
      const entity = json.entities.find((e: { metadata: { name: string } }) => e.metadata.name === 'box');
      // 2*1.5=3, 2*0.5=1
      expect(entity.transform.scale).toEqual([3, 1]);
    });

    it('should return error for scale non-existent entity', () => {
      const result = executor.exec('scale', { name: 'unknown', sx: 2, sy: 2 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Entity not found');
    });

    it('should correct zero scale to minimum value', () => {
      const result = executor.exec('scale', { name: 'box', sx: 0, sy: 0 });

      expect(result.success).toBe(true);

      // Verify scale is corrected to 0.001 (not 0)
      const json = JSON.parse(executor.exportScene());
      const entity = json.entities.find((e: { metadata: { name: string } }) => e.metadata.name === 'box');
      expect(entity.transform.scale[0]).toBeCloseTo(0.001);
      expect(entity.transform.scale[1]).toBeCloseTo(0.001);
    });

    it('should correct negative scale to absolute value', () => {
      const result = executor.exec('scale', { name: 'box', sx: -2, sy: -0.5 });

      expect(result.success).toBe(true);

      // Verify scale uses absolute values
      const json = JSON.parse(executor.exportScene());
      const entity = json.entities.find((e: { metadata: { name: string } }) => e.metadata.name === 'box');
      expect(entity.transform.scale).toEqual([2, 0.5]);
    });

    it('should delete entity', () => {
      expect(executor.getEntityCount()).toBe(1);

      const result = executor.exec('delete', { name: 'box' });

      expect(result.success).toBe(true);
      expect(result.entity).toBe('box');
      expect(executor.getEntityCount()).toBe(0);
    });

    it('should return error for delete non-existent entity', () => {
      const result = executor.exec('delete', { name: 'unknown' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Entity not found');
    });
  });

  describe('exec - registry', () => {
    it('should list all domains', () => {
      const result = executor.exec('list_domains', {});

      expect(result.success).toBe(true);
      expect(result.type).toBe('domains');

      const domains = JSON.parse(result.data!);
      expect(domains.length).toBeGreaterThanOrEqual(4);

      const primitives = domains.find((d: { domain: string }) => d.domain === 'primitives');
      expect(primitives).toBeDefined();
      expect(primitives.count).toBeGreaterThanOrEqual(4); // 최소 4개 도구 (확장 가능)
      expect(primitives.description).toContain('도형');
    });

    it('should list tools for specific domain', () => {
      const result = executor.exec('list_tools', { domain: 'primitives' });

      expect(result.success).toBe(true);
      expect(result.type).toBe('tools');

      const data = JSON.parse(result.data!);
      expect(data.domain).toBe('primitives');
      expect(data.tools.length).toBeGreaterThanOrEqual(4); // 최소 4개 도구
      // 핵심 도구 존재 확인
      const toolNames = data.tools.map((t: { name: string }) => t.name);
      expect(toolNames).toContain('draw_rect');
      expect(toolNames).toContain('draw_circle');
      expect(toolNames).toContain('draw_line');
      expect(toolNames).toContain('draw_arc');
    });

    it('should list all tools when domain not specified', () => {
      const result = executor.exec('list_tools', {});

      expect(result.success).toBe(true);
      const data = JSON.parse(result.data!);
      expect(data.domain).toBeNull();
      expect(data.tools.length).toBeGreaterThanOrEqual(12);
    });

    it('should get tool schema', () => {
      const result = executor.exec('get_tool_schema', { name: 'draw_rect' });

      expect(result.success).toBe(true);
      expect(result.type).toBe('schema');

      const schema = JSON.parse(result.data!);
      expect(schema.name).toBe('draw_rect');
      expect(schema.parameters.required).toContain('width');
    });

    it('should return error with suggestions for unknown tool', () => {
      const result = executor.exec('get_tool_schema', { name: 'draw_rectangle' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');

      const data = JSON.parse(result.data!);
      expect(data.suggestions).toContain('draw_rect');
    });

    it('should request new tool', () => {
      const result = executor.exec('request_tool', {
        name: 'draw_rounded_rect',
        description: '모서리가 둥근 직사각형',
        rationale: '가구 모서리 표현에 필요',
        suggested_params: ['x', 'y', 'width', 'height', 'corner_radius'],
      });

      expect(result.success).toBe(true);
      expect(result.type).toBe('request');

      const data = JSON.parse(result.data!);
      expect(data.request_id).toBeDefined();
      expect(data.status).toBe('queued');
    });
  });

  describe('exec - query', () => {
    // 헬퍼: 빈 executor 생성 및 테스트 실행 후 정리
    const withEmptyExecutor = (testFn: (emptyExecutor: CADExecutor) => void) => {
      const emptyExecutor = CADExecutor.create('empty-scene');
      try {
        testFn(emptyExecutor);
      } finally {
        emptyExecutor.free();
      }
    };

    beforeEach(() => {
      // Setup some entities for query tests
      executor.exec('draw_rect', { name: 'wall', x: 0, y: 0, width: 100, height: 50 });
      executor.exec('draw_circle', { name: 'head', x: 50, y: 75, radius: 25 });
    });

    it('should list all entities', () => {
      const result = executor.exec('list_entities', {});

      expect(result.success).toBe(true);
      expect(result.type).toBe('list');
      expect(result.data).toBeDefined();

      const list = JSON.parse(result.data!);
      expect(list).toHaveLength(2);
      expect(list[0]).toEqual({ name: 'wall', type: 'Rect' });
      expect(list[1]).toEqual({ name: 'head', type: 'Circle' });
    });

    it('should list empty array for empty scene', () => {
      withEmptyExecutor((emptyExecutor) => {
        const result = emptyExecutor.exec('list_entities', {});

        expect(result.success).toBe(true);
        expect(JSON.parse(result.data!)).toEqual([]);
      });
    });

    it('should get entity by name', () => {
      const result = executor.exec('get_entity', { name: 'head' });

      expect(result.success).toBe(true);
      expect(result.entity).toBe('head');
      expect(result.type).toBe('entity');
      expect(result.data).toBeDefined();

      const entity = JSON.parse(result.data!);
      expect(entity.entity_type).toBe('Circle');
      expect(entity.geometry.Circle.center).toEqual([50, 75]);
      expect(entity.geometry.Circle.radius).toBe(25);
    });

    it('should return error for non-existent entity', () => {
      const result = executor.exec('get_entity', { name: 'unknown' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Entity not found');
    });

    it('should get scene info', () => {
      const result = executor.exec('get_scene_info', {});

      expect(result.success).toBe(true);
      expect(result.type).toBe('scene_info');
      expect(result.data).toBeDefined();

      const info = JSON.parse(result.data!);
      expect(info.name).toBe('test-scene');
      expect(info.entity_count).toBe(2);
      expect(info.bounds).toBeDefined();
      // wall: (0,0) to (100,50), head: (25,50) to (75,100)
      // bounds should be: min(0,0), max(100,100)
      expect(info.bounds.min).toEqual([0, 0]);
      expect(info.bounds.max).toEqual([100, 100]);
    });

    it('should return null bounds for empty scene', () => {
      withEmptyExecutor((emptyExecutor) => {
        const result = emptyExecutor.exec('get_scene_info', {});

        expect(result.success).toBe(true);
        const info = JSON.parse(result.data!);
        expect(info.name).toBe('empty-scene');
        expect(info.entity_count).toBe(0);
        expect(info.bounds).toBeNull();
      });
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
