import { describe, it, expect } from 'vitest';
import { CAD_TOOLS, DOMAINS, DOMAIN_METADATA, FUNCTION_SIGNATURES, type DomainName } from '../src/schema.js';

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

  describe('CAD_TOOLS (Claude Code pattern - 6 tools)', () => {
    it('should have exactly 6 tools', () => {
      expect(Object.keys(CAD_TOOLS)).toHaveLength(6);
    });

    it('should have glob tool for file listing', () => {
      const glob = CAD_TOOLS['glob'];
      expect(glob).toBeDefined();
      expect(glob.name).toBe('glob');
      expect(glob.parameters.properties).toHaveProperty('pattern');
    });

    it('should have read tool for file reading', () => {
      const read = CAD_TOOLS['read'];
      expect(read).toBeDefined();
      expect(read.name).toBe('read');
      expect(read.parameters.required).toContain('file');
    });

    it('should have edit tool for partial editing', () => {
      const edit = CAD_TOOLS['edit'];
      expect(edit).toBeDefined();
      expect(edit.name).toBe('edit');
      expect(edit.parameters.required).toContain('file');
      expect(edit.parameters.required).toContain('old_code');
      expect(edit.parameters.required).toContain('new_code');
    });

    it('should have write tool for file writing', () => {
      const write = CAD_TOOLS['write'];
      expect(write).toBeDefined();
      expect(write.name).toBe('write');
      expect(write.parameters.required).toContain('file');
      expect(write.parameters.required).toContain('code');
    });

    it('should have lsp tool for code navigation', () => {
      const lsp = CAD_TOOLS['lsp'];
      expect(lsp).toBeDefined();
      expect(lsp.name).toBe('lsp');
      expect(lsp.parameters.required).toContain('operation');
    });

    it('should have bash tool for command execution', () => {
      const bash = CAD_TOOLS['bash'];
      expect(bash).toBeDefined();
      expect(bash.name).toBe('bash');
      expect(bash.parameters.required).toContain('command');
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
