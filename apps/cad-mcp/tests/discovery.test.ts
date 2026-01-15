import { describe, it, expect } from 'vitest';
import {
  listDomains,
  listTools,
  getTool,
  getToolsForDomains,
  getAllTools,
  getAllExecutorTools,
} from '../src/discovery.js';

describe('discovery', () => {
  describe('listDomains', () => {
    it('should return all domain names', () => {
      const domains = listDomains();
      // 현재 도메인: primitives, style, transforms, groups, query, boolean, geometry, utility
      expect(domains).toContain('primitives');
      expect(domains).toContain('style');
      expect(domains).toContain('transforms');
      expect(domains).toContain('groups');
      expect(domains).toContain('query');
      expect(domains).toContain('boolean');
      expect(domains).toContain('geometry');
      expect(domains).toContain('utility');
    });
  });

  describe('listTools', () => {
    it('should return sandbox functions for primitives domain (camelCase)', () => {
      const tools = listTools('primitives');
      // DOMAINS.primitives는 sandbox 함수 이름 (camelCase)
      expect(tools).toContain('drawLine');
      expect(tools).toContain('drawCircle');
      expect(tools).toContain('drawRect');
      expect(tools).toContain('drawArc');
    });

    it('should return sandbox functions for style domain', () => {
      const tools = listTools('style');
      expect(tools).toContain('setStroke');
      expect(tools).toContain('setFill');
      expect(tools).toContain('drawOrder');
    });
  });

  describe('getTool', () => {
    it('should return MCP tool schema by name (new Claude Code pattern tools)', () => {
      const tool = getTool('write');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('write');
    });

    it('should return executor tool schema by name (snake_case)', () => {
      const tool = getTool('draw_rect');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('draw_rect');
      expect(tool?.description).toContain('사각형');
    });

    it('should return undefined for unknown tool', () => {
      const tool = getTool('unknown_tool');
      expect(tool).toBeUndefined();
    });
  });

  describe('getToolsForDomains', () => {
    it('should return executor tools for single domain', () => {
      const tools = getToolsForDomains(['primitives']);
      // primitives: draw_circle, draw_rect, draw_line, draw_arc, draw_polygon, draw_bezier, draw_text = 7
      expect(tools.length).toBe(7);
      expect(tools.map((t) => t.name)).toContain('draw_line');
      expect(tools.map((t) => t.name)).toContain('draw_circle');
    });

    it('should return executor tools for multiple domains', () => {
      const tools = getToolsForDomains(['primitives', 'style']);
      // primitives (7) + style (5) = 12
      expect(tools.length).toBe(12);
    });

    it('should return empty for empty domains', () => {
      const tools = getToolsForDomains([]);
      expect(tools.length).toBe(0);
    });

    it('should return empty for domains without executor support', () => {
      // boolean, geometry는 executor에서 직접 지원하지 않음
      const tools = getToolsForDomains(['boolean']);
      expect(tools.length).toBe(0);
    });
  });

  describe('getAllTools', () => {
    it('should return all MCP tools (Claude Code pattern - 6 tools)', () => {
      const tools = getAllTools();
      // Epic 10: Claude Code 패턴 6개 도구
      // glob, read, edit, write, lsp, bash
      expect(tools.length).toBe(6);
      expect(tools.map((t) => t.name)).toContain('glob');
      expect(tools.map((t) => t.name)).toContain('read');
      expect(tools.map((t) => t.name)).toContain('edit');
      expect(tools.map((t) => t.name)).toContain('write');
      expect(tools.map((t) => t.name)).toContain('lsp');
      expect(tools.map((t) => t.name)).toContain('bash');
    });
  });

  describe('getAllExecutorTools', () => {
    it('should return all executor tools', () => {
      const tools = getAllExecutorTools();
      // Executor tools: draw_circle, draw_rect, draw_line, draw_arc, draw_polygon, draw_bezier, draw_text,
      // set_fill, set_stroke, set_draw_order, remove_fill, remove_stroke,
      // translate, rotate, scale, delete, get_entity, list_entities, get_scene_info,
      // export_json, export_svg, create_group, add_to_group, duplicate = 24
      expect(tools.length).toBeGreaterThanOrEqual(20);
      expect(tools.map((t) => t.name)).toContain('draw_circle');
      expect(tools.map((t) => t.name)).toContain('translate');
    });
  });
});
