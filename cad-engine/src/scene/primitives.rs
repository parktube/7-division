//! 기본 도형 생성 모듈
//!
//! Epic 1에서 구현된 기본 도형들:
//! - Line: 선분/폴리라인
//! - Circle: 원
//! - Rect: 사각형
//! - Arc: 호
//! - Polygon: 다각형
//! - Bezier: 베지어 커브

use js_sys::Float64Array;
use wasm_bindgen::prelude::*;

use super::entity::{Entity, EntityType, Geometry, Metadata, Style, Transform};
use super::{Scene, SceneError, generate_id};
use crate::primitives::parse_line_points;

impl Scene {
    /// 내부용 Line 생성 함수 (테스트용)
    /// Vec<f64> 좌표를 받아 Line Entity 생성
    pub(crate) fn add_line_internal(
        &mut self,
        name: &str,
        coords: Vec<f64>,
    ) -> Result<String, SceneError> {
        let point_pairs = parse_line_points(coords).map_err(|msg| {
            SceneError::InvalidInput(format!("[add_line] invalid_input: {}", msg))
        })?;

        self.add_entity_internal(
            "add_line",
            name,
            EntityType::Line,
            Geometry::Line {
                points: point_pairs,
            },
        )
    }

    /// 내부용 Circle 생성 함수 (테스트용)
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "head", "joint_elbow") - Scene 내 unique
    /// * `x` - 중심점 x 좌표
    /// * `y` - 중심점 y 좌표
    /// * `radius` - 반지름 (음수/0 → abs().max(0.001)로 보정)
    ///
    /// # Errors
    /// * NaN/Infinity 입력 시 에러 반환
    pub(crate) fn add_circle_internal(
        &mut self,
        name: &str,
        x: f64,
        y: f64,
        radius: f64,
    ) -> Result<String, SceneError> {
        // NaN/Infinity 검증 (유효하지 않은 geometry 방지)
        if !x.is_finite() || !y.is_finite() || !radius.is_finite() {
            return Err(SceneError::InvalidInput(
                "[add_circle] invalid_input: NaN or Infinity not allowed".to_string(),
            ));
        }

        // 관대한 입력 보정: 음수/0 반지름은 abs().max(0.001)로 변환 (AC2)
        let radius = if radius <= 0.0 {
            radius.abs().max(0.001)
        } else {
            radius
        };

        self.add_entity_internal(
            "add_circle",
            name,
            EntityType::Circle,
            Geometry::Circle {
                center: [x, y],
                radius,
            },
        )
    }

    /// 내부용 Rect 생성 함수 (테스트용)
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "torso", "background") - Scene 내 unique
    /// * `x` - 중심점 x 좌표
    /// * `y` - 중심점 y 좌표
    /// * `width` - 너비 (음수/0 → abs().max(0.001)로 보정)
    /// * `height` - 높이 (음수/0 → abs().max(0.001)로 보정)
    ///
    /// # Errors
    /// * NaN/Infinity 입력 시 에러 반환
    pub(crate) fn add_rect_internal(
        &mut self,
        name: &str,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    ) -> Result<String, SceneError> {
        // NaN/Infinity 검증 (유효하지 않은 geometry 방지)
        if !x.is_finite() || !y.is_finite() || !width.is_finite() || !height.is_finite() {
            return Err(SceneError::InvalidInput(
                "[add_rect] invalid_input: NaN or Infinity not allowed".to_string(),
            ));
        }

        // 관대한 입력 보정: 음수/0은 abs().max(0.001)로 변환 (AC2)
        let width = if width <= 0.0 {
            width.abs().max(0.001)
        } else {
            width
        };
        let height = if height <= 0.0 {
            height.abs().max(0.001)
        } else {
            height
        };

        self.add_entity_internal(
            "add_rect",
            name,
            EntityType::Rect,
            Geometry::Rect {
                center: [x, y],
                width,
                height,
            },
        )
    }

    /// 내부용 Arc 생성 함수 (테스트용)
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "shoulder_arc") - Scene 내 unique
    /// * `cx` - 중심점 x 좌표
    /// * `cy` - 중심점 y 좌표
    /// * `radius` - 반지름 (음수/0 → abs().max(0.001)로 보정)
    /// * `start_angle` - 시작 각도 (라디안, 0 = 3시 방향)
    /// * `end_angle` - 끝 각도 (라디안, 양수 = CCW)
    ///
    /// # Errors
    /// * NaN/Infinity 입력 시 에러 반환
    pub(crate) fn add_arc_internal(
        &mut self,
        name: &str,
        cx: f64,
        cy: f64,
        radius: f64,
        start_angle: f64,
        end_angle: f64,
    ) -> Result<String, SceneError> {
        // NaN/Infinity 검증 (유효하지 않은 geometry 방지)
        if !cx.is_finite()
            || !cy.is_finite()
            || !radius.is_finite()
            || !start_angle.is_finite()
            || !end_angle.is_finite()
        {
            return Err(SceneError::InvalidInput(
                "[add_arc] invalid_input: NaN or Infinity not allowed".to_string(),
            ));
        }

        // 관대한 입력 보정: 음수/0 반지름은 abs().max(0.001)로 변환
        let radius = if radius <= 0.0 {
            radius.abs().max(0.001)
        } else {
            radius
        };

        self.add_entity_internal(
            "add_arc",
            name,
            EntityType::Arc,
            Geometry::Arc {
                center: [cx, cy],
                radius,
                start_angle,
                end_angle,
            },
        )
    }
}

