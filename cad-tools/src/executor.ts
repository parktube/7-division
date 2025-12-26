/**
 * CAD Executor - LLM-agnostic WASM Wrapper
 * 입력: 표준 JavaScript 타입 (style은 객체)
 * 출력: 내부 ToolResult
 *
 * 핵심: LLM은 객체로 style 전달, Executor가 WASM용 JSON 문자열로 변환
 */

// @ts-expect-error - WASM module type
import { Scene, init } from '../../cad-engine/pkg/cad_engine.js';

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
 */
export class CADExecutor {
  private scene: Scene;
  private initialized = false;

  private constructor(scene: Scene) {
    this.scene = scene;
    this.initialized = true;
  }

  /**
   * Executor 생성
   */
  static create(sceneName: string): CADExecutor {
    init();
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

        // === export ===
        case 'export_json':
          return this.exportJson();

        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (e) {
      return { success: false, error: String(e) };
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

  private drawArc(input: Record<string, unknown>): ToolResult {
    const error = this.validateInput(input, { name: 'string', cx: 'number', cy: 'number', radius: 'number', start_angle: 'number', end_angle: 'number' });
    if (error) return { success: false, error: `draw_arc: ${error}` };

    const name = input.name as string;
    const cx = input.cx as number;
    const cy = input.cy as number;
    const radius = input.radius as number;
    const startAngle = input.start_angle as number;
    const endAngle = input.end_angle as number;
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

  // === Export implementations ===

  private exportJson(): ToolResult {
    const json = this.scene.export_json();
    return { success: true, type: 'json', data: json };
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
