/**
 * CAD Executor - LLM-agnostic WASM Wrapper
 * 입력: 표준 JavaScript 타입 (style은 객체)
 * 출력: 내부 ToolResult
 *
 * 핵심: LLM은 객체로 style 전달, Executor가 WASM용 JSON 문자열로 변환
 */

// @ts-ignore - WASM module lacks type declarations
import { Scene } from '../../cad-engine/pkg/cad_engine.js';
import { ToolRegistry } from './tool-registry.js';
import { normalizeAngle, type AngleUnit } from './angle-utils.js';

/**
 * 도구 실행 결과 (내부 표준)
 */
export interface ToolResult {
  success: boolean;
  entity?: string;
  type?: string;
  data?: string;
  error?: string;
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

        // === transforms ===
        case 'translate':
          return this.translateEntity(input);

        case 'rotate':
          return this.rotateEntity(input);

        case 'scale':
          return this.scaleEntity(input);

        case 'delete':
          return this.deleteEntity(input);

        // === registry ===
        case 'list_domains':
          return this.listDomainsHandler();

        case 'list_tools':
          return this.listToolsHandler(input);

        case 'get_tool_schema':
          return this.getToolSchemaHandler(input);

        case 'request_tool':
          return this.requestToolHandler(input);

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
      console.error(`[CADExecutor.exec] Tool execution failed: ${toolName}`, {
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
    const data = this.scene.get_entity(name);

    if (data === undefined || data === null) {
      return { success: false, error: `Entity not found: ${name}` };
    }

    return { success: true, entity: name, type: 'entity', data };
  }

  private getSceneInfo(): ToolResult {
    const data = this.scene.get_scene_info();
    return { success: true, type: 'scene_info', data };
  }

  // === Transform implementations ===

  private translateEntity(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', dx: 'number', dy: 'number' });
    if (error) return { success: false, error: `translate: ${error}` };

    const name = input.name as string;
    const dx = input.dx as number;
    const dy = input.dy as number;

    const result = this.scene.translate(name, dx, dy);
    if (!result) {
      return { success: false, error: `Entity not found: ${name}` };
    }
    return { success: true, entity: name };
  }

  private rotateEntity(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', angle: 'number' });
    if (error) return { success: false, error: `rotate: ${error}` };

    const name = input.name as string;
    const angleUnit = (input.angle_unit as AngleUnit) || 'radian';
    const angle = normalizeAngle(input.angle as number, angleUnit);

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

    const result = this.scene.scale(name, sx, sy);
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

    const request = this.registry.requestTool({
      name: input.name as string,
      description: input.description as string,
      rationale: input.rationale as string,
      suggested_params: input.suggested_params as string[] | undefined,
    });

    return {
      success: true,
      type: 'request',
      data: JSON.stringify({
        request_id: request.id,
        status: request.status,
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