// ========================================
// WASM Bindings for Primitives
// ========================================

#[wasm_bindgen]
impl Scene {
    /// 선분(Line) 도형을 생성합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "spine", "left_arm") - Scene 내 unique
    /// * `points` - [x1, y1, x2, y2, ...] 형태의 Float64Array
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 name 반환
    /// * Err - name 중복 또는 잘못된 입력
    ///
    /// # 입력 보정 (AC3)
    /// 홀수 개 좌표가 주어지면 마지막 좌표를 무시하고 정상 처리
    pub fn add_line(&mut self, name: &str, points: Float64Array) -> Result<String, JsValue> {
        self.add_line_internal(name, points.to_vec())
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// 원(Circle) 도형을 생성합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "head", "joint_elbow") - Scene 내 unique
    /// * `x` - 중심점 x 좌표
    /// * `y` - 중심점 y 좌표
    /// * `radius` - 반지름 (음수/0 → abs().max(0.001)로 보정)
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 name 반환
    ///
    /// # Errors
    /// * name 중복 시 에러
    /// * x, y, radius 중 NaN 또는 Infinity 입력 시 에러
    ///
    /// # 입력 보정 (AC2)
    /// 음수/0 반지름은 abs().max(0.001)로 양수 변환
    pub fn add_circle(
        &mut self,
        name: &str,
        x: f64,
        y: f64,
        radius: f64,
    ) -> Result<String, JsValue> {
        self.add_circle_internal(name, x, y, radius)
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// 사각형(Rect) 도형을 생성합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "torso", "background") - Scene 내 unique
    /// * `x` - 중심 x 좌표 (사각형의 중심점)
    /// * `y` - 중심 y 좌표 (사각형의 중심점)
    /// * `width` - 너비 (음수/0 → abs().max(0.001)로 보정)
    /// * `height` - 높이 (음수/0 → abs().max(0.001)로 보정)
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 name 반환
    ///
    /// # Errors
    /// * name 중복 시 에러
    /// * x, y, width, height 중 NaN 또는 Infinity 입력 시 에러
    ///
    /// # 입력 보정 (AC2)
    /// 음수/0 크기는 abs().max(0.001)로 양수 변환
    pub fn add_rect(
        &mut self,
        name: &str,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    ) -> Result<String, JsValue> {
        self.add_rect_internal(name, x, y, width, height)
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// 호(Arc) 도형을 생성합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "shoulder_arc") - Scene 내 unique
    /// * `cx` - 중심점 x 좌표
    /// * `cy` - 중심점 y 좌표
    /// * `radius` - 반지름 (음수/0 → abs().max(0.001)로 보정)
    /// * `start_angle` - 시작 각도 (라디안, 0 = 3시 방향)
    /// * `end_angle` - 끝 각도 (라디안, 양수 = CCW)
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 name 반환
    ///
    /// # Errors
    /// * name 중복 시 에러
    /// * NaN 또는 Infinity 입력 시 에러
    ///
    /// # 입력 보정
    /// 음수/0 반지름은 abs().max(0.001)로 양수 변환
    pub fn add_arc(
        &mut self,
        name: &str,
        cx: f64,
        cy: f64,
        radius: f64,
        start_angle: f64,
        end_angle: f64,
    ) -> Result<String, JsValue> {
        self.add_arc_internal(name, cx, cy, radius, start_angle, end_angle)
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// 스타일이 적용된 호(Arc)를 생성합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "shoulder_arc") - Scene 내 unique
    /// * `cx` - 중심점 x 좌표
    /// * `cy` - 중심점 y 좌표
    /// * `radius` - 반지름 (음수/0 → abs().max(0.001)로 보정)
    /// * `start_angle` - 시작 각도 (라디안, 0 = 3시 방향)
    /// * `end_angle` - 끝 각도 (라디안, 양수 = CCW)
    /// * `style_json` - 스타일 JSON (파싱 실패 시 기본 스타일 사용)
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 name 반환
    ///
    /// # Errors
    /// * name 중복 시 에러
    /// * NaN 또는 Infinity 입력 시 에러
    #[allow(clippy::too_many_arguments)]
    pub fn draw_arc(
        &mut self,
        name: &str,
        cx: f64,
        cy: f64,
        radius: f64,
        start_angle: f64,
        end_angle: f64,
        style_json: &str,
    ) -> Result<String, JsValue> {
        // name 중복 체크
        if self.has_entity(name) {
            return Err(JsValue::from_str(&format!(
                "[draw_arc] duplicate_name: Entity '{}' already exists",
                name
            )));
        }

        // NaN/Infinity 검증
        if !cx.is_finite()
            || !cy.is_finite()
            || !radius.is_finite()
            || !start_angle.is_finite()
            || !end_angle.is_finite()
        {
            return Err(JsValue::from_str(
                "[draw_arc] invalid_input: NaN or Infinity not allowed",
            ));
        }

        // 관대한 입력 보정: 음수/0 반지름은 abs().max(0.001)로 변환
        let radius = if radius <= 0.0 {
            radius.abs().max(0.001)
        } else {
            radius
        };

        // 스타일 파싱 (실패 시 기본 스타일)
        let style = serde_json::from_str::<Style>(style_json).unwrap_or_else(|_| Style::default());

        // Arc center is the natural pivot point
        let pivot = [cx, cy];

        // Auto-increment z_order
        let z_order = self.allocate_z_order();

        let entity = Entity {
            id: generate_id(),
            entity_type: EntityType::Arc,
            geometry: Geometry::Arc {
                center: [cx, cy],
                radius,
                start_angle,
                end_angle,
            },
            transform: Transform {
                pivot,
                ..Transform::default()
            },
            style,
            metadata: Metadata {
                name: name.to_string(),
                z_index: z_order,
                ..Default::default()
            },
            parent_id: None,
            children: Vec::new(),
        };

        self.entities.push(entity);
        self.last_operation = Some(format!("draw_arc({})", name));
        Ok(name.to_string())
    }

    /// 스타일이 적용된 원(Circle)을 생성합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "head") - Scene 내 unique
    /// * `x` - 중심점 x 좌표
    /// * `y` - 중심점 y 좌표
    /// * `radius` - 반지름 (음수/0 → abs().max(0.001)로 보정)
    /// * `style_json` - 스타일 JSON (파싱 실패 시 기본 스타일 사용)
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 name 반환
    ///
    /// # Errors
    /// * name 중복 시 에러
    /// * NaN 또는 Infinity 입력 시 에러
    pub fn draw_circle(
        &mut self,
        name: &str,
        x: f64,
        y: f64,
        radius: f64,
        style_json: &str,
    ) -> Result<String, JsValue> {
        // name 중복 체크
        if self.has_entity(name) {
            return Err(JsValue::from_str(&format!(
                "[draw_circle] duplicate_name: Entity '{}' already exists",
                name
            )));
        }

        // NaN/Infinity 검증
        if !x.is_finite() || !y.is_finite() || !radius.is_finite() {
            return Err(JsValue::from_str(
                "[draw_circle] invalid_input: NaN or Infinity not allowed",
            ));
        }

        // 관대한 입력 보정
        let radius = if radius <= 0.0 {
            radius.abs().max(0.001)
        } else {
            radius
        };

        // 스타일 파싱 (실패 시 기본 스타일)
        let style = serde_json::from_str::<Style>(style_json).unwrap_or_else(|_| Style::default());

        // Circle center is the natural pivot point
        let pivot = [x, y];

        // Auto-increment z_order
        let z_order = self.allocate_z_order();

        let entity = Entity {
            id: generate_id(),
            entity_type: EntityType::Circle,
            geometry: Geometry::Circle {
                center: [x, y],
                radius,
            },
            transform: Transform {
                pivot,
                ..Transform::default()
            },
            style,
            metadata: Metadata {
                name: name.to_string(),
                z_index: z_order,
                ..Default::default()
            },
            parent_id: None,
            children: Vec::new(),
        };

        self.entities.push(entity);
        self.last_operation = Some(format!("draw_circle({})", name));
        Ok(name.to_string())
    }

    /// 스타일이 적용된 선분(Line)을 생성합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "spine") - Scene 내 unique
    /// * `points` - [x1, y1, x2, y2, ...] 형태의 Float64Array
    /// * `style_json` - 스타일 JSON (파싱 실패 시 기본 스타일 사용)
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 name 반환
    ///
    /// # Errors
    /// * name 중복 시 에러
    /// * 좌표에 NaN/Infinity 포함 시 에러
    /// * 최소 2점 미만 시 에러
    pub fn draw_line(
        &mut self,
        name: &str,
        points: Float64Array,
        style_json: &str,
    ) -> Result<String, JsValue> {
        // name 중복 체크
        if self.has_entity(name) {
            return Err(JsValue::from_str(&format!(
                "[draw_line] duplicate_name: Entity '{}' already exists",
                name
            )));
        }

        // 좌표 파싱
        let point_pairs = parse_line_points(points.to_vec())
            .map_err(|msg| JsValue::from_str(&format!("[draw_line] invalid_input: {}", msg)))?;

        // 스타일 파싱 (실패 시 기본 스타일)
        let style = serde_json::from_str::<Style>(style_json).unwrap_or_else(|_| Style::default());

        // Calculate geometry center for default pivot
        let geometry = Geometry::Line {
            points: point_pairs,
        };
        let (min, max) = Self::geometry_bounds(&geometry);
        let pivot = [(min[0] + max[0]) / 2.0, (min[1] + max[1]) / 2.0];

        // Auto-increment z_order
        let z_order = self.allocate_z_order();

        let entity = Entity {
            id: generate_id(),
            entity_type: EntityType::Line,
            geometry,
            transform: Transform {
                pivot,
                ..Transform::default()
            },
            style,
            metadata: Metadata {
                name: name.to_string(),
                z_index: z_order,
                ..Default::default()
            },
            parent_id: None,
            children: Vec::new(),
        };

        self.entities.push(entity);
        self.last_operation = Some(format!("draw_line({})", name));
        Ok(name.to_string())
    }

    /// 닫힌 다각형(Polygon)을 생성합니다. fill 지원.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "mountain") - Scene 내 unique
    /// * `points` - Float64Array [x1, y1, x2, y2, ...] (최소 3점, 6개 값)
    /// * `style_json` - 스타일 JSON (파싱 실패 시 기본 스타일 사용)
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 name 반환
    ///
    /// # Errors
    /// * name 중복 시 에러
    /// * 3점 미만 시 에러
    pub fn draw_polygon(
        &mut self,
        name: &str,
        points: Float64Array,
        style_json: &str,
    ) -> Result<String, JsValue> {
        // name 중복 체크
        if self.has_entity(name) {
            return Err(JsValue::from_str(&format!(
                "[draw_polygon] duplicate_name: Entity '{}' already exists",
                name
            )));
        }

        // 좌표 파싱
        let point_pairs = parse_line_points(points.to_vec())
            .map_err(|msg| JsValue::from_str(&format!("[draw_polygon] invalid_input: {}", msg)))?;

        // 최소 3점 필요
        if point_pairs.len() < 3 {
            return Err(JsValue::from_str(
                "[draw_polygon] invalid_input: Polygon requires at least 3 points",
            ));
        }

        // 스타일 파싱 (실패 시 기본 스타일)
        let style = serde_json::from_str::<Style>(style_json).unwrap_or_else(|_| Style::default());

        // Calculate geometry center for default pivot
        let geometry = Geometry::Polygon {
            points: point_pairs,
        };
        let (min, max) = Self::geometry_bounds(&geometry);
        let pivot = [(min[0] + max[0]) / 2.0, (min[1] + max[1]) / 2.0];

        // Auto-increment z_order
        let z_order = self.allocate_z_order();

        let entity = Entity {
            id: generate_id(),
            entity_type: EntityType::Polygon,
            geometry,
            transform: Transform {
                pivot,
                ..Transform::default()
            },
            style,
            metadata: Metadata {
                name: name.to_string(),
                z_index: z_order,
                ..Default::default()
            },
            parent_id: None,
            children: Vec::new(),
        };

        self.entities.push(entity);
        self.last_operation = Some(format!("draw_polygon({})", name));
        Ok(name.to_string())
    }

    /// SVG path 문자열로 베지어 커브를 생성합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "curve1") - Scene 내 unique
    /// * `path` - SVG path 문자열
    ///   - `M x,y` : 시작점 (Move to)
    ///   - `C cp1x,cp1y cp2x,cp2y x,y` : 큐빅 베지어
    ///   - `S cp2x,cp2y x,y` : 부드러운 연결 (cp1 자동 반영)
    ///   - `Q cpx,cpy x,y` : 쿼드라틱 (큐빅으로 변환)
    ///   - `L x,y` : 직선 (베지어로 변환)
    ///   - `Z` : 경로 닫기
    /// * `style_json` - 스타일 JSON
    ///
    /// # Examples
    /// ```javascript
    /// // 단순 큐빅 베지어
    /// drawBezier('wave', 'M 0,0 C 30,50 70,50 100,0')
    ///
    /// // 부드러운 S 커브 (S 명령어로 자동 연결)
    /// drawBezier('s_curve', 'M 0,0 C 30,50 70,50 100,0 S 170,-50 200,0')
    ///
    /// // 닫힌 형태
    /// drawBezier('blob', 'M 0,0 C 50,80 80,80 100,0 S 50,-80 0,0 Z')
    /// ```
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 name 반환
    ///
    /// # Errors
    /// * name 중복 시 에러
    /// * 잘못된 SVG path 문법
    pub fn draw_bezier(
        &mut self,
        name: &str,
        path: &str,
        style_json: &str,
    ) -> Result<String, JsValue> {
        // name 중복 체크
        if self.has_entity(name) {
            return Err(JsValue::from_str(&format!(
                "[draw_bezier] duplicate_name: Entity '{}' already exists",
                name
            )));
        }

        // Parse SVG path
        let parsed = super::path_parser::parse_svg_path(path)
            .map_err(|e| JsValue::from_str(&format!("[draw_bezier] invalid_path: {}", e)))?;

        // 스타일 파싱
        let style = serde_json::from_str::<Style>(style_json).unwrap_or_else(|_| Style::default());

        // Calculate geometry center for default pivot
        let geometry = Geometry::Bezier {
            start: parsed.start,
            segments: parsed.segments,
            closed: parsed.closed,
        };
        let (min, max) = Self::geometry_bounds(&geometry);
        let pivot = [(min[0] + max[0]) / 2.0, (min[1] + max[1]) / 2.0];

        // Auto-increment z_order
        let z_order = self.allocate_z_order();

        let entity = Entity {
            id: generate_id(),
            entity_type: EntityType::Bezier,
            geometry,
            transform: Transform {
                pivot,
                ..Transform::default()
            },
            style,
            metadata: Metadata {
                name: name.to_string(),
                z_index: z_order,
                ..Default::default()
            },
            parent_id: None,
            children: Vec::new(),
        };

        self.entities.push(entity);
        self.last_operation = Some(format!("draw_bezier({})", name));
        Ok(name.to_string())
    }

    /// 스타일이 적용된 사각형(Rect)을 생성합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "torso") - Scene 내 unique
    /// * `x` - 중심 x 좌표
    /// * `y` - 중심 y 좌표
    /// * `width` - 너비 (음수/0 → abs().max(0.001)로 보정)
    /// * `height` - 높이 (음수/0 → abs().max(0.001)로 보정)
    /// * `style_json` - 스타일 JSON (파싱 실패 시 기본 스타일 사용)
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 name 반환
    ///
    /// # Errors
    /// * name 중복 시 에러
    /// * NaN 또는 Infinity 입력 시 에러
    pub fn draw_rect(
        &mut self,
        name: &str,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        style_json: &str,
    ) -> Result<String, JsValue> {
        // name 중복 체크
        if self.has_entity(name) {
            return Err(JsValue::from_str(&format!(
                "[draw_rect] duplicate_name: Entity '{}' already exists",
                name
            )));
        }

        // NaN/Infinity 검증
        if !x.is_finite() || !y.is_finite() || !width.is_finite() || !height.is_finite() {
            return Err(JsValue::from_str(
                "[draw_rect] invalid_input: NaN or Infinity not allowed",
            ));
        }

        // 관대한 입력 보정
        let width = if width <= 0.0 {
            width.abs().max(0.001)
        } else {
            width
        };
        let height = if height <= 0.0 {
            height.abs().max(0.001)
        } else {
            height
        };

        // 스타일 파싱 (실패 시 기본 스타일)
        let style = serde_json::from_str::<Style>(style_json).unwrap_or_else(|_| Style::default());

        // x, y는 중심 좌표, pivot도 동일
        let center = [x, y];
        let pivot = center;

        let geometry = Geometry::Rect {
            center,
            width,
            height,
        };

        // Auto-increment z_order
        let z_order = self.allocate_z_order();

        let entity = Entity {
            id: generate_id(),
            entity_type: EntityType::Rect,
            geometry,
            transform: Transform {
                pivot,
                ..Transform::default()
            },
            style,
            metadata: Metadata {
                name: name.to_string(),
                z_index: z_order,
                ..Default::default()
            },
            parent_id: None,
            children: Vec::new(),
        };

        self.entities.push(entity);
        self.last_operation = Some(format!("draw_rect({})", name));
        Ok(name.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ========================================
    // add_line 테스트
    // ========================================

    #[test]
    fn test_add_line_two_points() {
        let mut scene = Scene::new("test");
        let result = scene.add_line_internal("spine", vec![0.0, 0.0, 0.0, 100.0]);

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "spine");

        let entity = scene.find_by_name("spine").unwrap();
        if let Geometry::Line { points } = &entity.geometry {
            assert_eq!(points.len(), 2);
            assert_eq!(points[0], [0.0, 0.0]);
            assert_eq!(points[1], [0.0, 100.0]);
        } else {
            panic!("Expected Line geometry");
        }
    }

    #[test]
    fn test_add_line_polyline_3_points() {
        let mut scene = Scene::new("test");
        let result = scene.add_line_internal("polyline", vec![0.0, 0.0, 50.0, 50.0, 100.0, 0.0]);

        assert!(result.is_ok());

        let entity = scene.find_by_name("polyline").unwrap();
        if let Geometry::Line { points } = &entity.geometry {
            assert_eq!(points.len(), 3);
        } else {
            panic!("Expected Line geometry");
        }
    }

    #[test]
    fn test_add_line_polyline_4_points() {
        let mut scene = Scene::new("test");
        let result = scene.add_line_internal(
            "polyline4",
            vec![0.0, 0.0, 25.0, 25.0, 50.0, 0.0, 75.0, 25.0],
        );

        assert!(result.is_ok());

        let entity = scene.find_by_name("polyline4").unwrap();
        if let Geometry::Line { points } = &entity.geometry {
            assert_eq!(points.len(), 4);
        } else {
            panic!("Expected Line geometry");
        }
    }

    #[test]
    fn test_add_line_odd_coordinates_drops_last() {
        let mut scene = Scene::new("test");
        // 5개 좌표 → 마지막 하나 무시하고 2점 직선
        let result = scene.add_line_internal("odd", vec![0.0, 0.0, 100.0, 100.0, 50.0]);

        assert!(result.is_ok());

        let entity = scene.find_by_name("odd").unwrap();
        if let Geometry::Line { points } = &entity.geometry {
            assert_eq!(points.len(), 2);
        } else {
            panic!("Expected Line geometry");
        }
    }

    #[test]
    fn test_add_line_too_few_points_error() {
        let mut scene = Scene::new("test");
        // 3개 좌표 = 1.5개 점 → 1개 점 = 에러
        let result = scene.add_line_internal("invalid", vec![0.0, 0.0, 100.0]);

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("At least 2 points"));
    }

    #[test]
    fn test_add_line_duplicate_name_error() {
        let mut scene = Scene::new("test");
        scene
            .add_line_internal("spine", vec![0.0, 0.0, 0.0, 100.0])
            .unwrap();

        let result = scene.add_line_internal("spine", vec![0.0, 0.0, 100.0, 100.0]);

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("duplicate_name"));
    }

    #[test]
    fn test_add_line_nan_error() {
        let mut scene = Scene::new("test");
        let result = scene.add_line_internal("invalid", vec![0.0, 0.0, f64::NAN, 100.0]);

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("NaN"));
    }

    #[test]
    fn test_add_line_infinity_error() {
        let mut scene = Scene::new("test");
        let result = scene.add_line_internal("invalid", vec![0.0, 0.0, f64::INFINITY, 100.0]);

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("Infinity"));
    }

    // ========================================
    // add_circle 테스트
    // ========================================

    #[test]
    fn test_add_circle_basic() {
        let mut scene = Scene::new("test");
        let result = scene.add_circle_internal("head", 0.0, 100.0, 25.0);

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "head");

        let entity = scene.find_by_name("head").unwrap();
        if let Geometry::Circle { center, radius } = &entity.geometry {
            assert_eq!(*center, [0.0, 100.0]);
            assert_eq!(*radius, 25.0);
        } else {
            panic!("Expected Circle geometry");
        }
    }

