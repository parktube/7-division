use js_sys::Float64Array;
use serde_json;
use std::fmt;
use uuid::Uuid;
use wasm_bindgen::prelude::*;

pub mod entity;
mod groups;
mod primitives;
pub mod style;

use crate::primitives::parse_line_points;
use crate::serializers::json::serialize_scene;
use crate::serializers::svg::serialize_scene_svg;
use entity::{Entity, EntityType, Geometry, Matrix3x3, Metadata, Style, Transform};
use style::{FillStyle, LineCap, LineJoin, StrokeStyle};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum SceneError {
    DuplicateEntityName(String, String), // (fn_name, entity_name)
    InvalidInput(String),
    NotAGroup(String, String), // (fn_name, entity_name)
}

impl fmt::Display for SceneError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SceneError::DuplicateEntityName(fn_name, name) => {
                write!(
                    f,
                    "[{}] duplicate_name: Entity '{}' already exists",
                    fn_name, name
                )
            }
            SceneError::InvalidInput(msg) => {
                write!(f, "{}", msg)
            }
            SceneError::NotAGroup(fn_name, name) => {
                write!(
                    f,
                    "[{}] not_a_group: Entity '{}' is not a Group",
                    fn_name, name
                )
            }
        }
    }
}

impl std::error::Error for SceneError {}

#[wasm_bindgen]
pub struct Scene {
    name: String,
    entities: Vec<Entity>,
    /// 마지막 실행된 작업 (LLM 작업 추적용)
    last_operation: Option<String>,
}

fn generate_id() -> String {
    Uuid::new_v4().to_string()
}

impl Scene {
    fn find_by_name(&self, name: &str) -> Option<&Entity> {
        self.entities
            .iter()
            .find(|entity| entity.metadata.name == name)
    }

    fn find_by_name_mut(&mut self, name: &str) -> Option<&mut Entity> {
        self.entities
            .iter_mut()
            .find(|entity| entity.metadata.name == name)
    }

    fn has_entity(&self, name: &str) -> bool {
        self.find_by_name(name).is_some()
    }

    fn add_entity_internal(
        &mut self,
        fn_name: &str,
        name: &str,
        entity_type: EntityType,
        geometry: Geometry,
    ) -> Result<String, SceneError> {
        if self.has_entity(name) {
            return Err(SceneError::DuplicateEntityName(
                fn_name.to_string(),
                name.to_string(),
            ));
        }

        let entity = Entity {
            id: generate_id(),
            entity_type,
            geometry,
            transform: Transform::default(),
            style: Style::default(),
            metadata: Metadata {
                name: name.to_string(),
                ..Default::default()
            },
            parent_id: None,
            children: Vec::new(),
        };

        self.entities.push(entity);
        Ok(name.to_string())
    }

    // Primitive creation helpers: add_line_internal, add_circle_internal, add_rect_internal, add_arc_internal
    // See primitives.rs for implementations

    /// Set pivot point for an entity (internal, for native testing)
    fn set_pivot_internal(&mut self, name: &str, px: f64, py: f64) -> Result<bool, SceneError> {
        // Validate finite values
        if !px.is_finite() || !py.is_finite() {
            return Err(SceneError::InvalidInput(
                "[set_pivot] invalid_input: Pivot coordinates must be finite numbers".to_string(),
            ));
        }

        let entity = match self.find_by_name_mut(name) {
            Some(e) => e,
            None => return Ok(false),
        };

        entity.transform.pivot = [px, py];
        self.last_operation = Some(format!("set_pivot({}, [{}, {}])", name, px, py));
        Ok(true)
    }
}

#[wasm_bindgen]
impl Scene {
    #[wasm_bindgen(constructor)]
    pub fn new(name: &str) -> Scene {
        Scene {
            name: name.to_string(),
            entities: Vec::new(),
            last_operation: None,
        }
    }

    pub fn get_name(&self) -> String {
        self.name.clone()
    }

    pub fn entity_count(&self) -> usize {
        self.entities.len()
    }

    /// Scene을 JSON으로 내보냅니다.
    pub fn export_json(&self) -> String {
        serialize_scene(&self.name, &self.entities, self.last_operation.as_deref())
    }

    /// Scene을 SVG로 내보냅니다.
    pub fn export_svg(&self) -> String {
        serialize_scene_svg(&self.entities)
    }

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
    /// * `x` - 원점 x 좌표 (Y-up 중심 좌표계)
    /// * `y` - 원점 y 좌표 (Y-up 중심 좌표계)
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
    /// * `name` - Entity 이름 - Scene 내 unique
    /// * `cx` - 중심점 x 좌표
    /// * `cy` - 중심점 y 좌표
    /// * `radius` - 반지름 (음수/0 → abs().max(0.001)로 보정)
    /// * `start_angle` - 시작 각도 (라디안)
    /// * `end_angle` - 끝 각도 (라디안)
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

