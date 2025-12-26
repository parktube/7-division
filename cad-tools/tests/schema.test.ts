import { describe, it, expect } from 'vitest';
import { CAD_TOOLS, DOMAINS, type ToolSchema } from '../src/schema.js';

describe('schema', () => {
  describe('DOMAINS', () => {
    it('should have primitives domain', () => {
      expect(DOMAINS.primitives).toContain('draw_line');
      expect(DOMAINS.primitives).toContain('draw_circle');
      expect(DOMAINS.primitives).toContain('draw_rect');
      expect(DOMAINS.primitives).toContain('draw_arc');
    });

    it('should have style domain', () => {
      expect(DOMAINS.style).toContain('set_stroke');
      expect(DOMAINS.style).toContain('set_fill');
      expect(DOMAINS.style).toContain('remove_stroke');
      expect(DOMAINS.style).toContain('remove_fill');
    });

    it('should have export domain', () => {
      expect(DOMAINS.export).toContain('export_json');
    });
  });

  describe('CAD_TOOLS', () => {
    it('should define all tools in DOMAINS', () => {
      const allDomainTools = [
        ...DOMAINS.primitives,
        ...DOMAINS.style,
        ...DOMAINS.export,
      ];

      for (const toolName of allDomainTools) {
        expect(CAD_TOOLS[toolName]).toBeDefined();
        expect(CAD_TOOLS[toolName].name).toBe(toolName);
      }
    });

    it('should have valid ToolSchema structure', () => {
      for (const tool of Object.values(CAD_TOOLS)) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.parameters).toBeDefined();
        expect(tool.parameters.type).toBe('object');
        expect(tool.parameters.properties).toBeDefined();
        expect(Array.isArray(tool.parameters.required)).toBe(true);
      }
    });

    it('draw_rect should have required parameters', () => {
      const drawRect = CAD_TOOLS['draw_rect'];
      expect(drawRect.parameters.required).toContain('name');
      expect(drawRect.parameters.required).toContain('x');
      expect(drawRect.parameters.required).toContain('y');
      expect(drawRect.parameters.required).toContain('width');
      expect(drawRect.parameters.required).toContain('height');
    });

    it('draw_line should have points as required', () => {
      const drawLine = CAD_TOOLS['draw_line'];
      expect(drawLine.parameters.required).toContain('name');
      expect(drawLine.parameters.required).toContain('points');
    });
  });
});
