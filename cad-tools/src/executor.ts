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
    const name = input.name as string;
    const points = new Float64Array(input.points as number[]);
    const styleJson = this.toJson(input.style);  // 객체 → JSON 문자열

    const result = this.scene.draw_line(name, points, styleJson);
    return { success: true, entity: result, type: 'line' };
  }

  private drawCircle(input: Record<string, unknown>): ToolResult {
    const name = input.name as string;
    const x = input.x as number;
    const y = input.y as number;
    const radius = input.radius as number;
    const styleJson = this.toJson(input.style);

    const result = this.scene.draw_circle(name, x, y, radius, styleJson);
    return { success: true, entity: result, type: 'circle' };
  }

  private drawRect(input: Record<string, unknown>): ToolResult {
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
    const name = input.name as string;
    const strokeJson = this.toJson(input.stroke);  // 객체 → JSON 문자열

    const result = this.scene.set_stroke(name, strokeJson);
    return { success: result, entity: name };
  }

  private setFill(input: Record<string, unknown>): ToolResult {
    const name = input.name as string;
    const fillJson = this.toJson(input.fill);  // 객체 → JSON 문자열

    const result = this.scene.set_fill(name, fillJson);
    return { success: result, entity: name };
  }

  private removeStroke(input: Record<string, unknown>): ToolResult {
    const name = input.name as string;

    const result = this.scene.remove_stroke(name);
    return { success: result, entity: name };
  }

  private removeFill(input: Record<string, unknown>): ToolResult {
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
    return this.scene.export_json();
  }

  /**
   * Scene 이름 반환
   */
  getSceneName(): string {
    return this.scene.get_name();
  }

  /**
   * 엔티티 수 반환
   */
  getEntityCount(): number {
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
