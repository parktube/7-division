/* tslint:disable */
/* eslint-disable */

export class Scene {
  free(): void;
  [Symbol.dispose](): void;
  constructor(name: string);
  get_name(): string;
  entity_count(): number;
  /**
   * Scene을 JSON으로 내보냅니다.
   */
  export_json(): string;
  /**
   * Scene을 SVG로 내보냅니다.
   */
  export_svg(): string;
  /**
   * 여러 Entity를 그룹으로 묶습니다. (WASM 바인딩)
   *
   * # Arguments
   * * `name` - 그룹 이름 (예: "left_arm") - Scene 내 unique
   * * `children_json` - 자식 Entity 이름들의 JSON 배열 (예: '["upper_arm", "lower_arm"]')
   *
   * # Returns
   * * Ok(name) - 성공 시 그룹 name 반환
   *
   * # Errors
   * * name 중복 시 에러
   *
   * # 입력 보정 (AC2)
   * 존재하지 않는 자식 이름은 무시하고 정상 생성
   */
  create_group(name: string, children_json: string): string;
  /**
   * 그룹을 해제하여 자식들을 독립 엔티티로 만듭니다. (WASM 바인딩)
   *
   * # Arguments
   * * `name` - 해제할 그룹 이름
   *
   * # Returns
   * * Ok(true) - 그룹 해제 성공
   * * Ok(false) - name이 존재하지 않음
   *
   * # Errors
   * * name이 Group 타입이 아니면 에러
   */
  ungroup(name: string): boolean;
  /**
   * 그룹에 Entity를 추가합니다. (WASM 바인딩)
   *
   * # Arguments
   * * `group_name` - 그룹 이름
   * * `entity_name` - 추가할 Entity 이름
   *
   * # Returns
   * * Ok(true) - 추가 성공
   * * Ok(false) - group_name 또는 entity_name이 존재하지 않음
   *
   * # Errors
   * * group_name이 Group 타입이 아니면 에러
   *
   * # Notes
   * 이미 다른 그룹에 속한 Entity는 기존 그룹에서 제거 후 추가됩니다.
   */
  add_to_group(group_name: string, entity_name: string): boolean;
  /**
   * 그룹에서 Entity를 제거합니다. (WASM 바인딩)
   *
   * # Arguments
   * * `group_name` - 그룹 이름
   * * `entity_name` - 제거할 Entity 이름
   *
   * # Returns
   * * Ok(true) - 제거 성공
   * * Ok(false) - group_name 또는 entity_name이 존재하지 않음, 또는 해당 그룹의 자식이 아님
   *
   * # Errors
   * * group_name이 Group 타입이 아니면 에러
   */
  remove_from_group(group_name: string, entity_name: string): boolean;
  /**
   * 선분(Line) 도형을 생성합니다.
   *
   * # Arguments
   * * `name` - Entity 이름 (예: "spine", "left_arm") - Scene 내 unique
   * * `points` - [x1, y1, x2, y2, ...] 형태의 Float64Array
   *
   * # Returns
   * * Ok(name) - 성공 시 name 반환
   * * Err - name 중복 또는 잘못된 입력
   *
   * # 입력 보정 (AC3)
   * 홀수 개 좌표가 주어지면 마지막 좌표를 무시하고 정상 처리
   */
  add_line(name: string, points: Float64Array): string;
  /**
   * 원(Circle) 도형을 생성합니다.
   *
   * # Arguments
   * * `name` - Entity 이름 (예: "head", "joint_elbow") - Scene 내 unique
   * * `x` - 중심점 x 좌표
   * * `y` - 중심점 y 좌표
   * * `radius` - 반지름 (음수/0 → abs().max(0.001)로 보정)
   *
   * # Returns
   * * Ok(name) - 성공 시 name 반환
   *
   * # Errors
   * * name 중복 시 에러
   * * x, y, radius 중 NaN 또는 Infinity 입력 시 에러
   *
   * # 입력 보정 (AC2)
   * 음수/0 반지름은 abs().max(0.001)로 양수 변환
   */
  add_circle(name: string, x: number, y: number, radius: number): string;
  /**
   * 사각형(Rect) 도형을 생성합니다.
   *
   * # Arguments
   * * `name` - Entity 이름 (예: "torso", "background") - Scene 내 unique
   * * `x` - 중심 x 좌표 (사각형의 중심점)
   * * `y` - 중심 y 좌표 (사각형의 중심점)
   * * `width` - 너비 (음수/0 → abs().max(0.001)로 보정)
   * * `height` - 높이 (음수/0 → abs().max(0.001)로 보정)
   *
   * # Returns
   * * Ok(name) - 성공 시 name 반환
   *
   * # Errors
   * * name 중복 시 에러
   * * x, y, width, height 중 NaN 또는 Infinity 입력 시 에러
   *
   * # 입력 보정 (AC2)
   * 음수/0 크기는 abs().max(0.001)로 양수 변환
   */
  add_rect(name: string, x: number, y: number, width: number, height: number): string;
  /**
   * 호(Arc) 도형을 생성합니다.
   *
   * # Arguments
   * * `name` - Entity 이름 (예: "shoulder_arc") - Scene 내 unique
   * * `cx` - 중심점 x 좌표
   * * `cy` - 중심점 y 좌표
   * * `radius` - 반지름 (음수/0 → abs().max(0.001)로 보정)
   * * `start_angle` - 시작 각도 (라디안, 0 = 3시 방향)
   * * `end_angle` - 끝 각도 (라디안, 양수 = CCW)
   *
   * # Returns
   * * Ok(name) - 성공 시 name 반환
   *
   * # Errors
   * * name 중복 시 에러
   * * NaN 또는 Infinity 입력 시 에러
   *
   * # 입력 보정
   * 음수/0 반지름은 abs().max(0.001)로 양수 변환
   */
  add_arc(name: string, cx: number, cy: number, radius: number, start_angle: number, end_angle: number): string;
  /**
   * 스타일이 적용된 호(Arc)를 생성합니다.
   *
   * # Arguments
   * * `name` - Entity 이름 (예: "shoulder_arc") - Scene 내 unique
   * * `cx` - 중심점 x 좌표
   * * `cy` - 중심점 y 좌표
   * * `radius` - 반지름 (음수/0 → abs().max(0.001)로 보정)
   * * `start_angle` - 시작 각도 (라디안, 0 = 3시 방향)
   * * `end_angle` - 끝 각도 (라디안, 양수 = CCW)
   * * `style_json` - 스타일 JSON (파싱 실패 시 기본 스타일 사용)
   *
   * # Returns
   * * Ok(name) - 성공 시 name 반환
   *
   * # Errors
   * * name 중복 시 에러
   * * NaN 또는 Infinity 입력 시 에러
   */
  draw_arc(name: string, cx: number, cy: number, radius: number, start_angle: number, end_angle: number, style_json: string): string;
  /**
   * 스타일이 적용된 원(Circle)을 생성합니다.
   *
   * # Arguments
   * * `name` - Entity 이름 (예: "head") - Scene 내 unique
   * * `x` - 중심점 x 좌표
   * * `y` - 중심점 y 좌표
   * * `radius` - 반지름 (음수/0 → abs().max(0.001)로 보정)
   * * `style_json` - 스타일 JSON (파싱 실패 시 기본 스타일 사용)
   *
   * # Returns
   * * Ok(name) - 성공 시 name 반환
   *
   * # Errors
   * * name 중복 시 에러
   * * NaN 또는 Infinity 입력 시 에러
   */
  draw_circle(name: string, x: number, y: number, radius: number, style_json: string): string;
  /**
   * 스타일이 적용된 선분(Line)을 생성합니다.
   *
   * # Arguments
   * * `name` - Entity 이름 (예: "spine") - Scene 내 unique
   * * `points` - [x1, y1, x2, y2, ...] 형태의 Float64Array
   * * `style_json` - 스타일 JSON (파싱 실패 시 기본 스타일 사용)
   *
   * # Returns
   * * Ok(name) - 성공 시 name 반환
   *
   * # Errors
   * * name 중복 시 에러
   * * 좌표에 NaN/Infinity 포함 시 에러
   * * 최소 2점 미만 시 에러
   */
  draw_line(name: string, points: Float64Array, style_json: string): string;
  /**
   * 닫힌 다각형(Polygon)을 생성합니다. fill 지원.
   *
   * # Arguments
   * * `name` - Entity 이름 (예: "mountain") - Scene 내 unique
   * * `points` - Float64Array [x1, y1, x2, y2, ...] (최소 3점, 6개 값)
   * * `style_json` - 스타일 JSON (파싱 실패 시 기본 스타일 사용)
   *
   * # Returns
   * * Ok(name) - 성공 시 name 반환
   *
   * # Errors
   * * name 중복 시 에러
   * * 3점 미만 시 에러
   */
  draw_polygon(name: string, points: Float64Array, style_json: string): string;
  /**
   * 구멍이 있는 다각형을 생성합니다 (Boolean 연산 결과용).
   *
   * # Arguments
   * * `name` - Entity 이름
   * * `points` - 외곽선 좌표 [x1, y1, x2, y2, ...]
   * * `holes_json` - 구멍들의 JSON 배열 (예: `[[[x1,y1],[x2,y2],...], ...]`)
   * * `style_json` - 스타일 JSON
   *
   * # Errors
   * * name 중복 시 에러
   * * 외곽선 3점 미만 시 에러
   * * holes_json 파싱 에러
   */
  draw_polygon_with_holes(name: string, points: Float64Array, holes_json: string, style_json: string): string;
  /**
   * SVG path 문자열로 베지어 커브를 생성합니다.
   *
   * # Arguments
   * * `name` - Entity 이름 (예: "curve1") - Scene 내 unique
   * * `path` - SVG path 문자열
   *   - `M x,y` : 시작점 (Move to)
   *   - `C cp1x,cp1y cp2x,cp2y x,y` : 큐빅 베지어
   *   - `S cp2x,cp2y x,y` : 부드러운 연결 (cp1 자동 반영)
   *   - `Q cpx,cpy x,y` : 쿼드라틱 (큐빅으로 변환)
   *   - `L x,y` : 직선 (베지어로 변환)
   *   - `Z` : 경로 닫기
   * * `style_json` - 스타일 JSON
   *
   * # Examples
   * ```javascript
   * // 단순 큐빅 베지어
   * drawBezier('wave', 'M 0,0 C 30,50 70,50 100,0')
   *
   * // 부드러운 S 커브 (S 명령어로 자동 연결)
   * drawBezier('s_curve', 'M 0,0 C 30,50 70,50 100,0 S 170,-50 200,0')
   *
   * // 닫힌 형태
   * drawBezier('blob', 'M 0,0 C 50,80 80,80 100,0 S 50,-80 0,0 Z')
   * ```
   *
   * # Returns
   * * Ok(name) - 성공 시 name 반환
   *
   * # Errors
   * * name 중복 시 에러
   * * 잘못된 SVG path 문법
   */
  draw_bezier(name: string, path: string, style_json: string): string;
  /**
   * 스타일이 적용된 사각형(Rect)을 생성합니다.
   *
   * # Arguments
   * * `name` - Entity 이름 (예: "torso") - Scene 내 unique
   * * `x` - 중심 x 좌표
   * * `y` - 중심 y 좌표
   * * `width` - 너비 (음수/0 → abs().max(0.001)로 보정)
   * * `height` - 높이 (음수/0 → abs().max(0.001)로 보정)
   * * `style_json` - 스타일 JSON (파싱 실패 시 기본 스타일 사용)
   *
   * # Returns
   * * Ok(name) - 성공 시 name 반환
   *
   * # Errors
   * * name 중복 시 에러
   * * NaN 또는 Infinity 입력 시 에러
   */
  draw_rect(name: string, x: number, y: number, width: number, height: number, style_json: string): string;
  /**
   * 기존 도형의 stroke 스타일을 변경합니다.
   *
   * # Arguments
   * * `name` - Entity 이름 (예: "head", "left_arm")
   * * `stroke_json` - StrokeStyle JSON (부분 업데이트 지원)
   *
   * # Returns
   * * Ok(true) - 성공
   * * Ok(false) - name 미발견
   *
   * # Partial Update (AC6)
   * 기존 stroke가 있는 경우, JSON에 명시된 필드만 업데이트됩니다.
   * 예: { "color": [1,0,0,1] } → color만 변경, 나머지 유지
   */
  set_stroke(name: string, stroke_json: string): boolean;
  /**
   * 기존 도형의 fill 스타일을 변경합니다.
   *
   * # Arguments
   * * `name` - Entity 이름
   * * `fill_json` - FillStyle JSON
   *
   * # Returns
   * * Ok(true) - 성공
   * * Ok(false) - name 미발견
   */
  set_fill(name: string, fill_json: string): boolean;
  /**
   * stroke를 제거합니다 (선 없음).
   *
   * # Arguments
   * * `name` - Entity 이름
   *
   * # Returns
   * * Ok(true) - 성공
   * * Ok(false) - name 미발견
   */
  remove_stroke(name: string): boolean;
  /**
   * fill을 제거합니다 (채움 없음).
   *
   * # Arguments
   * * `name` - Entity 이름
   *
   * # Returns
   * * Ok(true) - 성공
   * * Ok(false) - name 미발견
   */
  remove_fill(name: string): boolean;
  /**
   * Entity를 지정된 거리만큼 이동합니다.
   *
   * # Arguments
   * * `name` - 대상 Entity의 이름 (예: "left_arm")
   * * `dx` - x축 이동 거리
   * * `dy` - y축 이동 거리
   *
   * # Returns
   * * Ok(true) - 성공
   * * Ok(false) - name 미발견 (no-op)
   */
  translate(name: string, dx: number, dy: number): boolean;
  /**
   * Entity를 지정된 각도만큼 회전합니다.
   *
   * # Arguments
   * * `name` - 대상 Entity의 이름 (예: "left_arm")
   * * `angle` - 회전 각도 (라디안, 양수 = 반시계방향)
   *
   * # Returns
   * * Ok(true) - 성공
   * * Ok(false) - name 미발견 (no-op)
   */
  rotate(name: string, angle: number): boolean;
  /**
   * Entity를 지정된 배율로 크기를 변경합니다.
   *
   * # Arguments
   * * `name` - 대상 Entity의 이름 (예: "left_arm")
   * * `sx` - x축 스케일 배율
   * * `sy` - y축 스케일 배율
   *
   * # Returns
   * * Ok(true) - 성공
   * * Ok(false) - name 미발견 (no-op)
   *
   * # Note
   * 0 이하의 스케일 값은 자동으로 양수(최소 0.001)로 보정됩니다.
   * 예: scale("e", -2, 0) → 실제 적용: (2.0, 0.001)
   */
  scale(name: string, sx: number, sy: number): boolean;
  /**
   * Entity를 월드 좌표 기준으로 이동합니다.
   *
   * 부모 그룹의 scale을 역산하여 로컬 delta로 변환 후 적용합니다.
   */
  translate_world(name: string, dx: number, dy: number): boolean;
  /**
   * Entity를 월드 좌표 기준으로 스케일합니다.
   *
   * 부모 그룹의 scale을 역산하여 로컬 scale로 변환 후 적용합니다.
   */
  scale_world(name: string, sx: number, sy: number): boolean;
  /**
   * Entity를 삭제합니다.
   *
   * Group 삭제 시 자식들의 parent_id를 정리하고,
   * 부모가 있는 경우 부모의 children 목록에서 제거합니다.
   *
   * # Arguments
   * * `name` - 삭제할 Entity의 이름
   *
   * # Returns
   * * Ok(true) - 삭제 성공
   * * Ok(false) - name 미발견 (no-op)
   */
  delete(name: string): boolean;
  /**
   * Entity의 회전/스케일 중심점(pivot)을 설정합니다.
   *
   * # Arguments
   * * `name` - Entity 이름
   * * `px` - pivot x 좌표 (로컬 좌표계)
   * * `py` - pivot y 좌표 (로컬 좌표계)
   *
   * # Returns
   * * Ok(true) - 성공
   * * Ok(false) - name 미발견 (no-op)
   */
  set_pivot(name: string, px: number, py: number): boolean;
  /**
   * 통합 Z-Order 명령어: Entity의 드로우 순서를 변경합니다.
   *
   * # Arguments
   * * `name` - Entity 이름
   * * `mode` - 이동 모드:
   *   - "front": 맨 앞으로
   *   - "back": 맨 뒤로
   *   - "+N" (예: "+1", "+2"): N단계 앞으로
   *   - "-N" (예: "-1", "-2"): N단계 뒤로
   *   - "above:target": target 엔티티 위로
   *   - "below:target": target 엔티티 아래로
   *
   * # Returns
   * * Ok(true) - 성공
   * * Ok(false) - name 미발견 또는 이동 불가
   */
  draw_order(name: string, mode: string): boolean;
  /**
   * [Deprecated] draw_order(name, "front") 사용 권장
   */
  bring_to_front(name: string): boolean;
  /**
   * [Deprecated] draw_order(name, "back") 사용 권장
   */
  send_to_back(name: string): boolean;
  /**
   * [Deprecated] draw_order(name, "+1") 사용 권장
   */
  bring_forward(name: string): boolean;
  /**
   * [Deprecated] draw_order(name, "-1") 사용 권장
   */
  send_backward(name: string): boolean;
  /**
   * [Deprecated] draw_order(name, "above:target") 사용 권장
   */
  move_above(name: string, target: string): boolean;
  /**
   * [Deprecated] draw_order(name, "below:target") 사용 권장
   */
  move_below(name: string, target: string): boolean;
  /**
   * Entity의 z-order(렌더링 순서)를 직접 설정합니다.
   *
   * # Note
   * - 대부분의 경우 `draw_order` 사용 권장
   * - 이 함수는 정규화(normalize)를 호출하지 않으므로 z-index 갭이 발생할 수 있음
   * - 직접 제어가 필요한 고급 사용 사례용
   */
  set_z_order(name: string, z_index: number): boolean;
  /**
   * Entity의 z_index를 조회합니다.
   */
  get_z_order(name: string): number | undefined;
  /**
   * Scene 내 모든 Entity의 이름과 타입을 반환합니다.
   *
   * # Returns
   * JSON 배열: [{"name": "head", "type": "Circle"}, ...]
   *
   * # Examples
   * ```ignore
   * let list = scene.list_entities();
   * // [{"name":"wall","type":"Rect"},{"name":"door","type":"Arc"}]
   * ```
   */
  list_entities(): string;
  /**
   * 계층적 드로우 오더를 조회합니다.
   *
   * Progressive Disclosure: LLM이 필요한 만큼만 drill-down할 수 있도록
   * root level 또는 특정 그룹의 자식들을 순서대로 반환합니다.
   *
   * # Arguments
   * * `group_name` - 빈 문자열이면 root level, 그룹 이름이면 해당 그룹의 자식들
   *
   * # Returns
   * JSON 형태 (뒤→앞 순서로 정렬):
   * ```json
   * {
   *   "level": "root",
   *   "order": ["bg", "robot", "fg"],  // 뒤→앞 순서
   *   "details": {
   *     "robot": { "type": "Group", "children": 3 }
   *   }
   * }
   * ```
   *
   * LLM은 순서만 확인하고, bringToFront/sendToBack/moveAbove 등으로 조작
   */
  get_draw_order(group_name: string): string;
  /**
   * 이름으로 Entity를 조회하여 전체 JSON을 반환합니다.
   *
   * # Arguments
   * * `name` - Entity 이름
   *
   * # Returns
   * * Some(JSON) - Entity가 존재하면 전체 JSON 반환
   * * None - Entity가 없으면 None
   *
   * # Examples
   * ```ignore
   * if let Some(json) = scene.get_entity("head") {
   *     // {"id":"...","entity_type":"Circle",...}
   * }
   * ```
   */
  get_entity(name: string): string | undefined;
  /**
   * Entity의 상세 정보를 local/world 좌표 포함하여 반환합니다 (FR42).
   *
   * # Arguments
   * * `name` - Entity 이름
   *
   * # Returns
   * * Some(JSON) - local/world 좌표 포함 상세 정보
   * * None - Entity가 없으면 None
   *
   * # JSON Format
   * ```json
   * {
   *   "name": "house1_wall",
   *   "type": "Rect",
   *   "parent": "house1",
   *   "local": {
   *     "geometry": {...},
   *     "transform": {...},
   *     "bounds": {"min": [x, y], "max": [x, y]}
   *   },
   *   "world": {
   *     "bounds": {"min_x": ..., "min_y": ..., "max_x": ..., "max_y": ...},
   *     "center": [x, y]
   *   }
   * }
   * ```
   */
  get_entity_detailed(name: string): string | undefined;
  /**
   * Scene의 전체 정보를 반환합니다.
   *
   * # Returns
   * JSON 객체: {"name": "scene-name", "entity_count": 5, "bounds": {"min": [x,y], "max": [x,y]}}
   * bounds가 null이면 Scene이 비어있음
   *
   * # Examples
   * ```ignore
   * let info = scene.get_scene_info();
   * // {"name":"my-scene","entity_count":2,"bounds":{"min":[0,0],"max":[100,100]}}
   * ```
   */
  get_scene_info(): string;
  /**
   * Entity의 월드 변환 행렬을 반환합니다.
   *
   * # Arguments
   * * `name` - Entity 이름
   *
   * # Returns
   * * Some(JSON) - 3x3 행렬 JSON: [[a, b, tx], [c, d, ty], [0, 0, 1]]
   * * None - Entity가 없으면 None
   *
   * # 변환 상속
   * 부모 그룹의 변환이 자식에게 상속됩니다.
   * 반환되는 행렬은 모든 조상의 변환이 결합된 최종 월드 변환입니다.
   */
  get_world_transform(name: string): string | undefined;
  /**
   * 로컬 좌표를 월드 좌표로 변환합니다.
   *
   * # Arguments
   * * `name` - Entity 이름 (이 엔티티의 좌표계 기준)
   * * `x` - 로컬 x 좌표
   * * `y` - 로컬 y 좌표
   *
   * # Returns
   * * Some(JSON) - 월드 좌표: {"x": ..., "y": ...}
   * * None - Entity가 없으면 None
   */
  get_world_point(name: string, x: number, y: number): string | undefined;
  /**
   * Entity의 월드 좌표 바운딩 박스를 반환합니다.
   *
   * # Arguments
   * * `name` - Entity 이름
   *
   * # Returns
   * * Some(JSON) - {"min": [x, y], "max": [x, y]}
   * * None - Entity가 없거나 빈 그룹이면 None
   *
   * # Notes
   * 변환(translate, rotate, scale)이 적용된 최종 월드 좌표 바운드입니다.
   * 그룹의 경우 모든 자식의 바운드를 포함합니다.
   */
  get_world_bounds(name: string): string | undefined;
  /**
   * Entity가 존재하는지 확인합니다.
   *
   * # Arguments
   * * `name` - Entity 이름
   *
   * # Returns
   * * true - Entity 존재
   * * false - Entity 없음
   */
  exists(name: string): boolean;
}

/**
 * 테스트용 인사 함수
 *
 * # Arguments
 * * `name` - 인사할 대상 이름
 *
 * # Returns
 * "Hello, {name}!" 형태의 문자열
 */
export function greet(name: string): string;

/**
 * WASM 모듈 초기화 함수
 * Node.js에서 모듈 로드 시 자동 실행
 * - dev feature 활성화 시 패닉 훅 설정 (디버깅 개선)
 */
export function init(): void;
