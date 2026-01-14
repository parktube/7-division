import { describe, it, expect } from 'vitest';
import { CAD_TOOLS, DOMAINS, DOMAIN_METADATA, FUNCTION_SIGNATURES, type ToolSchema, type DomainName } from '../src/schema.js';

describe('schema', () => {
  describe('DOMAINS', () => {
    it('should have primitives domain', () => {
      expect(DOMAINS.primitives).toContain('drawLine');
      expect(DOMAINS.primitives).toContain('drawCircle');
      expect(DOMAINS.primitives).toContain('drawRect');
      expect(DOMAINS.primitives).toContain('drawArc');
      expect(DOMAINS.primitives).toContain('drawPolygon');
      expect(DOMAINS.primitives).toContain('drawBezier');
      expect(DOMAINS.primitives).toContain('drawText');
    });

    it('should have style domain', () => {
      expect(DOMAINS.style).toContain('setStroke');
      expect(DOMAINS.style).toContain('setFill');
      expect(DOMAINS.style).toContain('drawOrder');
    });

    it('should have transforms domain', () => {
      expect(DOMAINS.transforms).toContain('translate');
      expect(DOMAINS.transforms).toContain('rotate');
      expect(DOMAINS.transforms).toContain('scale');
      expect(DOMAINS.transforms).toContain('setPivot');
      expect(DOMAINS.transforms).toContain('deleteEntity');
    });

    it('should have groups domain', () => {
      expect(DOMAINS.groups).toContain('createGroup');
      expect(DOMAINS.groups).toContain('addToGroup');
    });

    it('should have query domain', () => {
      expect(DOMAINS.query).toContain('getEntity');
      expect(DOMAINS.query).toContain('exists');
      expect(DOMAINS.query).toContain('getWorldBounds');
      expect(DOMAINS.query).toContain('getDrawOrder');
    });

    it('should have boolean domain', () => {
      expect(DOMAINS.boolean).toContain('booleanUnion');
      expect(DOMAINS.boolean).toContain('booleanDifference');
      expect(DOMAINS.boolean).toContain('booleanIntersect');
    });

    it('should have geometry domain', () => {
      expect(DOMAINS.geometry).toContain('offsetPolygon');
      expect(DOMAINS.geometry).toContain('getArea');
      expect(DOMAINS.geometry).toContain('convexHull');
      expect(DOMAINS.geometry).toContain('decompose');
    });

    it('should have utility domain', () => {
      expect(DOMAINS.utility).toContain('duplicate');
      expect(DOMAINS.utility).toContain('mirror');
    });
  });

  describe('DOMAIN_METADATA', () => {
    it('should have metadata for all domains', () => {
      const domainNames = Object.keys(DOMAINS) as DomainName[];
      for (const name of domainNames) {
        expect(DOMAIN_METADATA[name]).toBeDefined();
        expect(DOMAIN_METADATA[name].description).toBeDefined();
      }
    });
  });

  describe('CAD_TOOLS (MCP tools)', () => {
    it('should have run_cad_code as primary tool', () => {
      const runCadCode = CAD_TOOLS['run_cad_code'];
      expect(runCadCode).toBeDefined();
      expect(runCadCode.name).toBe('run_cad_code');
      // code, file, old_code, new_code 모두 optional (코드 에디터 모드 지원)
      expect(runCadCode.parameters.required).toEqual([]);
      expect(runCadCode.parameters.properties).toHaveProperty('code');
      expect(runCadCode.parameters.properties).toHaveProperty('file');
      expect(runCadCode.parameters.properties).toHaveProperty('old_code');
      expect(runCadCode.parameters.properties).toHaveProperty('new_code');
    });

    it('should have describe tool for exploration', () => {
      const describeTool = CAD_TOOLS['describe'];
      expect(describeTool).toBeDefined();
      expect(describeTool.parameters.required).toContain('domain');
    });

    it('should have list_domains tool', () => {
      const listDomains = CAD_TOOLS['list_domains'];
      expect(listDomains).toBeDefined();
      expect(listDomains.parameters.required).toEqual([]);
    });

    it('should have list_tools tool', () => {
      const listTools = CAD_TOOLS['list_tools'];
      expect(listTools).toBeDefined();
    });

    it('should have get_tool_schema tool', () => {
      const getToolSchema = CAD_TOOLS['get_tool_schema'];
      expect(getToolSchema).toBeDefined();
      expect(getToolSchema.parameters.required).toContain('name');
    });

    it('should have export tools', () => {
      expect(CAD_TOOLS['export_json']).toBeDefined();
      expect(CAD_TOOLS['export_svg']).toBeDefined();
    });

    it('should have scene management tools', () => {
      expect(CAD_TOOLS['get_scene_info']).toBeDefined();
      expect(CAD_TOOLS['reset']).toBeDefined();
      expect(CAD_TOOLS['capture']).toBeDefined();
    });

    it('should have module management tools', () => {
      expect(CAD_TOOLS['save_module']).toBeDefined();
      expect(CAD_TOOLS['list_modules']).toBeDefined();
      expect(CAD_TOOLS['get_module']).toBeDefined();
      expect(CAD_TOOLS['delete_module']).toBeDefined();
    });

    it('all tools should have valid schema structure', () => {
      for (const [name, tool] of Object.entries(CAD_TOOLS)) {
        expect(tool.name).toBe(name);
        expect(tool.description).toBeDefined();
        expect(tool.parameters).toBeDefined();
        expect(tool.parameters.type).toBe('object');
        expect(Array.isArray(tool.parameters.required)).toBe(true);
      }
    });
  });

  describe('FUNCTION_SIGNATURES', () => {
    it('should have signatures for all domain functions', () => {
      const allFunctions = Object.values(DOMAINS).flat();
      for (const fn of allFunctions) {
        expect(FUNCTION_SIGNATURES[fn]).toBeDefined();
        expect(FUNCTION_SIGNATURES[fn].signature).toBeDefined();
        expect(FUNCTION_SIGNATURES[fn].description).toBeDefined();
      }
    });

    it('should have examples for common functions', () => {
      expect(FUNCTION_SIGNATURES['drawCircle'].example).toBeDefined();
      expect(FUNCTION_SIGNATURES['drawRect'].example).toBeDefined();
      expect(FUNCTION_SIGNATURES['translate'].example).toBeDefined();
    });
  });
});