        let entity = Entity {
            id: generate_id(),
            entity_type: EntityType::Arc,
            geometry: Geometry::Arc {
                center: [cx, cy],
                radius,
                start_angle,
                end_angle,
            },
            transform: Transform::default(),
            style,
            metadata: Metadata {
                name: name.to_string(),
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

        let entity = Entity {
            id: generate_id(),
            entity_type: EntityType::Circle,
            geometry: Geometry::Circle {
                center: [x, y],
                radius,
            },
            transform: Transform::default(),
            style,
            metadata: Metadata {
                name: name.to_string(),
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

        let entity = Entity {
            id: generate_id(),
            entity_type: EntityType::Line,
            geometry: Geometry::Line {
                points: point_pairs,
            },
            transform: Transform::default(),
            style,
            metadata: Metadata {
                name: name.to_string(),
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

        let entity = Entity {
            id: generate_id(),
            entity_type: EntityType::Polygon,
            geometry: Geometry::Polygon {
                points: point_pairs,
            },
            transform: Transform::default(),
            style,
            metadata: Metadata {
                name: name.to_string(),
                ..Default::default()
            },
            parent_id: None,
            children: Vec::new(),
        };

        self.entities.push(entity);
        self.last_operation = Some(format!("draw_polygon({})", name));
        Ok(name.to_string())
    }

    /// 스타일이 적용된 베지어 커브를 생성합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "curve1") - Scene 내 unique
    /// * `points` - 좌표 배열 [start_x, start_y, cp1_x, cp1_y, cp2_x, cp2_y, end_x, end_y, ...]
    ///              첫 8개는 첫 세그먼트 (시작점, 제어점1, 제어점2, 끝점)
    ///              이후 6개씩 추가 세그먼트 (제어점1, 제어점2, 끝점)
    /// * `closed` - true면 닫힌 경로 (fill 적용 가능)
    /// * `style_json` - 스타일 JSON
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 name 반환
    ///
    /// # Errors
    /// * name 중복 시 에러
    /// * 최소 8개 좌표 (4점) 필요
    #[wasm_bindgen]
    pub fn draw_bezier(
        &mut self,
        name: &str,
        points: Float64Array,
        closed: bool,
        style_json: &str,
    ) -> Result<String, JsValue> {
        // name 중복 체크
        if self.has_entity(name) {
            return Err(JsValue::from_str(&format!(
                "[draw_bezier] duplicate_name: Entity '{}' already exists",
                name
            )));
        }

        let coords = points.to_vec();

        // 최소 8개 좌표 필요 (시작점 + 제어점1 + 제어점2 + 끝점)
        if coords.len() < 8 {
            return Err(JsValue::from_str(
                "[draw_bezier] invalid_input: Bezier requires at least 8 values (4 points: start, cp1, cp2, end)",
            ));
        }

        // 첫 세그먼트 이후 좌표는 6개씩 (cp1, cp2, end)
        let remaining = coords.len() - 8;
        if remaining % 6 != 0 {
            return Err(JsValue::from_str(
                "[draw_bezier] invalid_input: After first 8 values, additional values must be in groups of 6 (cp1, cp2, end)",
            ));
        }

        // 시작점
        let start = [coords[0], coords[1]];

        // 세그먼트 파싱
        let mut segments: Vec<[[f64; 2]; 3]> = Vec::new();

        // 첫 세그먼트
        segments.push([
            [coords[2], coords[3]], // cp1
            [coords[4], coords[5]], // cp2
            [coords[6], coords[7]], // end
        ]);

        // 추가 세그먼트
        let mut i = 8;
        while i + 5 < coords.len() {
            segments.push([
                [coords[i], coords[i + 1]],     // cp1
                [coords[i + 2], coords[i + 3]], // cp2
                [coords[i + 4], coords[i + 5]], // end
            ]);
            i += 6;
        }

        // 스타일 파싱
        let style = serde_json::from_str::<Style>(style_json).unwrap_or_else(|_| Style::default());

        let entity = Entity {
            id: generate_id(),
            entity_type: EntityType::Bezier,
            geometry: Geometry::Bezier {
                start,
                segments,
                closed,
            },
            transform: Transform::default(),
            style,
            metadata: Metadata {
                name: name.to_string(),
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
    /// * `x` - 원점 x 좌표
    /// * `y` - 원점 y 좌표
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

        let entity = Entity {
            id: generate_id(),
            entity_type: EntityType::Rect,
            geometry: Geometry::Rect {
                origin: [x, y],
                width,
                height,
            },
            transform: Transform::default(),
            style,
            metadata: Metadata {
                name: name.to_string(),
                ..Default::default()
            },
            parent_id: None,
            children: Vec::new(),
        };

        self.entities.push(entity);
        self.last_operation = Some(format!("draw_rect({})", name));
        Ok(name.to_string())
    }

    /// 기존 도형의 stroke 스타일을 변경합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "head", "left_arm")
    /// * `stroke_json` - StrokeStyle JSON (부분 업데이트 지원)
    ///
    /// # Returns
    /// * Ok(true) - 성공
    /// * Ok(false) - name 미발견
    ///
    /// # Partial Update (AC6)
    /// 기존 stroke가 있는 경우, JSON에 명시된 필드만 업데이트됩니다.
    /// 예: { "color": [1,0,0,1] } → color만 변경, 나머지 유지
    pub fn set_stroke(&mut self, name: &str, stroke_json: &str) -> Result<bool, JsValue> {
        let entity = match self.find_by_name_mut(name) {
            Some(e) => e,
            None => return Ok(false),
        };

        // JSON 파싱하여 어떤 필드가 있는지 확인
        let json_value: serde_json::Value = serde_json::from_str(stroke_json)
            .map_err(|e| JsValue::from_str(&format!("[set_stroke] invalid_json: {}", e)))?;

        // 기존 stroke가 있으면 부분 업데이트, 없으면 새로 생성
        if let Some(ref mut existing) = entity.style.stroke {
            // 부분 업데이트: JSON에 있는 필드만 변경
            if let Some(width) = json_value.get("width").and_then(|v| v.as_f64()) {
                existing.width = width;
            }
            if let Some(color) = json_value
                .get("color")
                .and_then(|v| v.as_array())
                .filter(|c| c.len() == 4)
            {
                existing.color = [
                    color[0].as_f64().unwrap_or(0.0),
                    color[1].as_f64().unwrap_or(0.0),
                    color[2].as_f64().unwrap_or(0.0),
                    color[3].as_f64().unwrap_or(1.0),
                ];
            }
            if let Some(dash) = json_value.get("dash") {
                if dash.is_null() {
                    existing.dash = None;
                } else if let Some(arr) = dash.as_array() {
                    existing.dash = Some(arr.iter().filter_map(|v| v.as_f64()).collect());
                }
            }
            if let Some(cap) = json_value.get("cap").and_then(|v| v.as_str()) {
                existing.cap = match cap {
                    "Round" => LineCap::Round,
                    "Square" => LineCap::Square,
                    _ => LineCap::Butt,
                };
            }
            if let Some(join) = json_value.get("join").and_then(|v| v.as_str()) {
                existing.join = match join {
                    "Round" => LineJoin::Round,
                    "Bevel" => LineJoin::Bevel,
                    _ => LineJoin::Miter,
                };
            }
        } else {
            // 새 stroke 생성 (기본값 + JSON 값)
            let new_stroke = StrokeStyle {
                width: json_value
                    .get("width")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(1.0),
                color: json_value
                    .get("color")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        if arr.len() == 4 {
                            [
                                arr[0].as_f64().unwrap_or(0.0),
                                arr[1].as_f64().unwrap_or(0.0),
                                arr[2].as_f64().unwrap_or(0.0),
                                arr[3].as_f64().unwrap_or(1.0),
                            ]
                        } else {
                            [0.0, 0.0, 0.0, 1.0]
                        }
                    })
                    .unwrap_or([0.0, 0.0, 0.0, 1.0]),
                dash: json_value.get("dash").and_then(|v| {
                    if v.is_null() {
                        None
                    } else {
                        v.as_array()
                            .map(|arr| arr.iter().filter_map(|x| x.as_f64()).collect())
                    }
                }),
                cap: json_value
                    .get("cap")
                    .and_then(|v| v.as_str())
                    .map(|s| match s {
                        "Round" => LineCap::Round,
                        "Square" => LineCap::Square,
                        _ => LineCap::Butt,
                    })
                    .unwrap_or(LineCap::Butt),
                join: json_value
                    .get("join")
                    .and_then(|v| v.as_str())
                    .map(|s| match s {
                        "Round" => LineJoin::Round,
                        "Bevel" => LineJoin::Bevel,
                        _ => LineJoin::Miter,
                    })
                    .unwrap_or(LineJoin::Miter),
            };
            entity.style.stroke = Some(new_stroke);
        }

        Ok(true)
    }

    /// 기존 도형의 fill 스타일을 변경합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름
    /// * `fill_json` - FillStyle JSON
    ///
    /// # Returns
    /// * Ok(true) - 성공
    /// * Ok(false) - name 미발견
    pub fn set_fill(&mut self, name: &str, fill_json: &str) -> Result<bool, JsValue> {
        let entity = match self.find_by_name_mut(name) {
            Some(e) => e,
            None => return Ok(false),
        };

        let json_value: serde_json::Value = serde_json::from_str(fill_json)
            .map_err(|e| JsValue::from_str(&format!("[set_fill] invalid_json: {}", e)))?;

        let color = json_value
            .get("color")
            .and_then(|v| v.as_array())
            .map(|arr| {
                if arr.len() == 4 {
                    [
                        arr[0].as_f64().unwrap_or(0.0),
                        arr[1].as_f64().unwrap_or(0.0),
                        arr[2].as_f64().unwrap_or(0.0),
                        arr[3].as_f64().unwrap_or(1.0),
                    ]
                } else {
                    [0.0, 0.0, 0.0, 1.0]
                }
            })
            .unwrap_or([0.0, 0.0, 0.0, 1.0]);

        entity.style.fill = Some(FillStyle { color });
        Ok(true)
    }

    /// stroke를 제거합니다 (선 없음).
    ///
    /// # Arguments
    /// * `name` - Entity 이름
    ///
    /// # Returns
    /// * Ok(true) - 성공
    /// * Ok(false) - name 미발견
    pub fn remove_stroke(&mut self, name: &str) -> Result<bool, JsValue> {
        let entity = match self.find_by_name_mut(name) {
            Some(e) => e,
            None => return Ok(false),
        };

        entity.style.stroke = None;
        Ok(true)
    }

    /// fill을 제거합니다 (채움 없음).
    ///
    /// # Arguments
    /// * `name` - Entity 이름
    ///
    /// # Returns
    /// * Ok(true) - 성공
    /// * Ok(false) - name 미발견
    pub fn remove_fill(&mut self, name: &str) -> Result<bool, JsValue> {
        let entity = match self.find_by_name_mut(name) {
            Some(e) => e,
            None => return Ok(false),
        };

        entity.style.fill = None;
        Ok(true)
    }

    // ========================================
    // Transform Functions (Story 3.1~3.4)
    // ========================================

    /// Entity를 지정된 거리만큼 이동합니다.
    ///
    /// # Arguments
    /// * `name` - 대상 Entity의 이름 (예: "left_arm")
    /// * `dx` - x축 이동 거리
    /// * `dy` - y축 이동 거리
    ///
    /// # Returns
    /// * Ok(true) - 성공
    /// * Ok(false) - name 미발견 (no-op)
    pub fn translate(&mut self, name: &str, dx: f64, dy: f64) -> Result<bool, JsValue> {
        let entity = match self.find_by_name_mut(name) {
            Some(e) => e,
            None => return Ok(false),
        };

        // 기존 값에 누적
        entity.transform.translate[0] += dx;
        entity.transform.translate[1] += dy;

        self.last_operation = Some(format!("translate({}, {}, {})", name, dx, dy));
        Ok(true)
    }

    /// Entity를 지정된 각도만큼 회전합니다.
    ///
    /// # Arguments
    /// * `name` - 대상 Entity의 이름 (예: "left_arm")
    /// * `angle` - 회전 각도 (라디안, 양수 = 반시계방향)
    ///
    /// # Returns
    /// * Ok(true) - 성공
    /// * Ok(false) - name 미발견 (no-op)
    pub fn rotate(&mut self, name: &str, angle: f64) -> Result<bool, JsValue> {
        let entity = match self.find_by_name_mut(name) {
            Some(e) => e,
            None => return Ok(false),
        };

        // 기존 값에 누적
        entity.transform.rotate += angle;

        // 라디안을 도로 변환하여 표시
        let degrees = angle * 180.0 / std::f64::consts::PI;
        self.last_operation = Some(format!("rotate({}, {:.1}°)", name, degrees));
        Ok(true)
    }

    /// Entity를 지정된 배율로 크기를 변경합니다.
    ///
    /// # Arguments
    /// * `name` - 대상 Entity의 이름 (예: "left_arm")
    /// * `sx` - x축 스케일 배율
    /// * `sy` - y축 스케일 배율
    ///
    /// # Returns
    /// * Ok(true) - 성공
    /// * Ok(false) - name 미발견 (no-op)
    pub fn scale(&mut self, name: &str, sx: f64, sy: f64) -> Result<bool, JsValue> {
        let entity = match self.find_by_name_mut(name) {
            Some(e) => e,
            None => return Ok(false),
        };

        // 관대한 입력 보정: 0 이하는 abs().max(0.001)로 변환
        let sx = if sx <= 0.0 { sx.abs().max(0.001) } else { sx };
        let sy = if sy <= 0.0 { sy.abs().max(0.001) } else { sy };

        // 기존 값에 곱셈 누적
        entity.transform.scale[0] *= sx;
        entity.transform.scale[1] *= sy;

        self.last_operation = Some(format!("scale({}, {}x, {}x)", name, sx, sy));
        Ok(true)
    }

    /// Entity를 삭제합니다.
    ///
    /// # Arguments
    /// * `name` - 삭제할 Entity의 이름
    ///
    /// # Returns
    /// * Ok(true) - 삭제 성공
    /// * Ok(false) - name 미발견 (no-op)
    pub fn delete(&mut self, name: &str) -> Result<bool, JsValue> {
        let idx = self.entities.iter().position(|e| e.metadata.name == name);

        match idx {
            Some(i) => {
                self.entities.remove(i);
                self.last_operation = Some(format!("delete({})", name));
                Ok(true)
            }
            None => Ok(false),
        }
    }

    /// Entity의 회전/스케일 중심점(pivot)을 설정합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름
    /// * `px` - pivot x 좌표 (로컬 좌표계)
    /// * `py` - pivot y 좌표 (로컬 좌표계)
    ///
    /// # Returns
    /// * Ok(true) - 성공
    /// * Ok(false) - name 미발견 (no-op)
    ///
    /// # Notes
    /// pivot은 rotate/scale 변환의 중심점입니다.
    /// 기본값 [0, 0]은 엔티티의 로컬 원점입니다.
    pub fn set_pivot(&mut self, name: &str, px: f64, py: f64) -> Result<bool, JsValue> {
        self.set_pivot_internal(name, px, py)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Entity의 z-order(렌더링 순서)를 설정합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름
    /// * `z_index` - z-order 값 (높을수록 앞에 렌더링)
    ///
    /// # Returns
    /// * Ok(true) - 성공
    /// * Ok(false) - name 미발견 (no-op)
    ///
    /// # Notes
    /// z_index가 같으면 생성 순서대로 렌더링됩니다.
    /// 음수 값도 허용됩니다.
    pub fn set_z_order(&mut self, name: &str, z_index: i32) -> Result<bool, JsValue> {
        let entity = match self.find_by_name_mut(name) {
            Some(e) => e,
            None => return Ok(false),
        };

        entity.metadata.z_index = z_index;
        self.last_operation = Some(format!("set_z_order({}, {})", name, z_index));
        Ok(true)
    }

    /// Entity의 z_index를 조회합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름
    ///
    /// # Returns
    /// * Some(z_index) - Entity의 z_index
    /// * None - name 미발견
    pub fn get_z_order(&self, name: &str) -> Option<i32> {
        self.find_by_name(name).map(|e| e.metadata.z_index)
    }

    // ========================================
    // Group Functions (Story 4.1~4.3)
    // Internal logic moved to groups.rs
    // ========================================

    /// 여러 Entity를 그룹으로 묶습니다. (WASM 바인딩)
    ///
    /// # Arguments
    /// * `name` - 그룹 이름 (예: "left_arm") - Scene 내 unique
    /// * `children_json` - 자식 Entity 이름들의 JSON 배열 (예: '["upper_arm", "lower_arm"]')
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 그룹 name 반환
    ///
    /// # Errors
    /// * name 중복 시 에러
    ///
    /// # 입력 보정 (AC2)
    /// 존재하지 않는 자식 이름은 무시하고 정상 생성
    pub fn create_group(&mut self, name: &str, children_json: &str) -> Result<String, JsValue> {
        // children JSON 파싱
        let children_names: Vec<String> = serde_json::from_str(children_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid children JSON: {}", e)))?;

        self.create_group_internal(name, children_names)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// 그룹을 해제하여 자식들을 독립 엔티티로 만듭니다. (WASM 바인딩)
    ///
    /// # Arguments
    /// * `name` - 해제할 그룹 이름
    ///
    /// # Returns
    /// * Ok(true) - 그룹 해제 성공
    /// * Ok(false) - name이 존재하지 않음
    ///
    /// # Errors
    /// * name이 Group 타입이 아니면 에러
    pub fn ungroup(&mut self, name: &str) -> Result<bool, JsValue> {
        self.ungroup_internal(name)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// 그룹에 Entity를 추가합니다. (WASM 바인딩)
    ///
    /// # Arguments
    /// * `group_name` - 그룹 이름
    /// * `entity_name` - 추가할 Entity 이름
    ///
    /// # Returns
    /// * Ok(true) - 추가 성공
    /// * Ok(false) - group_name 또는 entity_name이 존재하지 않음
    ///
    /// # Errors
    /// * group_name이 Group 타입이 아니면 에러
    ///
    /// # Notes
    /// 이미 다른 그룹에 속한 Entity는 기존 그룹에서 제거 후 추가됩니다.
    pub fn add_to_group(&mut self, group_name: &str, entity_name: &str) -> Result<bool, JsValue> {
        self.add_to_group_internal(group_name, entity_name)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// 그룹에서 Entity를 제거합니다. (WASM 바인딩)
    ///
    /// # Arguments
    /// * `group_name` - 그룹 이름
    /// * `entity_name` - 제거할 Entity 이름
    ///
    /// # Returns
    /// * Ok(true) - 제거 성공
    /// * Ok(false) - group_name 또는 entity_name이 존재하지 않음, 또는 해당 그룹의 자식이 아님
    ///
    /// # Errors
    /// * group_name이 Group 타입이 아니면 에러
    pub fn remove_from_group(
        &mut self,
        group_name: &str,
        entity_name: &str,
    ) -> Result<bool, JsValue> {
        self.remove_from_group_internal(group_name, entity_name)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    // ========================================
    // Scene Query Functions (Story 3.0-a)
    // ========================================

    /// Scene 내 모든 Entity의 이름과 타입을 반환합니다.
    ///
    /// # Returns
    /// JSON 배열: [{"name": "head", "type": "Circle"}, ...]
    ///
    /// # Examples
    /// ```ignore
    /// let list = scene.list_entities();
    /// // [{"name":"wall","type":"Rect"},{"name":"door","type":"Arc"}]
    /// ```
    pub fn list_entities(&self) -> String {
        let list: Vec<serde_json::Value> = self
            .entities
            .iter()
            .map(|e| {
                serde_json::json!({
                    "name": e.metadata.name,
                    "type": format!("{:?}", e.entity_type)
                })
            })
            .collect();

        serde_json::to_string(&list).unwrap_or_else(|_| "[]".to_string())
    }

    /// 이름으로 Entity를 조회하여 전체 JSON을 반환합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름
    ///
    /// # Returns
    /// * Some(JSON) - Entity가 존재하면 전체 JSON 반환
    /// * None - Entity가 없으면 None
    ///
    /// # Examples
    /// ```ignore
    /// if let Some(json) = scene.get_entity("head") {
    ///     // {"id":"...","entity_type":"Circle",...}
    /// }
    /// ```
    pub fn get_entity(&self, name: &str) -> Option<String> {
        self.find_by_name(name)
            .map(|entity| serde_json::to_string(entity).unwrap_or_else(|_| "{}".to_string()))
    }

    /// Scene의 전체 정보를 반환합니다.
    ///
    /// # Returns
    /// JSON 객체: {"name": "scene-name", "entity_count": 5, "bounds": {"min": [x,y], "max": [x,y]}}
    /// bounds가 null이면 Scene이 비어있음
    ///
    /// # Examples
    /// ```ignore
    /// let info = scene.get_scene_info();
    /// // {"name":"my-scene","entity_count":2,"bounds":{"min":[0,0],"max":[100,100]}}
    /// ```
    pub fn get_scene_info(&self) -> String {
        let bounds = self.calculate_bounds();

        let bounds_json = match bounds {
            Some((min, max)) => serde_json::json!({
                "min": min,
                "max": max
            }),
            None => serde_json::Value::Null,
        };

        let last_op_json = match &self.last_operation {
            Some(op) => serde_json::Value::String(op.clone()),
            None => serde_json::Value::Null,
        };

        serde_json::to_string(&serde_json::json!({
            "name": self.name,
            "entity_count": self.entities.len(),
            "bounds": bounds_json,
            "last_operation": last_op_json
        }))
        .unwrap_or_else(|_| "{}".to_string())
    }

    // ========================================
    // World Transform API (Phase 2)
    // ========================================

    /// Entity의 월드 변환 행렬을 반환합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름
    ///
    /// # Returns
    /// * Some(JSON) - 3x3 행렬 JSON: [[a, b, tx], [c, d, ty], [0, 0, 1]]
    /// * None - Entity가 없으면 None
    ///
    /// # 변환 상속
    /// 부모 그룹의 변환이 자식에게 상속됩니다.
    /// 반환되는 행렬은 모든 조상의 변환이 결합된 최종 월드 변환입니다.
    pub fn get_world_transform(&self, name: &str) -> Option<String> {
        let matrix = self.get_world_transform_internal(name)?;
        Some(
            serde_json::to_string(&matrix)
                .unwrap_or_else(|_| "[[1,0,0],[0,1,0],[0,0,1]]".to_string()),
        )
    }

    /// 로컬 좌표를 월드 좌표로 변환합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (이 엔티티의 좌표계 기준)
    /// * `x` - 로컬 x 좌표
    /// * `y` - 로컬 y 좌표
    ///
    /// # Returns
    /// * Some(JSON) - 월드 좌표: {"x": ..., "y": ...}
    /// * None - Entity가 없으면 None
    pub fn get_world_point(&self, name: &str, x: f64, y: f64) -> Option<String> {
        let matrix = self.get_world_transform_internal(name)?;
        let world_point = Transform::transform_point(&matrix, [x, y]);
        Some(
            serde_json::to_string(&serde_json::json!({
                "x": world_point[0],
                "y": world_point[1]
            }))
            .unwrap_or_else(|_| "{}".to_string()),
        )
    }

    /// Entity의 월드 좌표 바운딩 박스를 반환합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름
    ///
    /// # Returns
    /// * Some(JSON) - {"min": [x, y], "max": [x, y]}
    /// * None - Entity가 없거나 빈 그룹이면 None
    ///
    /// # Notes
    /// 변환(translate, rotate, scale)이 적용된 최종 월드 좌표 바운드입니다.
    /// 그룹의 경우 모든 자식의 바운드를 포함합니다.
    pub fn get_world_bounds(&self, name: &str) -> Option<String> {
        let (min, max) = self.get_world_bounds_internal(name)?;
        Some(
            serde_json::to_string(&serde_json::json!({
                "min": min,
                "max": max
            }))
            .unwrap_or_else(|_| "{}".to_string()),
        )
    }

    /// Entity가 존재하는지 확인합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름
    ///
    /// # Returns
    /// * true - Entity 존재
    /// * false - Entity 없음
    pub fn exists(&self, name: &str) -> bool {
        self.has_entity(name)
    }
}

impl Scene {
    // ========================================
    // World Transform Functions (Phase 2)
    // ========================================

    /// Entity의 부모 체인을 수집합니다 (루트부터 순서대로)
    fn collect_parent_chain(&self, name: &str) -> Vec<&Entity> {
        let mut chain = Vec::new();
        let mut current_name = Some(name.to_string());

        while let Some(ref n) = current_name {
            if let Some(entity) = self.find_by_name(n) {
                chain.push(entity);
                current_name = entity.parent_id.clone();
            } else {
                break;
            }
        }

        // 루트부터 순서대로 (현재 엔티티가 마지막)
        chain.reverse();
        chain
    }

    /// Entity의 월드 변환 행렬을 계산합니다 (내부용)
    ///
    /// 부모 체인의 모든 변환을 결합하여 최종 월드 변환을 반환합니다.
    /// 변환은 루트부터 적용됩니다: parent1 * parent2 * ... * entity
    fn get_world_transform_internal(&self, name: &str) -> Option<Matrix3x3> {
        let chain = self.collect_parent_chain(name);
        if chain.is_empty() {
            return None;
        }

        // 루트부터 차례대로 변환 결합
        let mut world_matrix = Transform::identity_matrix();
        for entity in chain {
            let local_matrix = entity.transform.to_matrix();
            world_matrix = Transform::multiply_matrices(&world_matrix, &local_matrix);
        }

        Some(world_matrix)
    }

    /// Geometry의 로컬 정점들을 반환합니다
    fn geometry_vertices(geometry: &Geometry) -> Vec<[f64; 2]> {
        match geometry {
            Geometry::Line { points } => points.clone(),
            Geometry::Circle { center, radius } => {
                // 원은 4개 극점으로 근사
                vec![
                    [center[0] - radius, center[1]],
                    [center[0] + radius, center[1]],
                    [center[0], center[1] - radius],
                    [center[0], center[1] + radius],
                ]
            }
            Geometry::Rect {
                origin,
                width,
                height,
            } => {
                // 사각형 4개 꼭짓점
                vec![
                    [origin[0], origin[1]],
                    [origin[0] + width, origin[1]],
                    [origin[0] + width, origin[1] + height],
                    [origin[0], origin[1] + height],
                ]
            }
            Geometry::Arc { center, radius, .. } => {
                // Arc도 보수적으로 원 극점 사용
                vec![
                    [center[0] - radius, center[1]],
                    [center[0] + radius, center[1]],
                    [center[0], center[1] - radius],
                    [center[0], center[1] + radius],
                ]
            }
            Geometry::Polygon { points } => points.clone(),
            Geometry::Bezier {
                start, segments, ..
            } => {
                // 베지어 커브는 모든 제어점과 끝점을 포함
                let mut vertices = vec![*start];
                for seg in segments {
                    vertices.push(seg[0]); // cp1
                    vertices.push(seg[1]); // cp2
                    vertices.push(seg[2]); // end
                }
                vertices
            }
            Geometry::Empty => vec![],
        }
    }

    /// Entity의 월드 좌표 바운딩 박스를 계산합니다 (내부용)
    fn get_world_bounds_internal(&self, name: &str) -> Option<([f64; 2], [f64; 2])> {
        let entity = self.find_by_name(name)?;
        let world_matrix = self.get_world_transform_internal(name)?;

        // Group인 경우 자식들의 바운드를 재귀적으로 계산
        if matches!(entity.entity_type, EntityType::Group) {
            if entity.children.is_empty() {
                return None;
            }

            let mut min_x = f64::INFINITY;
            let mut min_y = f64::INFINITY;
            let mut max_x = f64::NEG_INFINITY;
            let mut max_y = f64::NEG_INFINITY;

            for child_name in &entity.children {
                if let Some((child_min, child_max)) = self.get_world_bounds_internal(child_name) {
                    min_x = min_x.min(child_min[0]);
                    min_y = min_y.min(child_min[1]);
                    max_x = max_x.max(child_max[0]);
                    max_y = max_y.max(child_max[1]);
                }
            }

            if min_x == f64::INFINITY {
                return None;
            }
            return Some(([min_x, min_y], [max_x, max_y]));
        }

        // 일반 도형: 로컬 정점들을 월드 좌표로 변환
        let local_vertices = Self::geometry_vertices(&entity.geometry);
        if local_vertices.is_empty() {
            return None;
        }

        let mut min_x = f64::INFINITY;
        let mut min_y = f64::INFINITY;
        let mut max_x = f64::NEG_INFINITY;
        let mut max_y = f64::NEG_INFINITY;

        for vertex in local_vertices {
            let world_point = Transform::transform_point(&world_matrix, vertex);
            min_x = min_x.min(world_point[0]);
            min_y = min_y.min(world_point[1]);
            max_x = max_x.max(world_point[0]);
            max_y = max_y.max(world_point[1]);
        }

        Some(([min_x, min_y], [max_x, max_y]))
    }

    /// Scene의 전체 bounding box를 계산합니다.
    ///
    /// # Returns
    /// * Some((min, max)) - Entity가 있으면 [min_x, min_y], [max_x, max_y]
    /// * None - Scene이 비어있으면 None
    fn calculate_bounds(&self) -> Option<([f64; 2], [f64; 2])> {
        if self.entities.is_empty() {
            return None;
        }

        let mut min_x = f64::INFINITY;
        let mut min_y = f64::INFINITY;
        let mut max_x = f64::NEG_INFINITY;
        let mut max_y = f64::NEG_INFINITY;

        for entity in &self.entities {
            let (entity_min, entity_max) = Self::geometry_bounds(&entity.geometry);

            min_x = min_x.min(entity_min[0]);
            min_y = min_y.min(entity_min[1]);
            max_x = max_x.max(entity_max[0]);
            max_y = max_y.max(entity_max[1]);
        }

        Some(([min_x, min_y], [max_x, max_y]))
    }

    /// Geometry의 bounding box를 계산합니다.
    fn geometry_bounds(geometry: &Geometry) -> ([f64; 2], [f64; 2]) {
        match geometry {
            Geometry::Line { points } => {
                let mut min_x = f64::INFINITY;
                let mut min_y = f64::INFINITY;
                let mut max_x = f64::NEG_INFINITY;
                let mut max_y = f64::NEG_INFINITY;

                for point in points {
                    min_x = min_x.min(point[0]);
                    min_y = min_y.min(point[1]);
                    max_x = max_x.max(point[0]);
                    max_y = max_y.max(point[1]);
                }

                ([min_x, min_y], [max_x, max_y])
            }
            Geometry::Circle { center, radius } => (
                [center[0] - radius, center[1] - radius],
                [center[0] + radius, center[1] + radius],
            ),
            Geometry::Rect {
                origin,
                width,
                height,
            } => (
                [origin[0], origin[1]],
                [origin[0] + width, origin[1] + height],
            ),
            Geometry::Arc { center, radius, .. } => {
                // Arc는 보수적으로 전체 원의 bounding box 사용
                (
                    [center[0] - radius, center[1] - radius],
                    [center[0] + radius, center[1] + radius],
                )
            }
            Geometry::Polygon { points } => {
                let mut min_x = f64::INFINITY;
                let mut min_y = f64::INFINITY;
                let mut max_x = f64::NEG_INFINITY;
                let mut max_y = f64::NEG_INFINITY;

                for point in points {
                    min_x = min_x.min(point[0]);
                    min_y = min_y.min(point[1]);
                    max_x = max_x.max(point[0]);
                    max_y = max_y.max(point[1]);
                }

                ([min_x, min_y], [max_x, max_y])
            }
            Geometry::Bezier {
                start, segments, ..
            } => {
                // 베지어 커브: 모든 제어점과 끝점의 bounds
                let mut min_x = start[0];
                let mut min_y = start[1];
                let mut max_x = start[0];
                let mut max_y = start[1];

                for seg in segments {
                    for point in seg {
                        min_x = min_x.min(point[0]);
                        min_y = min_y.min(point[1]);
                        max_x = max_x.max(point[0]);
                        max_y = max_y.max(point[1]);
                    }
                }

                ([min_x, min_y], [max_x, max_y])
            }
            Geometry::Empty => {
                // Group은 자체 geometry가 없으므로 영점 반환 (자식 bounds는 별도 계산)
                ([0.0, 0.0], [0.0, 0.0])
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_geometry() -> Geometry {
        Geometry::Line {
            points: vec![[0.0, 0.0], [1.0, 1.0]],
        }
    }

    #[test]
    fn test_scene_new() {
        let scene = Scene::new("my-scene");
        assert_eq!(scene.get_name(), "my-scene");
        assert_eq!(scene.entity_count(), 0);
    }

    #[test]
    fn test_export_json_empty_scene() {
        let scene = Scene::new("empty");
        let json = scene.export_json();
        let value: serde_json::Value = serde_json::from_str(&json).expect("valid JSON");

        assert!(value.get("name").is_none());
        let entities = value
            .get("entities")
            .and_then(|v| v.as_array())
            .expect("entities array");
        assert!(entities.is_empty());
    }

    #[test]
    fn test_export_json_with_entities() {
        let mut scene = Scene::new("skeleton");
        scene
            .add_circle_internal("head", 0.0, 100.0, 10.0)
            .expect("circle should succeed");
        scene
            .add_line_internal("spine", vec![0.0, 90.0, 0.0, 50.0])
            .expect("line should succeed");

        let json = scene.export_json();
        let value: serde_json::Value = serde_json::from_str(&json).expect("valid JSON");

        assert_eq!(value.get("name").and_then(|v| v.as_str()), Some("skeleton"));

        let entities = value
            .get("entities")
            .and_then(|v| v.as_array())
            .expect("entities array");
        assert_eq!(entities.len(), 2);

        let circle = &entities[0];
        assert!(
            circle
                .get("id")
                .and_then(|v| v.as_str())
                .map(|id| !id.is_empty())
                .unwrap_or(false)
        );
        assert_eq!(
            circle.get("entity_type").and_then(|v| v.as_str()),
            Some("Circle")
        );
        assert!(
            circle
                .get("geometry")
                .and_then(|g| g.get("Circle"))
                .is_some()
        );
        assert!(circle.get("transform").is_some());

        let line = &entities[1];
        assert_eq!(
            line.get("entity_type").and_then(|v| v.as_str()),
            Some("Line")
        );
        assert!(line.get("geometry").and_then(|g| g.get("Line")).is_some());
        assert!(line.get("transform").is_some());
    }

    #[test]
    fn test_add_entity_returns_name() {
        let mut scene = Scene::new("test");
        let name = scene
            .add_entity_internal("add_entity", "head", EntityType::Line, sample_geometry())
            .expect("add_entity should succeed");

        assert_eq!(name, "head");
        assert_eq!(scene.entity_count(), 1);

        let stored = scene.find_by_name("head").expect("entity should exist");
        assert_eq!(stored.metadata.name, "head");
        assert!(!stored.id.is_empty());
    }

    #[test]
    fn test_add_entity_duplicate_name() {
        let mut scene = Scene::new("test");
        scene
            .add_entity_internal("add_entity", "head", EntityType::Line, sample_geometry())
            .expect("first add_entity should succeed");

        let err = scene
            .add_entity_internal("add_entity", "head", EntityType::Line, sample_geometry())
            .expect_err("duplicate name should error");
        assert_eq!(
            err.to_string(),
            "[add_entity] duplicate_name: Entity 'head' already exists"
        );
        assert!(matches!(
            err,
            SceneError::DuplicateEntityName(fn_name, name) if fn_name == "add_entity" && name == "head"
        ));
    }

    // ========================================
    // Story 4-4: set_pivot Tests
    // ========================================

    #[test]
    fn test_set_pivot_basic() {
        // AC1: set_pivot 호출 시 pivot 설정
        let mut scene = Scene::new("test");
        scene.add_circle_internal("c1", 0.0, 0.0, 10.0).unwrap();

        let result = scene.set_pivot_internal("c1", 5.0, 10.0);
        assert!(result.is_ok());
        assert!(result.unwrap());

        let entity = scene.find_by_name("c1").unwrap();
        assert_eq!(entity.transform.pivot, [5.0, 10.0]);
    }

    #[test]
    fn test_set_pivot_not_found() {
        // AC2: Entity 미존재 시 false
        let mut scene = Scene::new("test");

        let result = scene.set_pivot_internal("nonexistent", 5.0, 10.0);
        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    #[test]
    fn test_set_pivot_negative_values() {
        // AC3: 음수 pivot 허용
        let mut scene = Scene::new("test");
        scene.add_circle_internal("c1", 0.0, 0.0, 10.0).unwrap();

        let result = scene.set_pivot_internal("c1", -5.0, -10.0);
        assert!(result.is_ok());
        assert!(result.unwrap());

        let entity = scene.find_by_name("c1").unwrap();
        assert_eq!(entity.transform.pivot, [-5.0, -10.0]);
    }

    #[test]
    fn test_set_pivot_zero() {
        // AC4: pivot을 [0, 0]으로 재설정 가능
        let mut scene = Scene::new("test");
        scene.add_circle_internal("c1", 0.0, 0.0, 10.0).unwrap();
        scene.set_pivot_internal("c1", 5.0, 10.0).unwrap();

        let result = scene.set_pivot_internal("c1", 0.0, 0.0);
        assert!(result.is_ok());
        assert!(result.unwrap());

        let entity = scene.find_by_name("c1").unwrap();
        assert_eq!(entity.transform.pivot, [0.0, 0.0]);
    }

    #[test]
    fn test_set_pivot_json_serialization() {
        // AC5: pivot이 [0, 0]이 아니면 JSON에 포함됨
        let mut scene = Scene::new("test");
        scene.add_circle_internal("c1", 0.0, 0.0, 10.0).unwrap();
        scene.set_pivot_internal("c1", 5.0, 10.0).unwrap();

        let json = scene.export_json();
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        let entities = value.get("entities").unwrap().as_array().unwrap();
        let c1 = &entities[0];
        let transform = c1.get("transform").unwrap();
        let pivot = transform.get("pivot").unwrap().as_array().unwrap();
        assert_eq!(pivot[0].as_f64(), Some(5.0));
        assert_eq!(pivot[1].as_f64(), Some(10.0));
    }

    #[test]
    fn test_set_pivot_json_skip_default() {
        // AC6: pivot이 [0, 0]이면 JSON에서 생략됨 (skip_serializing_if)
        let mut scene = Scene::new("test");
        scene.add_circle_internal("c1", 0.0, 0.0, 10.0).unwrap();
        // pivot은 기본값 [0, 0]

        let json = scene.export_json();
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        let entities = value.get("entities").unwrap().as_array().unwrap();
        let c1 = &entities[0];
        let transform = c1.get("transform").unwrap();
        // pivot 필드가 없거나 null
        assert!(transform.get("pivot").is_none());
    }

    #[test]
    fn test_set_pivot_nan_infinity() {
        // AC7: NaN/Infinity 값은 에러 반환
        let mut scene = Scene::new("test");
        scene.add_circle_internal("c1", 0.0, 0.0, 10.0).unwrap();

        // NaN should error
        let result = scene.set_pivot_internal("c1", f64::NAN, 0.0);
        assert!(result.is_err());

        // Infinity should error
        let result = scene.set_pivot_internal("c1", 0.0, f64::INFINITY);
        assert!(result.is_err());

        // Negative infinity should error
        let result = scene.set_pivot_internal("c1", f64::NEG_INFINITY, 0.0);
        assert!(result.is_err());

        // Valid values should still work
        let result = scene.set_pivot_internal("c1", 5.0, 10.0);
        assert!(result.is_ok());
    }

    // ========================================
    // World Transform Tests (Phase 2)
    // ========================================

    fn approx_eq(a: f64, b: f64, eps: f64) -> bool {
        (a - b).abs() < eps
    }

    #[test]
    fn test_world_transform_no_parent() {
        // 부모 없는 엔티티: 로컬 변환 = 월드 변환
        let mut scene = Scene::new("test");
        scene.add_rect_internal("r1", 0.0, 0.0, 10.0, 10.0).unwrap();
        scene.find_by_name_mut("r1").unwrap().transform.translate = [5.0, 10.0];

        let matrix = scene.get_world_transform_internal("r1").unwrap();
        // translate만 있으면 tx=5, ty=10
        assert!(approx_eq(matrix[0][2], 5.0, 1e-10));
        assert!(approx_eq(matrix[1][2], 10.0, 1e-10));
    }

    #[test]
    fn test_world_transform_with_parent() {
        // 부모 그룹 변환이 자식에게 상속
        let mut scene = Scene::new("test");
        scene.add_circle_internal("c1", 0.0, 0.0, 5.0).unwrap();
        scene
            .create_group_internal("g1", vec!["c1".to_string()])
            .unwrap();

        // 그룹을 (10, 20)으로 이동
        scene.find_by_name_mut("g1").unwrap().transform.translate = [10.0, 20.0];

        // 자식의 월드 변환은 부모 변환을 상속
        let matrix = scene.get_world_transform_internal("c1").unwrap();
        assert!(approx_eq(matrix[0][2], 10.0, 1e-10));
        assert!(approx_eq(matrix[1][2], 20.0, 1e-10));
    }

    #[test]
    fn test_world_transform_nested_groups() {
        // 중첩 그룹: grandparent -> parent -> child
        let mut scene = Scene::new("test");
        scene.add_circle_internal("c1", 0.0, 0.0, 5.0).unwrap();
        scene
            .create_group_internal("parent", vec!["c1".to_string()])
            .unwrap();
        scene
            .create_group_internal("grandparent", vec!["parent".to_string()])
            .unwrap();

        // 각 그룹에 변환 적용
        scene
            .find_by_name_mut("grandparent")
            .unwrap()
            .transform
            .translate = [100.0, 0.0];
        scene
            .find_by_name_mut("parent")
            .unwrap()
            .transform
            .translate = [0.0, 50.0];

        // c1의 월드 변환: grandparent(100, 0) + parent(0, 50) = (100, 50)
        let matrix = scene.get_world_transform_internal("c1").unwrap();
        assert!(approx_eq(matrix[0][2], 100.0, 1e-10));
        assert!(approx_eq(matrix[1][2], 50.0, 1e-10));
    }

    #[test]
    fn test_world_transform_with_rotation() {
        use std::f64::consts::PI;

        let mut scene = Scene::new("test");
        scene.add_circle_internal("c1", 0.0, 0.0, 5.0).unwrap();
        scene
            .create_group_internal("g1", vec!["c1".to_string()])
            .unwrap();

        // 그룹을 90도 회전
        scene.find_by_name_mut("g1").unwrap().transform.rotate = PI / 2.0;
        // 자식을 (10, 0)으로 이동
        scene.find_by_name_mut("c1").unwrap().transform.translate = [10.0, 0.0];

        // 월드 좌표: (10, 0) 회전 90도 -> (0, 10)
        let matrix = scene.get_world_transform_internal("c1").unwrap();
        let world_origin = Transform::transform_point(&matrix, [0.0, 0.0]);
        assert!(approx_eq(world_origin[0], 0.0, 1e-10));
        assert!(approx_eq(world_origin[1], 10.0, 1e-10));
    }

    #[test]
    fn test_world_bounds_simple() {
        let mut scene = Scene::new("test");
        scene.add_rect_internal("r1", 0.0, 0.0, 10.0, 20.0).unwrap();

        let (min, max) = scene.get_world_bounds_internal("r1").unwrap();
        assert!(approx_eq(min[0], 0.0, 1e-10));
        assert!(approx_eq(min[1], 0.0, 1e-10));
        assert!(approx_eq(max[0], 10.0, 1e-10));
        assert!(approx_eq(max[1], 20.0, 1e-10));
    }

    #[test]
    fn test_world_bounds_with_translate() {
        let mut scene = Scene::new("test");
        scene.add_rect_internal("r1", 0.0, 0.0, 10.0, 20.0).unwrap();
        scene.find_by_name_mut("r1").unwrap().transform.translate = [5.0, 10.0];

        let (min, max) = scene.get_world_bounds_internal("r1").unwrap();
        assert!(approx_eq(min[0], 5.0, 1e-10));
        assert!(approx_eq(min[1], 10.0, 1e-10));
        assert!(approx_eq(max[0], 15.0, 1e-10));
        assert!(approx_eq(max[1], 30.0, 1e-10));
    }

    #[test]
    fn test_world_bounds_group() {
        let mut scene = Scene::new("test");
        scene.add_rect_internal("r1", 0.0, 0.0, 10.0, 10.0).unwrap();
        scene.add_circle_internal("c1", 50.0, 50.0, 5.0).unwrap();
        scene
            .create_group_internal("g1", vec!["r1".to_string(), "c1".to_string()])
            .unwrap();

        // 그룹 바운드는 모든 자식 포함
        let (min, max) = scene.get_world_bounds_internal("g1").unwrap();
        assert!(approx_eq(min[0], 0.0, 1e-10)); // r1 min_x
        assert!(approx_eq(min[1], 0.0, 1e-10)); // r1 min_y
        assert!(approx_eq(max[0], 55.0, 1e-10)); // c1 center + radius
        assert!(approx_eq(max[1], 55.0, 1e-10)); // c1 center + radius
    }

    #[test]
    fn test_get_world_point() {
        use std::f64::consts::PI;

        let mut scene = Scene::new("test");
        scene.add_circle_internal("c1", 0.0, 0.0, 5.0).unwrap();
        scene
            .create_group_internal("g1", vec!["c1".to_string()])
            .unwrap();

        // 그룹을 90도 회전하고 (10, 0) 이동
        scene.find_by_name_mut("g1").unwrap().transform.rotate = PI / 2.0;
        scene.find_by_name_mut("g1").unwrap().transform.translate = [10.0, 0.0];

        // c1 로컬 좌표 (5, 0)을 월드 좌표로
        let json = scene.get_world_point("c1", 5.0, 0.0).unwrap();
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        let x = value.get("x").unwrap().as_f64().unwrap();
        let y = value.get("y").unwrap().as_f64().unwrap();
        // (5, 0) 회전 90도 -> (0, 5), translate (10, 0) -> (10, 5)
        assert!(approx_eq(x, 10.0, 1e-10));
        assert!(approx_eq(y, 5.0, 1e-10));
    }

    #[test]
    fn test_exists() {
        let mut scene = Scene::new("test");
        scene.add_circle_internal("c1", 0.0, 0.0, 5.0).unwrap();

        assert!(scene.exists("c1"));
        assert!(!scene.exists("nonexistent"));
    }
}
