/**
 * bash 도구 - 명령 실행
 *
 * Story 10.6: Claude Code Bash 패턴 준수
 * - 씬 조회: info, tree, groups, draw_order, selection
 * - 내보내기: capture, svg, json
 * - 초기화: reset
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CADExecutor } from '../executor.js';
import { captureViewport } from '../capture.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SELECTION_FILE = resolve(__dirname, '../../../viewer/selection.json');

export type BashCommand =
  | 'info'
  | 'tree'
  | 'groups'
  | 'draw_order'
  | 'selection'
  | 'capture'
  | 'svg'
  | 'json'
  | 'reset';

export interface BashInput {
  command: BashCommand;
  group?: string;
  clearSketch?: boolean;
}

export interface BashOutput {
  success: boolean;
  data: Record<string, unknown>;
  error?: string;
}

/**
 * Execute query on executor
 */
function execQuery(
  exec: CADExecutor,
  name: string,
  args: Record<string, unknown> = {}
): { success: boolean; data?: unknown; error?: string } {
  try {
    const result = exec.exec(name, args);
    if (result.success) {
      return { success: true, data: result.data ? JSON.parse(result.data) : result };
    }
    return { success: false, error: result.error || 'Unknown error' };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Handle bash tool operations
 *
 * Note: This handler requires executor for scene operations.
 * The onSceneChange callback is called after reset to broadcast changes.
 */
export async function handleBash(
  input: BashInput,
  exec: CADExecutor,
  onSceneChange?: () => void
): Promise<BashOutput> {
  try {
    const { command, group, clearSketch } = input;

    if (!command) {
      return {
        success: false,
        data: {},
        error: 'command parameter is required',
      };
    }

    switch (command) {
      case 'info': {
        const result = execQuery(exec, 'get_scene_info', {});
        if (result.success) {
          return {
            success: true,
            data: result.data as Record<string, unknown>,
          };
        }
        return { success: false, data: {}, error: result.error };
      }

      case 'tree': {
        const result = exec.exec('list_entities', {});
        if (result.success && result.data) {
          try {
            const entities = JSON.parse(result.data) as Array<{
              name: string;
              type: string;
              parent?: string;
              children?: string[];
            }>;
            const rootEntities = entities.filter((e) => !e.parent);

            const buildTree = (
              items: Array<{ name: string; type: string; children?: string[] }>
            ): object[] => {
              return items.map((item) => ({
                name: item.name,
                type: item.type,
                children: item.children
                  ? buildTree(
                      entities.filter((e) => item.children?.includes(e.name))
                    )
                  : undefined,
              }));
            };

            const tree = buildTree(rootEntities);
            return {
              success: true,
              data: { tree, totalCount: entities.length },
            };
          } catch {
            return { success: true, data: { raw: result.data } };
          }
        }
        return { success: false, data: {}, error: result.error || 'Failed' };
      }

      case 'groups': {
        const result = exec.exec('list_entities', {});
        if (result.success && result.data) {
          try {
            const entities = JSON.parse(result.data) as Array<{
              name: string;
              type: string;
            }>;
            const groups = entities
              .filter((e) => e.type === 'Group')
              .map((e) => e.name);
            return {
              success: true,
              data: { groups, count: groups.length },
            };
          } catch {
            return { success: true, data: { raw: result.data } };
          }
        }
        return { success: false, data: {}, error: result.error || 'Failed' };
      }

      case 'draw_order': {
        const groupName = group || '';
        const result = exec.exec('get_draw_order', { group_name: groupName });
        if (result.success && result.data) {
          // WASM returns { level, order, details } object
          const parsed = JSON.parse(result.data) as {
            level: string;
            order: string[];
            details: Record<string, unknown>;
          };
          return {
            success: true,
            data: {
              level: parsed.level || (groupName || 'root'),
              order: parsed.order,
              count: parsed.order.length,
              hint: '배열 왼쪽이 뒤(먼저 그림), 오른쪽이 앞(나중 그림)',
            },
          };
        }
        return {
          success: false,
          data: {},
          error: result.error || 'Failed to get draw order',
        };
      }

      case 'selection': {
        try {
          if (!existsSync(SELECTION_FILE)) {
            return {
              success: true,
              data: { selected: [], locked: [], hidden: [] },
            };
          }
          const data = JSON.parse(readFileSync(SELECTION_FILE, 'utf-8')) as {
            selected_entities?: string[];
            locked_entities?: string[];
            hidden_entities?: string[];
          };
          return {
            success: true,
            data: {
              selected: data.selected_entities || [],
              locked: data.locked_entities || [],
              hidden: data.hidden_entities || [],
            },
          };
        } catch (e) {
          return {
            success: false,
            data: {},
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }

      case 'reset': {
        const result = exec.exec('reset', {});
        if (result.success) {
          // Notify scene change for broadcast
          if (onSceneChange) {
            onSceneChange();
          }
          return {
            success: true,
            data: { message: 'Scene reset successfully' },
          };
        }
        return { success: false, data: {}, error: result.error || 'Failed' };
      }

      case 'capture': {
        try {
          const result = await captureViewport();
          if (result.success && result.path) {
            return {
              success: true,
              data: {
                path: result.path,
                clearSketch: clearSketch || false,
              },
            };
          }
          return {
            success: false,
            data: {},
            error: result.error || 'Capture failed',
          };
        } catch (e) {
          return {
            success: false,
            data: {},
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }

      case 'svg': {
        const result = exec.exec('export_svg', {});
        if (result.success && result.data) {
          return {
            success: true,
            data: { svg: result.data },
          };
        }
        return { success: false, data: {}, error: result.error || 'Failed' };
      }

      case 'json': {
        const result = execQuery(exec, 'export_json', {});
        if (result.success) {
          return {
            success: true,
            data: { scene: result.data },
          };
        }
        return { success: false, data: {}, error: result.error };
      }

      default:
        return {
          success: false,
          data: {},
          error: `Unknown command: ${command}. Available: info, tree, groups, draw_order, selection, capture, svg, json, reset`,
        };
    }
  } catch (e) {
    return {
      success: false,
      data: {},
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
