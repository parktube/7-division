/**
 * bash 도구 테스트
 *
 * Story 10.6: bash 도구 구현
 * - 씬 조회: info, tree, groups, draw_order, selection
 * - 내보내기: svg, json (capture는 뷰어 의존성으로 제외)
 * - 초기화: reset
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { handleBash, clearSnapshotHistory, type BashCommand } from '../src/tools/bash.js';
import { CADExecutor } from '../src/executor.js';

describe('bash 도구', () => {
  let exec: CADExecutor;

  beforeEach(() => {
    exec = CADExecutor.create('bash-test');
    clearSnapshotHistory();
  });

  describe('info command', () => {
    it('should return scene info (AC1)', async () => {
      const result = await handleBash({ command: 'info' }, exec);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('entity_count');
      expect(result.data).toHaveProperty('bounds');
    });

    it('should return entity count after creating entities', async () => {
      exec.exec('draw_circle', { name: 'c1', x: 0, y: 0, radius: 10 });
      exec.exec('draw_rect', { name: 'r1', x: 10, y: 10, width: 20, height: 20 });

      const result = await handleBash({ command: 'info' }, exec);

      expect(result.success).toBe(true);
      expect(result.data.entity_count).toBe(2);
    });
  });

  describe('tree command', () => {
    it('should return tree structure (AC2)', async () => {
      exec.exec('draw_circle', { name: 'head', x: 0, y: 50, radius: 20 });
      exec.exec('draw_rect', { name: 'body', x: 0, y: 0, width: 30, height: 40 });
      exec.exec('create_group', { name: 'robot', children: ['head', 'body'] });

      const result = await handleBash({ command: 'tree' }, exec);

      expect(result.success).toBe(true);
      expect(result.data.tree).toBeDefined();
      expect(result.data.totalCount).toBe(3); // head, body, robot
    });

    it('should return empty tree for empty scene', async () => {
      const result = await handleBash({ command: 'tree' }, exec);

      expect(result.success).toBe(true);
      expect(result.data.tree).toBeDefined();
      expect(result.data.totalCount).toBe(0);
    });
  });

  describe('groups command', () => {
    it('should return group list (AC3)', async () => {
      exec.exec('draw_circle', { name: 'c1', x: 0, y: 0, radius: 10 });
      exec.exec('draw_circle', { name: 'c2', x: 20, y: 0, radius: 10 });
      exec.exec('create_group', { name: 'circles', children: ['c1', 'c2'] });

      const result = await handleBash({ command: 'groups' }, exec);

      expect(result.success).toBe(true);
      expect(result.data.groups).toBeDefined();
      expect(result.data.groups).toContain('circles');
      expect(result.data.count).toBe(1);
    });

    it('should return empty list when no groups', async () => {
      exec.exec('draw_circle', { name: 'c1', x: 0, y: 0, radius: 10 });

      const result = await handleBash({ command: 'groups' }, exec);

      expect(result.success).toBe(true);
      expect(result.data.groups).toEqual([]);
      expect(result.data.count).toBe(0);
    });
  });

  describe('draw_order command', () => {
    it('should return draw order (AC4)', async () => {
      exec.exec('draw_circle', { name: 'bg', x: 0, y: 0, radius: 100 });
      exec.exec('draw_rect', { name: 'fg', x: 0, y: 0, width: 50, height: 50 });

      const result = await handleBash({ command: 'draw_order' }, exec);

      expect(result.success).toBe(true);
      expect(result.data.order).toBeDefined();
      expect(result.data.level).toBe('root');
      expect((result.data.order as string[]).length).toBe(2);
    });

    it('should return group-level draw order when group specified', async () => {
      exec.exec('draw_circle', { name: 'c1', x: 0, y: 0, radius: 10 });
      exec.exec('draw_rect', { name: 'r1', x: 0, y: 0, width: 20, height: 20 });
      exec.exec('create_group', { name: 'grp', children: ['c1', 'r1'] });

      const result = await handleBash({ command: 'draw_order', group: 'grp' }, exec);

      expect(result.success).toBe(true);
      // WASM returns level as 'group:{name}' for group queries
      expect(result.data.level).toBe('group:grp');
      expect(result.data.order).toBeDefined();
      expect((result.data.order as string[]).length).toBe(2);
    });
  });

  describe('selection command', () => {
    it('should return selection info (AC9)', async () => {
      // Selection file may or may not exist
      const result = await handleBash({ command: 'selection' }, exec);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('selected');
      expect(result.data).toHaveProperty('locked');
      expect(result.data).toHaveProperty('hidden');
    });
  });

  describe('reset command', () => {
    it('should reset scene (AC5)', async () => {
      exec.exec('draw_circle', { name: 'c1', x: 0, y: 0, radius: 10 });

      // Verify entity exists
      let info = await handleBash({ command: 'info' }, exec);
      expect(info.data.entity_count).toBe(1);

      // Reset
      const result = await handleBash({ command: 'reset' }, exec);
      expect(result.success).toBe(true);
      expect(result.data.message).toContain('reset');

      // Verify scene is empty
      info = await handleBash({ command: 'info' }, exec);
      expect(info.data.entity_count).toBe(0);
    });

    it('should call onSceneChange callback', async () => {
      let callbackCalled = false;
      const onSceneChange = () => {
        callbackCalled = true;
      };

      await handleBash({ command: 'reset' }, exec, onSceneChange);

      expect(callbackCalled).toBe(true);
    });
  });

  describe('svg command', () => {
    it('should return SVG export (AC7)', async () => {
      exec.exec('draw_circle', { name: 'c1', x: 0, y: 0, radius: 50 });

      const result = await handleBash({ command: 'svg' }, exec);

      expect(result.success).toBe(true);
      expect(result.data.svg).toBeDefined();
      expect(result.data.svg).toContain('<svg');
      expect(result.data.svg).toContain('</svg>');
    });

    it('should return empty SVG for empty scene', async () => {
      const result = await handleBash({ command: 'svg' }, exec);

      expect(result.success).toBe(true);
      expect(result.data.svg).toBeDefined();
    });
  });

  describe('json command', () => {
    it('should return JSON export (AC8)', async () => {
      exec.exec('draw_circle', { name: 'c1', x: 0, y: 0, radius: 50 });

      const result = await handleBash({ command: 'json' }, exec);

      expect(result.success).toBe(true);
      expect(result.data.scene).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should return error for missing command', async () => {
      // @ts-expect-error - testing missing parameter
      const result = await handleBash({}, exec);

      expect(result.success).toBe(false);
      expect(result.error).toBe('command parameter is required');
    });

    it('should return error for unknown command', async () => {
      const result = await handleBash({ command: 'unknown' as BashCommand }, exec);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown command');
      expect(result.error).toContain('info');
    });
  });

  // Note: capture command is not tested here due to Puppeteer/viewer dependency
  // It should be tested in integration tests with actual viewer running

  describe('entity command', () => {
    it('should return entity info when entity exists', async () => {
      exec.exec('draw_circle', { name: 'my_circle', x: 10, y: 20, radius: 30 });

      const result = await handleBash({ command: 'entity', name: 'my_circle' }, exec);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return error for missing name parameter', async () => {
      const result = await handleBash({ command: 'entity' }, exec);

      expect(result.success).toBe(false);
      expect(result.error).toBe('name parameter is required for entity command');
    });

    it('should return error for non-existent entity', async () => {
      const result = await handleBash({ command: 'entity', name: 'nonexistent' }, exec);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('snapshot/undo/redo commands', () => {
    it('should save and list snapshots', async () => {
      exec.exec('draw_circle', { name: 'c1', x: 0, y: 0, radius: 10 });

      // Save snapshot
      const saveResult = await handleBash({ command: 'snapshot' }, exec);
      expect(saveResult.success).toBe(true);
      expect(saveResult.data.id).toBeDefined();
      expect(saveResult.data.total).toBe(1);

      // List snapshots
      const listResult = await handleBash({ command: 'snapshots' }, exec);
      expect(listResult.success).toBe(true);
      expect(listResult.data.total).toBe(1);
    });

    it('should undo to previous snapshot', async () => {
      // Create initial state and snapshot
      exec.exec('draw_circle', { name: 'c1', x: 0, y: 0, radius: 10 });
      await handleBash({ command: 'snapshot' }, exec);

      // Modify scene and snapshot
      exec.exec('draw_rect', { name: 'r1', x: 10, y: 10, width: 20, height: 20 });
      await handleBash({ command: 'snapshot' }, exec);

      // Verify 2 entities
      let info = await handleBash({ command: 'info' }, exec);
      expect(info.data.entity_count).toBe(2);

      // Undo
      const undoResult = await handleBash({ command: 'undo' }, exec);
      expect(undoResult.success).toBe(true);

      // Verify 1 entity (restored)
      info = await handleBash({ command: 'info' }, exec);
      expect(info.data.entity_count).toBe(1);
    });

    it('should redo after undo', async () => {
      // Create and snapshot
      exec.exec('draw_circle', { name: 'c1', x: 0, y: 0, radius: 10 });
      await handleBash({ command: 'snapshot' }, exec);

      // Modify and snapshot
      exec.exec('draw_rect', { name: 'r1', x: 10, y: 10, width: 20, height: 20 });
      await handleBash({ command: 'snapshot' }, exec);

      // Undo
      await handleBash({ command: 'undo' }, exec);

      // Redo
      const redoResult = await handleBash({ command: 'redo' }, exec);
      expect(redoResult.success).toBe(true);

      // Verify 2 entities restored
      const info = await handleBash({ command: 'info' }, exec);
      expect(info.data.entity_count).toBe(2);
    });

    it('should return error when no previous snapshot for undo', async () => {
      const result = await handleBash({ command: 'undo' }, exec);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No previous snapshot');
    });

    it('should return error when no next snapshot for redo', async () => {
      const result = await handleBash({ command: 'redo' }, exec);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No next snapshot');
    });
  });
});
