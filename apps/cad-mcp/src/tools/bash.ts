/**
 * bash 도구 - 명령 실행
 *
 * Story 10.6: Claude Code Bash 패턴 준수
 * - 씬 조회: info, tree, groups, draw_order, selection
 * - 내보내기: capture, svg, json
 * - 초기화: reset
 */

import { existsSync, readFileSync } from 'fs';
import type { CADExecutor } from '../executor.js';
import { captureViewport } from '../capture.js';
import { resolveSelectionFile } from '../sandbox/index.js';
import { logger } from '../logger.js';

export type BashCommand =
  | 'info'
  | 'tree'
  | 'groups'
  | 'draw_order'
  | 'selection'
  | 'entity'
  | 'capture'
  | 'svg'
  | 'json'
  | 'reset'
  | 'snapshot'
  | 'undo'
  | 'redo'
  | 'snapshots';

// Snapshot history for undo/redo
interface Snapshot {
  id: number;
  timestamp: string;
  sceneJson: string;
}

const snapshotHistory: Snapshot[] = [];
let snapshotIndex = -1;  // Current position in history
let snapshotIdCounter = 0;
const MAX_SNAPSHOTS = 20;

/**
 * Clear snapshot history (for testing)
 */
export function clearSnapshotHistory(): void {
  snapshotHistory.length = 0;
  snapshotIndex = -1;
  snapshotIdCounter = 0;
}

export interface BashInput {
  command: BashCommand;
  name?: string;      // entity 명령용: 엔티티/그룹 이름
  group?: string;     // draw_order용: 그룹명
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
      // Always return consistent data shape: parsed JSON or null
      return { success: true, data: result.data ? JSON.parse(result.data) : null };
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
          } catch (e) {
            logger.warn('bash tree: JSON parse failed, returning raw data', { error: e instanceof Error ? e.message : String(e) });
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
          } catch (e) {
            logger.warn('bash groups: JSON parse failed, returning raw data', { error: e instanceof Error ? e.message : String(e) });
            return { success: true, data: { raw: result.data } };
          }
        }
        return { success: false, data: {}, error: result.error || 'Failed' };
      }

      case 'draw_order': {
        const groupName = group || '';
        const result = exec.exec('get_draw_order', { group_name: groupName });
        if (result.success && result.data) {
          try {
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
          } catch (e) {
            return {
              success: false,
              data: {},
              error: `Failed to parse draw_order response: ${e instanceof Error ? e.message : String(e)}`,
            };
          }
        }
        return {
          success: false,
          data: {},
          error: result.error || 'Failed to get draw order',
        };
      }

      case 'selection': {
        try {
          const selectionFile = resolveSelectionFile();
          if (!existsSync(selectionFile)) {
            return {
              success: true,
              data: { selected: [], locked: [], hidden: [] },
            };
          }
          const data = JSON.parse(readFileSync(selectionFile, 'utf-8')) as {
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

      case 'entity': {
        const entityName = input.name;
        if (!entityName) {
          return {
            success: false,
            data: {},
            error: 'name parameter is required for entity command',
          };
        }
        const result = exec.exec('get_entity', { name: entityName });
        if (result.success && result.data) {
          try {
            const entityData = JSON.parse(result.data) as Record<string, unknown>;
            return {
              success: true,
              data: entityData,
            };
          } catch (e) {
            logger.warn('bash entity: JSON parse failed', { error: e instanceof Error ? e.message : String(e) });
            return { success: true, data: { raw: result.data } };
          }
        }
        return {
          success: false,
          data: {},
          error: result.error || `Entity '${entityName}' not found`,
        };
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
                hint: '씬 JSON은 bash json 명령으로 조회 가능',
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

      case 'snapshot': {
        // Save current scene state
        const sceneJson = exec.exportScene();

        // If we're not at the end of history, truncate forward history
        if (snapshotIndex < snapshotHistory.length - 1) {
          snapshotHistory.splice(snapshotIndex + 1);
        }

        // Add new snapshot
        const snapshot: Snapshot = {
          id: ++snapshotIdCounter,
          timestamp: new Date().toISOString(),
          sceneJson,
        };
        snapshotHistory.push(snapshot);
        snapshotIndex = snapshotHistory.length - 1;

        // Limit history size
        if (snapshotHistory.length > MAX_SNAPSHOTS) {
          snapshotHistory.shift();
          snapshotIndex--;
        }

        return {
          success: true,
          data: {
            id: snapshot.id,
            index: snapshotIndex,
            total: snapshotHistory.length,
            message: `Snapshot #${snapshot.id} saved`,
          },
        };
      }

      case 'undo': {
        if (snapshotIndex <= 0) {
          return {
            success: false,
            data: {},
            error: 'No previous snapshot to undo to',
          };
        }

        // Save current index for potential rollback
        const previousIndex = snapshotIndex;

        // Move back in history
        snapshotIndex--;
        const prevSnapshot = snapshotHistory[snapshotIndex];

        // Reset first, then restore scene
        exec.exec('reset', {});
        const importResult = exec.importScene(prevSnapshot.sceneJson);

        // Check if import failed
        if (importResult.error) {
          // Rollback snapshotIndex
          snapshotIndex = previousIndex;
          return {
            success: false,
            data: {},
            error: `Failed to restore snapshot: ${importResult.error}`,
          };
        }

        if (onSceneChange) {
          onSceneChange();
        }

        return {
          success: true,
          data: {
            restoredTo: prevSnapshot.id,
            index: snapshotIndex,
            total: snapshotHistory.length,
            restored: importResult.restored,
          },
        };
      }

      case 'redo': {
        if (snapshotIndex >= snapshotHistory.length - 1) {
          return {
            success: false,
            data: {},
            error: 'No next snapshot to redo to',
          };
        }

        // Save current index for potential rollback
        const previousIndex = snapshotIndex;

        // Move forward in history
        snapshotIndex++;
        const nextSnapshot = snapshotHistory[snapshotIndex];

        // Reset first, then restore scene
        exec.exec('reset', {});
        const importResult = exec.importScene(nextSnapshot.sceneJson);

        // Check if import failed
        if (importResult.error) {
          // Rollback snapshotIndex
          snapshotIndex = previousIndex;
          return {
            success: false,
            data: {},
            error: `Failed to restore snapshot: ${importResult.error}`,
          };
        }

        if (onSceneChange) {
          onSceneChange();
        }

        return {
          success: true,
          data: {
            restoredTo: nextSnapshot.id,
            index: snapshotIndex,
            total: snapshotHistory.length,
            restored: importResult.restored,
          },
        };
      }

      case 'snapshots': {
        return {
          success: true,
          data: {
            current: snapshotIndex,
            total: snapshotHistory.length,
            snapshots: snapshotHistory.map((s, i) => ({
              id: s.id,
              timestamp: s.timestamp,
              isCurrent: i === snapshotIndex,
            })),
          },
        };
      }

      default:
        return {
          success: false,
          data: {},
          error: `Unknown command: ${command}. Available: info, tree, groups, draw_order, selection, entity, capture, svg, json, reset, snapshot, undo, redo, snapshots`,
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
