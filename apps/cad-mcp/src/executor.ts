/**
 * CAD Executor - LLM-agnostic WASM Wrapper
 * 입력: 표준 JavaScript 타입 (style은 객체)
 * 출력: 내부 ToolResult
 *
 * 핵심: LLM은 객체로 style 전달, Executor가 WASM용 JSON 문자열로 변환
 */

import { Scene } from '../wasm/cad_engine.js';
import { ToolRegistry } from './tool-registry.js';
import { normalizeAngle, type AngleUnit } from './angle-utils.js';
import { logger } from './logger.js';

/**
 * 도구 실행 결과 (내부 표준)
 */
export interface ToolResult {
  success: boolean;
  entity?: string;
  type?: string;
  data?: string;
  error?: string;
  pivot?: [number, number];
  group?: string;
}

/**
 * CAD Executor - WASM Scene 래퍼
 *
 * WASM Scene 인스턴스를 관리하며, 사용 후 반드시 free()를 호출하여
 * 리소스를 해제해야 합니다. 미해제 시 메모리 누수가 발생할 수 있습니다.
 *
 * @example
 * const executor = CADExecutor.create('myScene');
 * try {
 *   executor.exec('draw_circle', { name: 'c1', x: 0, y: 0, radius: 50 });
 *   const json = executor.exportScene();
 * } finally {
 *   executor.free(); // 항상 리소스 해제 필요
 * }
 */
export class CADExecutor {
  private scene: Scene;
  private initialized = false;
  private registry: ToolRegistry;

  private constructor(scene: Scene) {
    this.scene = scene;
    this.initialized = true;
    this.registry = ToolRegistry.getInstance();
  }

  /**
   * Executor 생성
   *
   * Note: WASM init()은 #[wasm_bindgen(start)]로 모듈 로드 시 자동 실행됨
   */
  static create(sceneName: string): CADExecutor {
    return new CADExecutor(new Scene(sceneName));
  }

  /**
   * 객체를 JSON 문자열로 변환 (WASM 경계 처리)
   * LLM은 객체 전달, WASM은 문자열 필요
   */
  private toJson(obj: unknown): string {
    if (!obj) return '{}';
    if (typeof obj === 'string') return obj; // 하위 호환
    return JSON.stringify(obj);
  }