    #[test]
    fn test_add_circle_negative_radius_corrected() {
        let mut scene = Scene::new("test");
        let result = scene.add_circle_internal("neg_radius", 0.0, 0.0, -10.0);

        assert!(result.is_ok());

        let entity = scene.find_by_name("neg_radius").unwrap();
        if let Geometry::Circle { radius, .. } = &entity.geometry {
            assert_eq!(*radius, 10.0); // abs()로 변환
        } else {
            panic!("Expected Circle geometry");
        }
    }

    #[test]
    fn test_add_circle_zero_radius_corrected() {
        let mut scene = Scene::new("test");
        let result = scene.add_circle_internal("zero_radius", 0.0, 0.0, 0.0);

        assert!(result.is_ok());

        let entity = scene.find_by_name("zero_radius").unwrap();
        if let Geometry::Circle { radius, .. } = &entity.geometry {
            assert_eq!(*radius, 0.001); // 최소값 0.001로 보정
        } else {
            panic!("Expected Circle geometry");
        }
    }

    #[test]
    fn test_add_circle_tiny_negative_radius_clamped() {
        let mut scene = Scene::new("test");
        let result = scene.add_circle_internal("tiny_neg", 0.0, 0.0, -0.0001);

        assert!(result.is_ok());

        let entity = scene.find_by_name("tiny_neg").unwrap();
        if let Geometry::Circle { radius, .. } = &entity.geometry {
            // abs(-0.0001) = 0.0001 < 0.001 → 0.001로 클램핑
            assert_eq!(*radius, 0.001);
        } else {
            panic!("Expected Circle geometry");
        }
    }

