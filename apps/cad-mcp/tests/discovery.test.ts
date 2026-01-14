import { describe, it, expect } from 'vitest';
import {
  listDomains,
  listTools,
  getTool,
  getToolsForDomains,
  getAllTools,
} from '../src/discovery.js';

describe('discovery', () => {
  describe('listDomains', () => {
    it('should return all domain names', () => {
      const domains = listDomains();
      expect(domains).toContain('primitives');
      expect(domains).toContain('style');
      expect(domains).toContain('transforms');
      expect(domains).toContain('query');
      expect(domains).toContain('registry');
      expect(domains).toContain('export');
    });
  });

  describe('listTools', () => {
    it('should return tools for primitives domain', () => {
      const tools = listTools('primitives');
      expect(tools).toContain('draw_line');
      expect(tools).toContain('draw_circle');
      expect(tools).toContain('draw_rect');
      expect(tools).toContain('draw_arc');
    });

    it('should return tools for style domain', () => {
      const tools = listTools('style');
      expect(tools).toContain('set_stroke');
      expect(tools).toContain('set_fill');
    });
  });

  describe('getTool', () => {
    it('should return tool schema by name', () => {
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
    it('should return tools for single domain', () => {
      const tools = getToolsForDomains(['primitives']);
      expect(tools.length).toBe(4);
      expect(tools.map((t) => t.name)).toContain('draw_line');
    });

    it('should return tools for multiple domains', () => {
      const tools = getToolsForDomains(['primitives', 'style']);
      expect(tools.length).toBe(8); // 4 primitives + 4 style
    });

    it('should return empty for empty domains', () => {
      const tools = getToolsForDomains([]);
      expect(tools.length).toBe(0);
    });
  });

  describe('getAllTools', () => {
    it('should return all tools', () => {
      const tools = getAllTools();
      expect(tools.length).toBe(21); // 4 primitives + 4 style + 4 transforms + 3 query + 4 registry + 2 export
    });
  });
});