  /**
   * 입력값 타입 검증 (LLM 출력이 스키마를 준수하는지 확인)
   */
  private validateInput(
    input: Record<string, unknown>,
    schema: Record<string, 'string' | 'number' | 'number[]'>
  ): string | null {
    for (const [key, expectedType] of Object.entries(schema)) {
      const value = input[key];
      if (expectedType === 'number[]') {
        // Array of numbers validation (for points arrays)
        if (!Array.isArray(value)) {
          return `Expected number[] for '${key}', got ${typeof value}`;
        }
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] !== 'number' || !Number.isFinite(value[i])) {
            return `Expected number at ${key}[${i}], got ${typeof value[i]} (${value[i]})`;
          }
        }
      } else if (typeof value !== expectedType) {
        return `Expected ${expectedType} for '${key}', got ${typeof value}`;
      }
    }
    return null;
  }

  /**
   * 도구 실행
   */
  exec(toolName: string, input: Record<string, unknown>): ToolResult {
    if (!this.initialized) {
      return { success: false, error: 'Executor not initialized' };
    }

    try {
      switch (toolName) {
        // === primitives ===
        case 'draw_line':
          return this.drawLine(input);

        case 'draw_circle':
          return this.drawCircle(input);

        case 'draw_rect':
          return this.drawRect(input);

        case 'draw_arc':
          return this.drawArc(input);

        case 'draw_polygon':
          return this.drawPolygon(input);

        case 'draw_polygon_with_holes':
          return this.drawPolygonWithHoles(input);

        case 'draw_bezier':
          return this.drawBezier(input);

        // === style ===
        case 'set_stroke':
          return this.setStroke(input);

        case 'set_fill':
          return this.setFill(input);

        case 'remove_stroke':
          return this.removeStroke(input);

        case 'remove_fill':
          return this.removeFill(input);

        // === query ===
        case 'list_entities':
          return this.listEntities();

        case 'get_entity':
          return this.getEntity(input);

        case 'get_scene_info':
          return this.getSceneInfo();

        case 'get_world_transform':
          return this.getWorldTransform(input);

        case 'get_world_point':
          return this.getWorldPoint(input);

        case 'get_world_bounds':
          return this.getWorldBounds(input);

        case 'exists':
          return this.entityExists(input);

        // === transforms ===
        case 'translate':
          return this.translateEntity(input);

        case 'rotate':
          return this.rotateEntity(input);

        case 'scale':
          return this.scaleEntity(input);

        case 'delete':
          return this.deleteEntity(input);

        case 'set_pivot':
          return this.setPivot(input);

        case 'set_z_order':
          return this.setZOrder(input);

        case 'get_z_order':
          return this.getZOrder(input);

        case 'get_draw_order':
          return this.getDrawOrder(input);

        case 'draw_order':
          return this.drawOrder(input);

        // Legacy z-order commands (use draw_order instead)
        case 'bring_to_front':
          return this.bringToFront(input);

        case 'send_to_back':
          return this.sendToBack(input);

        case 'bring_forward':
          return this.bringForward(input);

        case 'send_backward':
          return this.sendBackward(input);

        case 'move_above':
          return this.moveAbove(input);

        case 'move_below':
          return this.moveBelow(input);

        // === group ===
        case 'create_group':
          return this.createGroup(input);

        case 'ungroup':
          return this.ungroupEntity(input);

        case 'add_to_group':
          return this.addToGroup(input);

        case 'remove_from_group':
          return this.removeFromGroup(input);

        // === registry ===
        case 'list_domains':
          return this.listDomainsHandler();

        case 'list_tools':
          return this.listToolsHandler(input);

        case 'get_tool_schema':
          return this.getToolSchemaHandler(input);

        case 'request_tool':
          return this.requestToolHandler(input);

        // === session ===
        case 'reset':
          return this.resetScene();

        case 'status':
          return this.getSceneInfo();

        // === export ===
        case 'export_json':
          return this.exportJson();

        case 'export_svg':
          return this.exportSvg();

        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.error(`[CADExecutor.exec] Tool execution failed: ${toolName}`, {
        input: JSON.stringify(input),
        error: errorMessage,
      });
      return { success: false, error: `${toolName}: ${errorMessage}` };
    }
  }

  // === Primitive implementations ===

  private drawLine(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', points: 'number[]' });
    if (error) return { success: false, error: `draw_line: ${error}` };

    const name = input.name as string;
    const points = new Float64Array(input.points as number[]);
    const styleJson = this.toJson(input.style);  // 객체 → JSON 문자열

    const result = this.scene.draw_line(name, points, styleJson);
    return { success: true, entity: result, type: 'line' };
  }

  private drawCircle(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', x: 'number', y: 'number', radius: 'number' });
    if (error) return { success: false, error: `draw_circle: ${error}` };

    const name = input.name as string;
    const x = input.x as number;
    const y = input.y as number;
    const radius = input.radius as number;
    const styleJson = this.toJson(input.style);

    const result = this.scene.draw_circle(name, x, y, radius, styleJson);
    return { success: true, entity: result, type: 'circle' };
  }

  private drawRect(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', x: 'number', y: 'number', width: 'number', height: 'number' });
    if (error) return { success: false, error: `draw_rect: ${error}` };

    const name = input.name as string;
    const x = input.x as number;
    const y = input.y as number;
    const width = input.width as number;
    const height = input.height as number;
    const styleJson = this.toJson(input.style);

    const result = this.scene.draw_rect(name, x, y, width, height, styleJson);
    return { success: true, entity: result, type: 'rect' };
  }

  /**
   * 호(arc)를 그립니다.
   * @param input.start_angle - 시작 각도
   * @param input.end_angle - 끝 각도
   * @param input.angle_unit - 각도 단위 ('degree' | 'radian', 기본값 'radian')
   */
  private drawArc(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', cx: 'number', cy: 'number', radius: 'number', start_angle: 'number', end_angle: 'number' });
    if (error) return { success: false, error: `draw_arc: ${error}` };

    const name = input.name as string;
    const cx = input.cx as number;
    const cy = input.cy as number;
    const radius = input.radius as number;
    const angleUnit = (input.angle_unit as AngleUnit) || 'radian';
    const startAngle = normalizeAngle(input.start_angle as number, angleUnit);
    const endAngle = normalizeAngle(input.end_angle as number, angleUnit);
    const styleJson = this.toJson(input.style);

    const result = this.scene.draw_arc(name, cx, cy, radius, startAngle, endAngle, styleJson);
    return { success: true, entity: result, type: 'arc' };
  }

  private drawPolygon(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', points: 'number[]' });
    if (error) return { success: false, error: `draw_polygon: ${error}` };

    const name = input.name as string;
    const points = new Float64Array(input.points as number[]);
    const styleJson = this.toJson(input.style);

    const result = this.scene.draw_polygon(name, points, styleJson);
    return { success: true, entity: result, type: 'polygon' };
  }

  /**
   * 구멍이 있는 다각형을 그립니다 (Boolean 연산 결과용).
   * @param input.name - Entity 이름
   * @param input.points - 외곽선 좌표 [x1, y1, x2, y2, ...]
   * @param input.holes - 구멍들의 좌표 배열 [[[x1,y1],[x2,y2],...], ...]
   * @param input.style - 스타일 (선택)
   */
  private drawPolygonWithHoles(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', points: 'number[]' });
    if (error) return { success: false, error: `draw_polygon_with_holes: ${error}` };

    const name = input.name as string;
    const points = new Float64Array(input.points as number[]);

    // holes 타입 검증
    const rawHoles = input.holes;
    const holes: [number, number][][] = [];
    if (rawHoles !== undefined && rawHoles !== null) {
      if (!Array.isArray(rawHoles)) {
        return { success: false, error: 'draw_polygon_with_holes: holes must be an array' };
      }
      for (let i = 0; i < rawHoles.length; i++) {
        const contour = rawHoles[i];
        if (!Array.isArray(contour)) {
          return { success: false, error: `draw_polygon_with_holes: holes[${i}] must be an array` };
        }
        const validatedContour: [number, number][] = [];
        for (let j = 0; j < contour.length; j++) {
          const pt = contour[j];
          if (!Array.isArray(pt) || pt.length !== 2 ||
              typeof pt[0] !== 'number' || typeof pt[1] !== 'number') {
            return { success: false, error: `draw_polygon_with_holes: holes[${i}][${j}] must be [number, number]` };
          }
          // NaN/Infinity 검증
          if (!Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
            return { success: false, error: `draw_polygon_with_holes: holes[${i}][${j}] contains NaN or Infinity` };
          }
          validatedContour.push([pt[0], pt[1]]);
        }
        holes.push(validatedContour);
      }
    }

    const holesJson = JSON.stringify(holes);
    const styleJson = this.toJson(input.style);

    const result = this.scene.draw_polygon_with_holes(name, points, holesJson, styleJson);
    return { success: true, entity: result, type: 'polygon' };
  }

  /**
   * 베지어 커브를 그립니다.
   * @param input.path - SVG path 문자열 (예: "M 0,0 C 30,50 70,50 100,0 S 170,50 200,0 Z")
   *                     M x,y = 시작점, C cp1 cp2 end = 큐빅, S cp2 end = 부드러운 연결, Z = 닫기
   */
  private drawBezier(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', path: 'string' });
    if (error) return { success: false, error: `draw_bezier: ${error}` };

    const name = input.name as string;
    const path = input.path as string;
    const styleJson = this.toJson(input.style);

    const result = this.scene.draw_bezier(name, path, styleJson);
    return { success: true, entity: result, type: 'bezier' };
  }

  // === Style implementations ===

  private setStroke(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string' });
    if (error) return { success: false, error: `set_stroke: ${error}` };

    const name = input.name as string;
    const strokeJson = this.toJson(input.stroke);  // 객체 → JSON 문자열

    const result = this.scene.set_stroke(name, strokeJson);
    return { success: result, entity: name };
  }

  private setFill(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string' });
    if (error) return { success: false, error: `set_fill: ${error}` };

    const name = input.name as string;
    const fillJson = this.toJson(input.fill);  // 객체 → JSON 문자열

    const result = this.scene.set_fill(name, fillJson);
    return { success: result, entity: name };
  }

  private removeStroke(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string' });
    if (error) return { success: false, error: `remove_stroke: ${error}` };

    const name = input.name as string;

    const result = this.scene.remove_stroke(name);
    return { success: result, entity: name };
  }

  private removeFill(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string' });
    if (error) return { success: false, error: `remove_fill: ${error}` };

    const name = input.name as string;

    const result = this.scene.remove_fill(name);
    return { success: result, entity: name };
  }

  // === Query implementations ===

  private listEntities(): ToolResult {
    const data = this.scene.list_entities();
    return { success: true, type: 'list', data };
  }

  private getEntity(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string' });
    if (error) return { success: false, error: `get_entity: ${error}` };

    const name = input.name as string;

    // Use WASM's get_entity_detailed for local/world coordinates (FR42)
    const data = this.scene.get_entity_detailed(name);

    if (data === undefined || data === null) {
      return { success: false, error: `Entity not found: ${name}` };
    }

    return { success: true, entity: name, type: 'entity', data };
  }

  private getSceneInfo(): ToolResult {
    const data = this.scene.get_scene_info();
    return { success: true, type: 'scene_info', data };
  }

  // === World Transform implementations (Phase 2) ===

  private getWorldTransform(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string' });
    if (error) return { success: false, error: `get_world_transform: ${error}` };

    const name = input.name as string;
    const data = this.scene.get_world_transform(name);

    if (data === undefined || data === null) {
      return { success: false, error: `Entity not found: ${name}` };
    }

    return { success: true, entity: name, type: 'world_transform', data };
  }

  private getWorldPoint(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', x: 'number', y: 'number' });
    if (error) return { success: false, error: `get_world_point: ${error}` };

    const name = input.name as string;
    const x = input.x as number;
    const y = input.y as number;
    const data = this.scene.get_world_point(name, x, y);

    if (data === undefined || data === null) {
      return { success: false, error: `Entity not found: ${name}` };
    }

    return { success: true, entity: name, type: 'world_point', data };
  }

  private getWorldBounds(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string' });
    if (error) return { success: false, error: `get_world_bounds: ${error}` };

    const name = input.name as string;
    const data = this.scene.get_world_bounds(name);

    if (data === undefined || data === null) {
      return { success: false, error: `Entity not found or empty: ${name}` };
    }

    return { success: true, entity: name, type: 'world_bounds', data };
  }

  private entityExists(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string' });
    if (error) return { success: false, error: `exists: ${error}` };

    const name = input.name as string;
    const exists = this.scene.exists(name);

    return { success: true, entity: name, type: 'exists', data: JSON.stringify({ exists }) };
  }

  // === Session implementations ===

  private resetScene(): ToolResult {
    try {
      const listJson = this.scene.list_entities();
      let cleared = 0;
      const list = JSON.parse(listJson);
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item && typeof item.name === 'string') {
            if (this.scene.delete(item.name)) {
              cleared += 1;
            }
          }
        }
      }
      return { success: true, type: 'reset', data: JSON.stringify({ cleared }) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `reset: ${message}` };
    }
  }

  // === Transform implementations ===

  private translateEntity(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', dx: 'number', dy: 'number' });
    if (error) return { success: false, error: `translate: ${error}` };

    const name = input.name as string;
    const dx = input.dx as number;
    const dy = input.dy as number;
    const space = (input.space as 'world' | 'local') || 'world';

    // Use WASM functions for coordinate conversion
    const result = space === 'world'
      ? this.scene.translate_world(name, dx, dy)
      : this.scene.translate(name, dx, dy);

    if (!result) {
      return { success: false, error: `Entity not found: ${name}` };
    }
    return { success: true, entity: name };
  }

  /**
   * 엔티티를 회전합니다.
   *
   * Note: space 옵션은 API 일관성을 위해 허용되지만, 회전에는 영향을 미치지 않습니다.
   * 회전 델타는 스칼라값이므로 world/local 구분이 무의미합니다.
   * (부모의 회전과 관계없이 동일한 각도만큼 회전)
   */
  private rotateEntity(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', angle: 'number' });
    if (error) return { success: false, error: `rotate: ${error}` };

    const name = input.name as string;
    const angleUnit = (input.angle_unit as AngleUnit) || 'radian';
    const angle = normalizeAngle(input.angle as number, angleUnit);
    // space option accepted for API consistency but has no effect on rotation
    // Rotation delta is a scalar - world/local distinction is not applicable
    void input.space; // Explicitly read to acknowledge API consistency

    const result = this.scene.rotate(name, angle);
    if (!result) {
      return { success: false, error: `Entity not found: ${name}` };
    }
    return { success: true, entity: name };
  }

  private scaleEntity(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', sx: 'number', sy: 'number' });
    if (error) return { success: false, error: `scale: ${error}` };

    const name = input.name as string;
    const sx = input.sx as number;
    const sy = input.sy as number;
    const space = (input.space as 'world' | 'local') || 'world';

    // Use WASM functions for coordinate conversion
    const result = space === 'world'
      ? this.scene.scale_world(name, sx, sy)
      : this.scene.scale(name, sx, sy);

    if (!result) {
      return { success: false, error: `Entity not found: ${name}` };
    }
    return { success: true, entity: name };
  }

  private deleteEntity(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string' });
    if (error) return { success: false, error: `delete: ${error}` };

    const name = input.name as string;

    const result = this.scene.delete(name);
    if (!result) {
      return { success: false, error: `Entity not found: ${name}` };
    }
    return { success: true, entity: name };
  }

  private setPivot(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', px: 'number', py: 'number' });
    if (error) return { success: false, error: `set_pivot: ${error}` };

    const name = input.name as string;
    const px = input.px as number;
    const py = input.py as number;

    const result = this.scene.set_pivot(name, px, py);
    if (!result) {
      return { success: false, error: `Entity not found: ${name}` };
    }
    return { success: true, entity: name, pivot: [px, py] };
  }

  private setZOrder(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', z_index: 'number' });
    if (error) return { success: false, error: `set_z_order: ${error}` };

    const name = input.name as string;
    const zIndex = Math.round(input.z_index as number);  // i32로 변환

    const result = this.scene.set_z_order(name, zIndex);
    if (!result) {
      return { success: false, error: `Entity not found: ${name}` };
    }
    return { success: true, entity: name, data: JSON.stringify({ z_index: zIndex }) };
  }

  private getZOrder(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string' });
    if (error) return { success: false, error: `get_z_order: ${error}` };

    const name = input.name as string;
    const zIndex = this.scene.get_z_order(name);

    if (zIndex === undefined || zIndex === null) {
      return { success: false, error: `Entity not found: ${name}` };
    }
    return { success: true, entity: name, type: 'z_order', data: JSON.stringify({ z_index: zIndex }) };
  }

  private getDrawOrder(input: Record<string, unknown>): ToolResult {
    const groupName = (input.group_name as string) || '';
    const result = this.scene.get_draw_order(groupName);
    if (result === undefined || result === null) {
      return { success: false, error: `Draw order not found${groupName ? ` for group: ${groupName}` : ''}` };
    }
    return { success: true, data: result };
  }

  /**
   * 통합 Z-Order 명령어
   * mode:
   *   - 'front': 맨 앞으로
   *   - 'back': 맨 뒤로
   *   - '+N' or N: N단계 앞으로
   *   - '-N': N단계 뒤로
   *   - 'above:target': target 위로
   *   - 'below:target': target 아래로
   */
  private drawOrder(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', mode: 'string' });
    if (error) return { success: false, error: `draw_order: ${error}` };

    const name = input.name as string;
    const mode = input.mode as string;

    const result = this.scene.draw_order(name, mode);
    if (!result) {
      return { success: false, error: `draw_order failed: entity not found or invalid mode (${mode})` };
    }
    return { success: true, entity: name, data: JSON.stringify({ mode }) };
  }

  // Legacy Z-Order Methods (use drawOrder instead)
  private bringToFront(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string' });
    if (error) return { success: false, error: `bring_to_front: ${error}` };

    const name = input.name as string;
    const result = this.scene.bring_to_front(name);
    if (!result) {
      return { success: false, error: `Entity not found: ${name}` };
    }
    return { success: true, entity: name };
  }

  private sendToBack(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string' });
    if (error) return { success: false, error: `send_to_back: ${error}` };

    const name = input.name as string;
    const result = this.scene.send_to_back(name);
    if (!result) {
      return { success: false, error: `Entity not found: ${name}` };
    }
    return { success: true, entity: name };
  }

  private bringForward(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string' });
    if (error) return { success: false, error: `bring_forward: ${error}` };

    const name = input.name as string;
    const result = this.scene.bring_forward(name);
    if (!result) {
      return { success: false, error: `Entity not found or already at front: ${name}` };
    }
    return { success: true, entity: name };
  }

  private sendBackward(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string' });
    if (error) return { success: false, error: `send_backward: ${error}` };

    const name = input.name as string;
    const result = this.scene.send_backward(name);
    if (!result) {
      return { success: false, error: `Entity not found or already at back: ${name}` };
    }
    return { success: true, entity: name };
  }

  private moveAbove(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', target: 'string' });
    if (error) return { success: false, error: `move_above: ${error}` };

    const name = input.name as string;
    const target = input.target as string;
    const result = this.scene.move_above(name, target);
    if (!result) {
      return { success: false, error: `Entity not found or different levels: ${name}, ${target}` };
    }
    return { success: true, entity: name };
  }

  private moveBelow(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', target: 'string' });
    if (error) return { success: false, error: `move_below: ${error}` };

    const name = input.name as string;
    const target = input.target as string;
    const result = this.scene.move_below(name, target);
    if (!result) {
      return { success: false, error: `Entity not found or different levels: ${name}, ${target}` };
    }
    return { success: true, entity: name };
  }

  // === Group implementations ===

  private createGroup(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string' });
    if (error) return { success: false, error: `create_group: ${error}` };

    const name = input.name as string;
    const rawChildren = input.children;
    if (rawChildren !== undefined && !Array.isArray(rawChildren)) {
      return { success: false, error: 'create_group: children must be an array' };
    }
    const children = (rawChildren as string[] | undefined) || [];
    const childrenJson = JSON.stringify(children);

    const result = this.scene.create_group(name, childrenJson);
    return { success: true, entity: result, type: 'group' };
  }

  private ungroupEntity(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string' });
    if (error) return { success: false, error: `ungroup: ${error}` };

    const name = input.name as string;
    const result = this.scene.ungroup(name);

    if (!result) {
      return { success: false, error: `Group not found: ${name}` };
    }
    return { success: true, entity: name };
  }

  private addToGroup(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, {
      group_name: 'string',
      entity_name: 'string',
    });
    if (error) return { success: false, error: `add_to_group: ${error}` };

    const groupName = input.group_name as string;
    const entityName = input.entity_name as string;
    const result = this.scene.add_to_group(groupName, entityName);

    if (!result) {
      return {
        success: false,
        error: `add_to_group: Group or entity not found (group: ${groupName}, entity: ${entityName})`,
      };
    }
    return { success: true, group: groupName, entity: entityName };
  }

  private removeFromGroup(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, {
      group_name: 'string',
      entity_name: 'string',
    });
    if (error) return { success: false, error: `remove_from_group: ${error}` };

    const groupName = input.group_name as string;
    const entityName = input.entity_name as string;
    const result = this.scene.remove_from_group(groupName, entityName);

    if (!result) {
      return {
        success: false,
        error: `remove_from_group: Group not found or entity not in group (group: ${groupName}, entity: ${entityName})`,
      };
    }
    return { success: true, group: groupName, entity: entityName };
  }

  // === Registry implementations ===

  private listDomainsHandler(): ToolResult {
    const domains = this.registry.listDomains();
    return { success: true, type: 'domains', data: JSON.stringify(domains) };
  }

  private listToolsHandler(input: Record<string, unknown>): ToolResult {
    const domain = input.domain as string | undefined;
    const result = this.registry.listTools(domain);
    return { success: true, type: 'tools', data: JSON.stringify(result) };
  }

  private getToolSchemaHandler(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string' });
    if (error) return { success: false, error: `get_tool_schema: ${error}` };

    const name = input.name as string;
    const schema = this.registry.getToolSchema(name);

    if (!schema) {
      const suggestions = this.registry.findSimilar(name);
      return {
        success: false,
        error: `Tool '${name}' not found`,
        data: JSON.stringify({ suggestions }),
      };
    }

    return { success: true, type: 'schema', data: JSON.stringify(schema) };
  }

  private requestToolHandler(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', description: 'string', rationale: 'string' });
    if (error) return { success: false, error: `request_tool: ${error}` };

    const result = this.registry.requestTool({
      name: input.name as string,
      description: input.description as string,
      rationale: input.rationale as string,
      suggested_params: input.suggested_params as string[] | undefined,
    });

    // 중복 요청인 경우
    if ('status' in result && result.status === 'already_requested') {
      return {
        success: true,
        type: 'request',
        data: JSON.stringify({
          request_id: result.existing.id,
          status: 'already_requested',
          message: '이미 동일한 도구 요청이 대기 중입니다.',
        }),
      };
    }

    // 새 요청 생성
    return {
      success: true,
      type: 'request',
      data: JSON.stringify({
        request_id: result.id,
        status: result.status,
        message: '도구 요청이 등록되었습니다. 개발자 검토 후 추가됩니다.',
      }),
    };
  }

  // === Export implementations ===

  private exportJson(): ToolResult {
    const json = this.scene.export_json();
    return { success: true, type: 'json', data: json };
  }

  private exportSvg(): ToolResult {
    const svg = this.scene.export_svg();
    return { success: true, type: 'svg', data: svg };
  }

  /**
   * Scene JSON 내보내기 (편의 메서드)
   */
  exportScene(): string {
    if (!this.initialized) {
      throw new Error('Executor not initialized or already freed');
    }
    return this.scene.export_json();
  }

  /**
   * Scene JSON에서 복원 (영속성)
   * 저장된 씬 JSON을 파싱해서 엔티티들을 재생성합니다.
   */
  importScene(sceneJson: string): { restored: number; errors: string[] } {
    if (!this.initialized) {
      throw new Error('Executor not initialized or already freed');
    }

    const errors: string[] = [];
    let restored = 0;

    try {
      const scene = JSON.parse(sceneJson);
      const entities = scene.entities || [];

      // 그룹이 아닌 엔티티부터 먼저 생성 (의존성 순서)
      // Note: 씬 JSON에서는 entity_type 필드 사용
      const nonGroups = entities.filter((e: Record<string, unknown>) => e.entity_type !== 'Group');
      const groups = entities.filter((e: Record<string, unknown>) => e.entity_type === 'Group');

      // 1. 기본 도형들 생성
      for (const entity of nonGroups) {
        const entityName = (entity.metadata as Record<string, unknown>)?.name as string || entity.id;
        try {
          this.restoreEntity(entity);
          restored++;
        } catch (e) {
          errors.push(`${entityName}: ${e}`);
        }
      }

      // 2. 그룹 생성 (자식이 이미 존재해야 함)
      for (const group of groups) {
        const groupName = (group.metadata as Record<string, unknown>)?.name as string || group.id;
        try {
          this.restoreGroup(group);
          restored++;
        } catch (e) {
          errors.push(`${groupName}: ${e}`);
        }
      }

      return { restored, errors };
    } catch (e) {
      errors.push(`JSON parse error: ${e}`);
      return { restored, errors };
    }
  }

  /**
   * 개별 엔티티 복원 (내부용)
   * 씬 JSON 구조: { entity_type, geometry, style, metadata: { name } }
   */
  private restoreEntity(entity: Record<string, unknown>): void {
    const metadata = entity.metadata as Record<string, unknown> | undefined;
    const name = (metadata?.name as string) || (entity.id as string);
    const type = entity.entity_type as string;
    const geometry = entity.geometry as Record<string, unknown>;
    const style = entity.style as Record<string, unknown> | undefined;

    // 타입별 도형 생성
    switch (type) {
      case 'Circle': {
        const data = geometry.Circle as { center: number[]; radius: number };
        this.exec('draw_circle', { name, x: data.center[0], y: data.center[1], radius: data.radius });
        break;
      }
      case 'Rect': {
        const data = geometry.Rect as { center: number[]; width: number; height: number };
        // Rect는 center 기준이므로 좌하단으로 변환
        const x = data.center[0] - data.width / 2;
        const y = data.center[1] - data.height / 2;
        this.exec('draw_rect', { name, x, y, width: data.width, height: data.height });
        break;
      }
      case 'Polygon': {
        const data = geometry.Polygon as { points: number[][] };
        const points = data.points.flat();
        this.exec('draw_polygon', { name, points });
        break;
      }
      case 'Line': {
        const data = geometry.Line as { points: number[][] };
        const points = data.points.flat();
        this.exec('draw_line', { name, points });
        break;
      }
      case 'Arc': {
        const data = geometry.Arc as { center: number[]; radius: number; start_angle: number; end_angle: number };
        this.exec('draw_arc', {
          name,
          cx: data.center[0],
          cy: data.center[1],
          radius: data.radius,
          startAngle: data.start_angle,
          endAngle: data.end_angle,
        });
        break;
      }
      case 'Bezier': {
        const data = geometry.Bezier as { path: string };
        this.exec('draw_bezier', { name, path: data.path });
        break;
      }
      case 'Text': {
        const data = geometry.Text as { text: string; position: number[]; font_size: number };
        this.exec('draw_text', { name, text: data.text, x: data.position[0], y: data.position[1], fontSize: data.font_size });
        break;
      }
      default:
        throw new Error(`Unknown entity type: ${type}`);
    }

    // 스타일 복원
    // 씬 JSON 스타일 구조: { fill: { color: [] }, stroke: { color: [], width } }
    if (style) {
      const fill = style.fill as Record<string, unknown> | undefined;
      const stroke = style.stroke as Record<string, unknown> | undefined;

      if (fill?.color) {
        // set_fill expects { name, fill: { color: [r,g,b,a] } }
        const result = this.exec('set_fill', { name, fill: { color: fill.color } });
        if (!result.success) {
          logger.warn(`Failed to restore fill for ${name}: ${result.error}`);
        }
      }
      if (stroke?.color) {
        // set_stroke expects { name, stroke: { color: [r,g,b,a], width } }
        const result = this.exec('set_stroke', { name, stroke: { color: stroke.color, width: stroke.width } });
        if (!result.success) {
          logger.warn(`Failed to restore stroke for ${name}: ${result.error}`);
        }
      }
    }
  }

  /**
   * 그룹 복원 (내부용)
   * 씬 JSON 그룹 구조: { entity_type: 'Group', metadata: { name }, computed: { children } }
   */
  private restoreGroup(group: Record<string, unknown>): void {
    const metadata = group.metadata as Record<string, unknown> | undefined;
    const name = (metadata?.name as string) || (group.id as string);
    const computed = group.computed as Record<string, unknown> | undefined;
    const children = computed?.children as string[] | undefined;

    if (children && children.length > 0) {
      this.exec('create_group', { name, children });
    }
  }

  /**
   * Scene 이름 반환
   */
  getSceneName(): string {
    if (!this.initialized) {
      throw new Error('Executor not initialized or already freed');
    }
    return this.scene.get_name();
  }

  /**
   * 엔티티 수 반환
   */
  getEntityCount(): number {
    if (!this.initialized) {
      throw new Error('Executor not initialized or already freed');
    }
    return this.scene.entity_count();
  }

  /**
   * 리소스 해제
   */
  free(): void {
    if (this.initialized) {
      this.scene.free();
      this.initialized = false;
    }
  }
}