    #[test]
    fn test_add_circle_negative_coordinates() {
        let mut scene = Scene::new("test");
        let result = scene.add_circle_internal("neg_coords", -50.0, -30.0, 10.0);

        assert!(result.is_ok());

        let entity = scene.find_by_name("neg_coords").unwrap();
        if let Geometry::Circle { center, .. } = &entity.geometry {
            assert_eq!(*center, [-50.0, -30.0]); // 음수 좌표는 그대로 허용
        } else {
            panic!("Expected Circle geometry");
        }
    }

    #[test]
    fn test_add_circle_duplicate_name_error() {
        let mut scene = Scene::new("test");
        scene.add_circle_internal("head", 0.0, 0.0, 10.0).unwrap();

        let result = scene.add_circle_internal("head", 50.0, 50.0, 20.0);

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("duplicate_name"));
    }

    #[test]
    fn test_add_circle_nan_error() {
        let mut scene = Scene::new("test");

        // x가 NaN
        let result = scene.add_circle_internal("invalid", f64::NAN, 0.0, 10.0);
        assert!(result.is_err());

        // y가 NaN
        let result = scene.add_circle_internal("invalid2", 0.0, f64::NAN, 10.0);
        assert!(result.is_err());

        // radius가 NaN
        let result = scene.add_circle_internal("invalid3", 0.0, 0.0, f64::NAN);
        assert!(result.is_err());
    }

    #[test]
    fn test_add_circle_infinity_error() {
        let mut scene = Scene::new("test");

        // x가 Infinity
        let result = scene.add_circle_internal("invalid", f64::INFINITY, 0.0, 10.0);
        assert!(result.is_err());

        // y가 NEG_INFINITY
        let result = scene.add_circle_internal("invalid2", 0.0, f64::NEG_INFINITY, 10.0);
        assert!(result.is_err());

        // radius가 Infinity
        let result = scene.add_circle_internal("invalid3", 0.0, 0.0, f64::INFINITY);
        assert!(result.is_err());
    }

    // ========================================
    // add_rect 테스트
    // ========================================

    #[test]
    fn test_add_rect_basic() {
        let mut scene = Scene::new("test");
        let result = scene.add_rect_internal("torso", 0.0, 0.0, 50.0, 100.0);

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "torso");

        let entity = scene.find_by_name("torso").unwrap();
        if let Geometry::Rect {
            center,
            width,
            height,
        } = &entity.geometry
        {
            assert_eq!(*center, [0.0, 0.0]);
            assert_eq!(*width, 50.0);
            assert_eq!(*height, 100.0);
        } else {
            panic!("Expected Rect geometry");
        }
    }

    #[test]
    fn test_add_rect_negative_width_corrected() {
        let mut scene = Scene::new("test");
        let result = scene.add_rect_internal("neg_width", 0.0, 0.0, -50.0, 100.0);

        assert!(result.is_ok());

        let entity = scene.find_by_name("neg_width").unwrap();
        if let Geometry::Rect { width, .. } = &entity.geometry {
            assert_eq!(*width, 50.0); // abs()로 변환
        } else {
            panic!("Expected Rect geometry");
        }
    }

    #[test]
    fn test_add_rect_negative_height_corrected() {
        let mut scene = Scene::new("test");
        let result = scene.add_rect_internal("neg_height", 0.0, 0.0, 50.0, -100.0);

        assert!(result.is_ok());

        let entity = scene.find_by_name("neg_height").unwrap();
        if let Geometry::Rect { height, .. } = &entity.geometry {
            assert_eq!(*height, 100.0); // abs()로 변환
        } else {
            panic!("Expected Rect geometry");
        }
    }

    #[test]
    fn test_add_rect_zero_size_corrected() {
        let mut scene = Scene::new("test");
        let result = scene.add_rect_internal("zero_size", 0.0, 0.0, 0.0, 0.0);

        assert!(result.is_ok());

        let entity = scene.find_by_name("zero_size").unwrap();
        if let Geometry::Rect { width, height, .. } = &entity.geometry {
            assert_eq!(*width, 0.001);
            assert_eq!(*height, 0.001);
        } else {
            panic!("Expected Rect geometry");
        }
    }

    #[test]
    fn test_add_rect_tiny_negative_size_clamped() {
        let mut scene = Scene::new("test");
        let result = scene.add_rect_internal("tiny", 0.0, 0.0, -0.0001, -0.0001);

        assert!(result.is_ok());

        let entity = scene.find_by_name("tiny").unwrap();
        if let Geometry::Rect { width, height, .. } = &entity.geometry {
            assert_eq!(*width, 0.001);
            assert_eq!(*height, 0.001);
        } else {
            panic!("Expected Rect geometry");
        }
    }

    #[test]
    fn test_add_rect_negative_coordinates() {
        let mut scene = Scene::new("test");
        let result = scene.add_rect_internal("neg_coords", -100.0, -50.0, 50.0, 100.0);

        assert!(result.is_ok());

        let entity = scene.find_by_name("neg_coords").unwrap();
        if let Geometry::Rect { center, .. } = &entity.geometry {
            assert_eq!(*center, [-100.0, -50.0]); // 음수 좌표는 그대로 허용
        } else {
            panic!("Expected Rect geometry");
        }
    }

    #[test]
    fn test_add_rect_duplicate_name_error() {
        let mut scene = Scene::new("test");
        scene
            .add_rect_internal("torso", 0.0, 0.0, 50.0, 100.0)
            .unwrap();

        let result = scene.add_rect_internal("torso", 100.0, 100.0, 30.0, 40.0);

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("duplicate_name"));
    }

    #[test]
    fn test_add_rect_nan_error() {
        let mut scene = Scene::new("test");

        let result = scene.add_rect_internal("invalid_x", f64::NAN, 0.0, 50.0, 100.0);
        assert!(result.is_err());

        let result = scene.add_rect_internal("invalid_y", 0.0, f64::NAN, 50.0, 100.0);
        assert!(result.is_err());

        let result = scene.add_rect_internal("invalid_w", 0.0, 0.0, f64::NAN, 100.0);
        assert!(result.is_err());

        let result = scene.add_rect_internal("invalid_h", 0.0, 0.0, 50.0, f64::NAN);
        assert!(result.is_err());
    }

    #[test]
    fn test_add_rect_infinity_error() {
        let mut scene = Scene::new("test");

        let result = scene.add_rect_internal("inf_x", f64::INFINITY, 0.0, 50.0, 100.0);
        assert!(result.is_err());

        let result = scene.add_rect_internal("inf_y", 0.0, f64::NEG_INFINITY, 50.0, 100.0);
        assert!(result.is_err());

        let result = scene.add_rect_internal("inf_w", 0.0, 0.0, f64::INFINITY, 100.0);
        assert!(result.is_err());

        let result = scene.add_rect_internal("inf_h", 0.0, 0.0, 50.0, f64::NEG_INFINITY);
        assert!(result.is_err());
    }

    // ========================================
    // add_arc 테스트
    // ========================================

    #[test]
    fn test_add_arc_basic() {
        let mut scene = Scene::new("test");
        let result =
            scene.add_arc_internal("shoulder", 0.0, 0.0, 50.0, 0.0, std::f64::consts::FRAC_PI_2);

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "shoulder");

        let entity = scene.find_by_name("shoulder").unwrap();
        if let Geometry::Arc {
            center,
            radius,
            start_angle,
            end_angle,
        } = &entity.geometry
        {
            assert_eq!(*center, [0.0, 0.0]);
            assert_eq!(*radius, 50.0);
            assert_eq!(*start_angle, 0.0);
            assert!((end_angle - std::f64::consts::FRAC_PI_2).abs() < 1e-10);
        } else {
            panic!("Expected Arc geometry");
        }
    }

    #[test]
    fn test_add_arc_90_degrees() {
        let mut scene = Scene::new("test");
        // 90도 호 (0 → π/2)
        let result =
            scene.add_arc_internal("arc90", 0.0, 0.0, 30.0, 0.0, std::f64::consts::FRAC_PI_2);

        assert!(result.is_ok());
    }

    #[test]
    fn test_add_arc_half_circle() {
        let mut scene = Scene::new("test");
        // 반원 (0 → π)
        let result =
            scene.add_arc_internal("halfcircle", 0.0, 0.0, 40.0, 0.0, std::f64::consts::PI);

        assert!(result.is_ok());
    }

    #[test]
    fn test_add_arc_negative_radius_corrected() {
        let mut scene = Scene::new("test");
        let result = scene.add_arc_internal("neg_radius", 0.0, 0.0, -50.0, 0.0, 1.0);

        assert!(result.is_ok());

        let entity = scene.find_by_name("neg_radius").unwrap();
        if let Geometry::Arc { radius, .. } = &entity.geometry {
            assert_eq!(*radius, 50.0);
        } else {
            panic!("Expected Arc geometry");
        }
    }

    #[test]
    fn test_add_arc_zero_radius_corrected() {
        let mut scene = Scene::new("test");
        let result = scene.add_arc_internal("zero_radius", 0.0, 0.0, 0.0, 0.0, 1.0);

        assert!(result.is_ok());

        let entity = scene.find_by_name("zero_radius").unwrap();
        if let Geometry::Arc { radius, .. } = &entity.geometry {
            assert_eq!(*radius, 0.001);
        } else {
            panic!("Expected Arc geometry");
        }
    }

    #[test]
    fn test_add_arc_full_circle_plus() {
        let mut scene = Scene::new("test");
        // 2π 이상 → 전체 원 + α
        let result = scene.add_arc_internal("fullplus", 0.0, 0.0, 50.0, 0.0, 7.0);

        assert!(result.is_ok());

        let entity = scene.find_by_name("fullplus").unwrap();
        if let Geometry::Arc { end_angle, .. } = &entity.geometry {
            assert_eq!(*end_angle, 7.0); // 값 그대로 저장
        } else {
            panic!("Expected Arc geometry");
        }
    }

    #[test]
    fn test_add_arc_negative_angles() {
        let mut scene = Scene::new("test");
        // 음수 각도 허용
        let result = scene.add_arc_internal("neg_angles", 0.0, 0.0, 50.0, -1.0, -0.5);

        assert!(result.is_ok());

        let entity = scene.find_by_name("neg_angles").unwrap();
        if let Geometry::Arc {
            start_angle,
            end_angle,
            ..
        } = &entity.geometry
        {
            assert_eq!(*start_angle, -1.0);
            assert_eq!(*end_angle, -0.5);
        } else {
            panic!("Expected Arc geometry");
        }
    }

    #[test]
    fn test_add_arc_duplicate_name_error() {
        let mut scene = Scene::new("test");
        scene
            .add_arc_internal("arc1", 0.0, 0.0, 50.0, 0.0, 1.0)
            .unwrap();

        let result = scene.add_arc_internal("arc1", 10.0, 10.0, 30.0, 0.5, 1.5);

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("duplicate_name"));
    }

    #[test]
    fn test_add_arc_nan_error() {
        let mut scene = Scene::new("test");

        let result = scene.add_arc_internal("nan_cx", f64::NAN, 0.0, 50.0, 0.0, 1.0);
        assert!(result.is_err());

        let result = scene.add_arc_internal("nan_cy", 0.0, f64::NAN, 50.0, 0.0, 1.0);
        assert!(result.is_err());

        let result = scene.add_arc_internal("nan_r", 0.0, 0.0, f64::NAN, 0.0, 1.0);
        assert!(result.is_err());

        let result = scene.add_arc_internal("nan_start", 0.0, 0.0, 50.0, f64::NAN, 1.0);
        assert!(result.is_err());

        let result = scene.add_arc_internal("nan_end", 0.0, 0.0, 50.0, 0.0, f64::NAN);
        assert!(result.is_err());
    }

    #[test]
    fn test_add_arc_infinity_error() {
        let mut scene = Scene::new("test");

        scene
            .add_arc_internal("inf_cx", f64::INFINITY, 0.0, 50.0, 0.0, 1.0)
            .expect_err("INFINITY cx should error");

        scene
            .add_arc_internal("inf_cy", 0.0, f64::NEG_INFINITY, 50.0, 0.0, 1.0)
            .expect_err("NEG_INFINITY cy should error");

        scene
            .add_arc_internal("inf_r", 0.0, 0.0, f64::INFINITY, 0.0, 1.0)
            .expect_err("INFINITY radius should error");

        let err = scene
            .add_arc_internal("inf_start", 0.0, 0.0, 50.0, f64::INFINITY, 1.0)
            .expect_err("INFINITY start_angle should error");
        assert_eq!(
            err.to_string(),
            "[add_arc] invalid_input: NaN or Infinity not allowed"
        );

        let err = scene
            .add_arc_internal("inf_end", 0.0, 0.0, 50.0, 0.0, f64::NEG_INFINITY)
            .expect_err("NEG_INFINITY end_angle should error");
        assert_eq!(
            err.to_string(),
            "[add_arc] invalid_input: NaN or Infinity not allowed"
        );
    }
}
