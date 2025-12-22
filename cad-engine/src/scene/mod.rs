use std::fmt;
use wasm_bindgen::prelude::*;
use uuid::Uuid;
use js_sys::Float64Array;
use serde_json;

pub mod style;
pub mod entity;

use entity::{Entity, EntityType, Geometry, Metadata, Style, Transform};
use style::{FillStyle, LineCap, LineJoin, StrokeStyle};
use crate::primitives::parse_line_points;

#[derive(Debug, Clone, PartialEq, Eq)]
enum SceneError {
    DuplicateEntityName(String, String), // (fn_name, entity_name)
    InvalidInput(String),
}

impl fmt::Display for SceneError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SceneError::DuplicateEntityName(fn_name, name) => {
                write!(f, "[{}] duplicate_name: Entity '{}' already exists", fn_name, name)
            }
            SceneError::InvalidInput(msg) => {
                write!(f, "{}", msg)
            }
        }
    }
}

impl std::error::Error for SceneError {}

#[wasm_bindgen]
pub struct Scene {
    name: String,
    entities: Vec<Entity>,
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
            return Err(SceneError::DuplicateEntityName(fn_name.to_string(), name.to_string()));
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
        };

        self.entities.push(entity);
        Ok(name.to_string())
    }

    /// 내부용 Line 생성 함수 (테스트용)
    /// Vec<f64> 좌표를 받아 Line Entity 생성
    fn add_line_internal(&mut self, name: &str, coords: Vec<f64>) -> Result<String, SceneError> {
        let point_pairs = parse_line_points(coords)
            .map_err(|msg| SceneError::InvalidInput(format!("[add_line] invalid_input: {}", msg)))?;

        self.add_entity_internal(
            "add_line",
            name,
            EntityType::Line,
            Geometry::Line { points: point_pairs },
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
    fn add_circle_internal(
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
    /// * `x` - 원점 x 좌표 (Y-up 중심 좌표계)
    /// * `y` - 원점 y 좌표 (Y-up 중심 좌표계)
    /// * `width` - 너비 (음수/0 → abs().max(0.001)로 보정)
    /// * `height` - 높이 (음수/0 → abs().max(0.001)로 보정)
    ///
    /// # Errors
    /// * NaN/Infinity 입력 시 에러 반환
    fn add_rect_internal(
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
                origin: [x, y],
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
    fn add_arc_internal(
        &mut self,
        name: &str,
        cx: f64,
        cy: f64,
        radius: f64,
        start_angle: f64,
        end_angle: f64,
    ) -> Result<String, SceneError> {
        // NaN/Infinity 검증 (유효하지 않은 geometry 방지)
        if !cx.is_finite() || !cy.is_finite() || !radius.is_finite()
            || !start_angle.is_finite() || !end_angle.is_finite() {
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

#[wasm_bindgen]
impl Scene {
    #[wasm_bindgen(constructor)]
    pub fn new(name: &str) -> Scene {
        Scene {
            name: name.to_string(),
            entities: Vec::new(),
        }
    }

    pub fn get_name(&self) -> String {
        self.name.clone()
    }

    pub fn entity_count(&self) -> usize {
        self.entities.len()
    }

    /// Scene을 JSON으로 내보냅니다.
    pub fn export_json(&self) -> Result<String, JsValue> {
        serde_json::to_string_pretty(&self.entities)
            .map_err(|e| JsValue::from_str(&e.to_string()))
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
        if !cx.is_finite() || !cy.is_finite() || !radius.is_finite()
            || !start_angle.is_finite() || !end_angle.is_finite() {
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
        let style = serde_json::from_str::<Style>(style_json)
            .unwrap_or_else(|_| Style::default());

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
        };

        self.entities.push(entity);
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
        let style = serde_json::from_str::<Style>(style_json)
            .unwrap_or_else(|_| Style::default());

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
        };

        self.entities.push(entity);
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
        let style = serde_json::from_str::<Style>(style_json)
            .unwrap_or_else(|_| Style::default());

        let entity = Entity {
            id: generate_id(),
            entity_type: EntityType::Line,
            geometry: Geometry::Line { points: point_pairs },
            transform: Transform::default(),
            style,
            metadata: Metadata {
                name: name.to_string(),
                ..Default::default()
            },
        };

        self.entities.push(entity);
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
        let style = serde_json::from_str::<Style>(style_json)
            .unwrap_or_else(|_| Style::default());

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
        };

        self.entities.push(entity);
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
            if let Some(color) = json_value.get("color").and_then(|v| v.as_array()) {
                if color.len() == 4 {
                    existing.color = [
                        color[0].as_f64().unwrap_or(0.0),
                        color[1].as_f64().unwrap_or(0.0),
                        color[2].as_f64().unwrap_or(0.0),
                        color[3].as_f64().unwrap_or(1.0),
                    ];
                }
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
                width: json_value.get("width").and_then(|v| v.as_f64()).unwrap_or(1.0),
                color: json_value.get("color").and_then(|v| v.as_array()).map(|arr| {
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
                }).unwrap_or([0.0, 0.0, 0.0, 1.0]),
                dash: json_value.get("dash").and_then(|v| {
                    if v.is_null() { None }
                    else { v.as_array().map(|arr| arr.iter().filter_map(|x| x.as_f64()).collect()) }
                }),
                cap: json_value.get("cap").and_then(|v| v.as_str()).map(|s| {
                    match s { "Round" => LineCap::Round, "Square" => LineCap::Square, _ => LineCap::Butt }
                }).unwrap_or(LineCap::Butt),
                join: json_value.get("join").and_then(|v| v.as_str()).map(|s| {
                    match s { "Round" => LineJoin::Round, "Bevel" => LineJoin::Bevel, _ => LineJoin::Miter }
                }).unwrap_or(LineJoin::Miter),
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

        let color = json_value.get("color").and_then(|v| v.as_array()).map(|arr| {
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
        }).unwrap_or([0.0, 0.0, 0.0, 1.0]);

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
        assert_eq!(err.to_string(), "[add_entity] duplicate_name: Entity 'head' already exists");
        assert!(matches!(
            err,
            SceneError::DuplicateEntityName(fn_name, name) if fn_name == "add_entity" && name == "head"
        ));
    }

    // === add_line 테스트 (Story 1.3) ===

    #[test]
    fn test_add_line_two_points() {
        // AC1: 기본 선분 생성
        let mut scene = Scene::new("test");
        let name = scene
            .add_line_internal("spine", vec![0.0, 100.0, 0.0, 50.0])
            .expect("add_line should succeed");

        assert_eq!(name, "spine");
        assert_eq!(scene.entity_count(), 1);

        let entity = scene.find_by_name("spine").unwrap();
        assert_eq!(entity.metadata.name, "spine");
        assert!(matches!(entity.entity_type, EntityType::Line));
        assert!(matches!(
            &entity.geometry,
            Geometry::Line { points } if points == &vec![[0.0, 100.0], [0.0, 50.0]]
        ));
    }

    #[test]
    fn test_add_line_polyline_3_points() {
        // AC2: 폴리라인 (3점)
        let mut scene = Scene::new("test");
        let name = scene
            .add_line_internal("left_arm", vec![0.0, 85.0, -20.0, 70.0, -25.0, 50.0])
            .expect("add_line polyline should succeed");

        assert_eq!(name, "left_arm");

        let entity = scene.find_by_name("left_arm").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Line { points } if points.len() == 3
        ));
    }

    #[test]
    fn test_add_line_polyline_4_points() {
        // AC2: 폴리라인 (4개 이상 좌표 = 4점)
        let mut scene = Scene::new("test");
        let name = scene
            .add_line_internal(
                "skeleton_arm",
                vec![0.0, 85.0, -20.0, 70.0, -25.0, 50.0, -30.0, 30.0],
            )
            .expect("add_line 4-point polyline should succeed");

        assert_eq!(name, "skeleton_arm");

        let entity = scene.find_by_name("skeleton_arm").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Line { points } if points.len() == 4
        ));
    }

    #[test]
    fn test_add_line_odd_coordinates_drops_last() {
        // AC3: 홀수 좌표 -> 마지막 무시하고 정상 생성
        let mut scene = Scene::new("test");
        let name = scene
            .add_line_internal("test_line", vec![0.0, 100.0, 0.0, 50.0, 999.0])
            .expect("odd coords should be forgiven");

        assert_eq!(name, "test_line");

        let entity = scene.find_by_name("test_line").unwrap();
        // 마지막 999.0은 무시되어야 함
        assert!(matches!(
            &entity.geometry,
            Geometry::Line { points } if points == &vec![[0.0, 100.0], [0.0, 50.0]]
        ));
    }

    #[test]
    fn test_add_line_too_few_points_error() {
        // 최소 2점 필요
        let mut scene = Scene::new("test");
        let err = scene
            .add_line_internal("invalid", vec![0.0, 100.0])
            .expect_err("should error with < 2 points");

        assert_eq!(err.to_string(), "[add_line] invalid_input: At least 2 points required");
    }

    #[test]
    fn test_add_line_duplicate_name_error() {
        // name 중복 시 에러
        let mut scene = Scene::new("test");
        scene
            .add_line_internal("spine", vec![0.0, 100.0, 0.0, 50.0])
            .expect("first add should succeed");

        let err = scene
            .add_line_internal("spine", vec![10.0, 10.0, 20.0, 20.0])
            .expect_err("duplicate name should error");

        assert_eq!(err.to_string(), "[add_line] duplicate_name: Entity 'spine' already exists");
    }

    #[test]
    fn test_add_line_nan_error() {
        // NaN 좌표 에러 (add_line_internal 레벨 검증)
        let mut scene = Scene::new("test");
        let err = scene
            .add_line_internal("invalid", vec![0.0, f64::NAN, 0.0, 50.0])
            .expect_err("NaN should error");

        assert_eq!(err.to_string(), "[add_line] invalid_input: NaN or Infinity not allowed");
    }

    #[test]
    fn test_add_line_infinity_error() {
        // Infinity 좌표 에러 (add_line_internal 레벨 검증)
        let mut scene = Scene::new("test");
        let err = scene
            .add_line_internal("invalid", vec![0.0, 100.0, f64::INFINITY, 50.0])
            .expect_err("Infinity should error");

        assert_eq!(err.to_string(), "[add_line] invalid_input: NaN or Infinity not allowed");
    }

    // === add_circle 테스트 (Story 1.4) ===

    #[test]
    fn test_add_circle_basic() {
        // AC1: 기본 원 생성
        let mut scene = Scene::new("test");
        let name = scene
            .add_circle_internal("head", 0.0, 100.0, 10.0)
            .expect("add_circle should succeed");

        assert_eq!(name, "head");
        assert_eq!(scene.entity_count(), 1);

        let entity = scene.find_by_name("head").unwrap();
        assert_eq!(entity.metadata.name, "head");
        assert!(matches!(entity.entity_type, EntityType::Circle));
        assert!(matches!(
            &entity.geometry,
            Geometry::Circle { center, radius }
            if center == &[0.0, 100.0] && *radius == 10.0
        ));
    }

    #[test]
    fn test_add_circle_negative_radius_corrected() {
        // AC2: 음수 반지름 → abs()로 보정
        let mut scene = Scene::new("test");
        let name = scene
            .add_circle_internal("joint", 50.0, 50.0, -5.0)
            .expect("negative radius should be corrected");

        assert_eq!(name, "joint");

        let entity = scene.find_by_name("joint").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Circle { radius, .. } if *radius == 5.0
        ));
    }

    #[test]
    fn test_add_circle_zero_radius_corrected() {
        // AC2: 0 반지름 → 0.001로 보정
        let mut scene = Scene::new("test");
        let name = scene
            .add_circle_internal("dot", 0.0, 0.0, 0.0)
            .expect("zero radius should be corrected to minimum");

        assert_eq!(name, "dot");

        let entity = scene.find_by_name("dot").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Circle { radius, .. } if *radius == 0.001
        ));
    }

    #[test]
    fn test_add_circle_tiny_negative_radius_clamped() {
        // AC2: 아주 작은 음수 반지름 → abs() 후 max(0.001)로 클램프
        // -0.0001 → abs() → 0.0001 → max(0.001) → 0.001
        let mut scene = Scene::new("test");
        let name = scene
            .add_circle_internal("tiny", 0.0, 0.0, -0.0001)
            .expect("tiny negative radius should be clamped to minimum");

        assert_eq!(name, "tiny");

        let entity = scene.find_by_name("tiny").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Circle { radius, .. } if *radius == 0.001
        ));
    }

    #[test]
    fn test_add_circle_negative_coordinates() {
        // AC3: 음수 좌표 허용
        let mut scene = Scene::new("test");
        let name = scene
            .add_circle_internal("off_canvas", -100.0, -50.0, 25.0)
            .expect("negative coordinates should be allowed");

        assert_eq!(name, "off_canvas");

        let entity = scene.find_by_name("off_canvas").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Circle { center, .. } if center == &[-100.0, -50.0]
        ));
    }

    #[test]
    fn test_add_circle_duplicate_name_error() {
        // name 중복 시 에러
        let mut scene = Scene::new("test");
        scene
            .add_circle_internal("head", 0.0, 100.0, 10.0)
            .expect("first add should succeed");

        let err = scene
            .add_circle_internal("head", 50.0, 50.0, 5.0)
            .expect_err("duplicate name should error");

        assert_eq!(err.to_string(), "[add_circle] duplicate_name: Entity 'head' already exists");
    }

    #[test]
    fn test_add_circle_nan_error() {
        // NaN 입력 시 에러
        let mut scene = Scene::new("test");
        let err = scene
            .add_circle_internal("invalid", f64::NAN, 0.0, 10.0)
            .expect_err("NaN x should error");
        assert_eq!(err.to_string(), "[add_circle] invalid_input: NaN or Infinity not allowed");

        let err = scene
            .add_circle_internal("invalid", 0.0, f64::NAN, 10.0)
            .expect_err("NaN y should error");
        assert_eq!(err.to_string(), "[add_circle] invalid_input: NaN or Infinity not allowed");

        let err = scene
            .add_circle_internal("invalid", 0.0, 0.0, f64::NAN)
            .expect_err("NaN radius should error");
        assert_eq!(err.to_string(), "[add_circle] invalid_input: NaN or Infinity not allowed");
    }

    #[test]
    fn test_add_circle_infinity_error() {
        // Infinity 입력 시 에러
        let mut scene = Scene::new("test");
        let err = scene
            .add_circle_internal("invalid", f64::INFINITY, 0.0, 10.0)
            .expect_err("Infinity x should error");
        assert_eq!(err.to_string(), "[add_circle] invalid_input: NaN or Infinity not allowed");

        let err = scene
            .add_circle_internal("invalid", 0.0, f64::NEG_INFINITY, 10.0)
            .expect_err("NEG_INFINITY y should error");
        assert_eq!(err.to_string(), "[add_circle] invalid_input: NaN or Infinity not allowed");

        let err = scene
            .add_circle_internal("invalid", 0.0, 0.0, f64::INFINITY)
            .expect_err("Infinity radius should error");
        assert_eq!(err.to_string(), "[add_circle] invalid_input: NaN or Infinity not allowed");
    }

    // === add_rect 테스트 (Story 1.5) ===

    #[test]
    fn test_add_rect_basic() {
        // AC1: 기본 사각형 생성
        let mut scene = Scene::new("test");
        let name = scene
            .add_rect_internal("torso", -5.0, 50.0, 10.0, 40.0)
            .expect("add_rect should succeed");

        assert_eq!(name, "torso");
        assert_eq!(scene.entity_count(), 1);

        let entity = scene.find_by_name("torso").unwrap();
        assert_eq!(entity.metadata.name, "torso");
        assert!(matches!(entity.entity_type, EntityType::Rect));
        assert!(matches!(
            &entity.geometry,
            Geometry::Rect { origin, width, height }
            if origin == &[-5.0, 50.0] && *width == 10.0 && *height == 40.0
        ));
    }

    #[test]
    fn test_add_rect_negative_width_corrected() {
        // AC2: 음수 너비 → abs()로 보정
        let mut scene = Scene::new("test");
        let name = scene
            .add_rect_internal("box", 0.0, 0.0, -100.0, 50.0)
            .expect("negative width should be corrected");

        assert_eq!(name, "box");

        let entity = scene.find_by_name("box").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Rect { width, .. } if *width == 100.0
        ));
    }

    #[test]
    fn test_add_rect_negative_height_corrected() {
        // AC2: 음수 높이 → abs()로 보정
        let mut scene = Scene::new("test");
        let name = scene
            .add_rect_internal("panel", 0.0, 0.0, 100.0, -50.0)
            .expect("negative height should be corrected");

        assert_eq!(name, "panel");

        let entity = scene.find_by_name("panel").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Rect { height, .. } if *height == 50.0
        ));
    }

    #[test]
    fn test_add_rect_zero_size_corrected() {
        // AC2: 0 크기 → 0.001로 보정
        let mut scene = Scene::new("test");
        let name = scene
            .add_rect_internal("point", 0.0, 0.0, 0.0, 0.0)
            .expect("zero size should be corrected to minimum");

        assert_eq!(name, "point");

        let entity = scene.find_by_name("point").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Rect { width, height, .. } if *width == 0.001 && *height == 0.001
        ));
    }

    #[test]
    fn test_add_rect_tiny_negative_size_clamped() {
        // AC2: 아주 작은 음수 크기 → abs() 후 max(0.001)로 클램프
        let mut scene = Scene::new("test");
        let name = scene
            .add_rect_internal("tiny", 0.0, 0.0, -0.0001, -0.0002)
            .expect("tiny negative size should be clamped to minimum");

        assert_eq!(name, "tiny");

        let entity = scene.find_by_name("tiny").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Rect { width, height, .. } if *width == 0.001 && *height == 0.001
        ));
    }

    #[test]
    fn test_add_rect_negative_coordinates() {
        // AC3: 음수 좌표 허용 (Y-up 중심 좌표계)
        let mut scene = Scene::new("test");
        let name = scene
            .add_rect_internal("off_canvas", -100.0, -50.0, 25.0, 30.0)
            .expect("negative coordinates should be allowed");

        assert_eq!(name, "off_canvas");

        let entity = scene.find_by_name("off_canvas").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Rect { origin, .. } if origin == &[-100.0, -50.0]
        ));
    }

    #[test]
    fn test_add_rect_duplicate_name_error() {
        // name 중복 시 에러
        let mut scene = Scene::new("test");
        scene
            .add_rect_internal("torso", 0.0, 50.0, 10.0, 40.0)
            .expect("first add should succeed");

        let err = scene
            .add_rect_internal("torso", 100.0, 100.0, 20.0, 20.0)
            .expect_err("duplicate name should error");

        assert_eq!(err.to_string(), "[add_rect] duplicate_name: Entity 'torso' already exists");
    }

    #[test]
    fn test_add_rect_nan_error() {
        // NaN 입력 시 에러
        let mut scene = Scene::new("test");
        let err = scene
            .add_rect_internal("invalid", f64::NAN, 0.0, 10.0, 10.0)
            .expect_err("NaN x should error");
        assert_eq!(err.to_string(), "[add_rect] invalid_input: NaN or Infinity not allowed");

        let err = scene
            .add_rect_internal("invalid", 0.0, f64::NAN, 10.0, 10.0)
            .expect_err("NaN y should error");
        assert_eq!(err.to_string(), "[add_rect] invalid_input: NaN or Infinity not allowed");

        let err = scene
            .add_rect_internal("invalid", 0.0, 0.0, f64::NAN, 10.0)
            .expect_err("NaN width should error");
        assert_eq!(err.to_string(), "[add_rect] invalid_input: NaN or Infinity not allowed");

        let err = scene
            .add_rect_internal("invalid", 0.0, 0.0, 10.0, f64::NAN)
            .expect_err("NaN height should error");
        assert_eq!(err.to_string(), "[add_rect] invalid_input: NaN or Infinity not allowed");
    }

    #[test]
    fn test_add_rect_infinity_error() {
        // Infinity 입력 시 에러
        let mut scene = Scene::new("test");
        let err = scene
            .add_rect_internal("invalid", f64::INFINITY, 0.0, 10.0, 10.0)
            .expect_err("Infinity x should error");
        assert_eq!(err.to_string(), "[add_rect] invalid_input: NaN or Infinity not allowed");

        let err = scene
            .add_rect_internal("invalid", 0.0, f64::NEG_INFINITY, 10.0, 10.0)
            .expect_err("NEG_INFINITY y should error");
        assert_eq!(err.to_string(), "[add_rect] invalid_input: NaN or Infinity not allowed");

        let err = scene
            .add_rect_internal("invalid", 0.0, 0.0, f64::INFINITY, 10.0)
            .expect_err("Infinity width should error");
        assert_eq!(err.to_string(), "[add_rect] invalid_input: NaN or Infinity not allowed");

        let err = scene
            .add_rect_internal("invalid", 0.0, 0.0, 10.0, f64::NEG_INFINITY)
            .expect_err("NEG_INFINITY height should error");
        assert_eq!(err.to_string(), "[add_rect] invalid_input: NaN or Infinity not allowed");
    }

    // === add_arc 테스트 (Story 1.6) ===

    #[test]
    fn test_add_arc_basic() {
        // AC1: 기본 Arc 생성
        let mut scene = Scene::new("test");
        let name = scene
            .add_arc_internal("quarter_arc", 0.0, 0.0, 50.0, 0.0, std::f64::consts::FRAC_PI_2)
            .expect("add_arc should succeed");

        assert_eq!(name, "quarter_arc");
        assert_eq!(scene.entity_count(), 1);

        let entity = scene.find_by_name("quarter_arc").unwrap();
        assert_eq!(entity.metadata.name, "quarter_arc");
        assert!(matches!(entity.entity_type, EntityType::Arc));
        assert!(matches!(
            &entity.geometry,
            Geometry::Arc { center, radius, start_angle, end_angle }
            if center == &[0.0, 0.0] && *radius == 50.0
                && *start_angle == 0.0 && (*end_angle - std::f64::consts::FRAC_PI_2).abs() < 1e-10
        ));
    }

    #[test]
    fn test_add_arc_90_degrees() {
        // AC2: 90도 호 (0 to π/2)
        let mut scene = Scene::new("test");
        let name = scene
            .add_arc_internal("arc_90", 0.0, 0.0, 50.0, 0.0, std::f64::consts::FRAC_PI_2)
            .expect("90 degree arc should succeed");

        assert_eq!(name, "arc_90");
        let entity = scene.find_by_name("arc_90").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Arc { start_angle, end_angle, .. }
            if *start_angle == 0.0 && (*end_angle - std::f64::consts::FRAC_PI_2).abs() < 1e-10
        ));
    }

    #[test]
    fn test_add_arc_half_circle() {
        // AC2: 반원 (0 to π)
        let mut scene = Scene::new("test");
        let name = scene
            .add_arc_internal("half_circle", 0.0, 0.0, 50.0, 0.0, std::f64::consts::PI)
            .expect("half circle should succeed");

        assert_eq!(name, "half_circle");
        let entity = scene.find_by_name("half_circle").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Arc { start_angle, end_angle, .. }
            if *start_angle == 0.0 && (*end_angle - std::f64::consts::PI).abs() < 1e-10
        ));
    }

    #[test]
    fn test_add_arc_negative_radius_corrected() {
        // AC3: 음수 반지름 → abs()로 보정
        let mut scene = Scene::new("test");
        let name = scene
            .add_arc_internal("neg_radius", 0.0, 0.0, -25.0, 0.0, std::f64::consts::PI)
            .expect("negative radius should be corrected");

        assert_eq!(name, "neg_radius");
        let entity = scene.find_by_name("neg_radius").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Arc { radius, .. } if *radius == 25.0
        ));
    }

    #[test]
    fn test_add_arc_zero_radius_corrected() {
        // AC3: 0 반지름 → 0.001로 보정
        let mut scene = Scene::new("test");
        let name = scene
            .add_arc_internal("zero_radius", 0.0, 0.0, 0.0, 0.0, std::f64::consts::PI)
            .expect("zero radius should be corrected");

        assert_eq!(name, "zero_radius");
        let entity = scene.find_by_name("zero_radius").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Arc { radius, .. } if *radius == 0.001
        ));
    }

    #[test]
    fn test_add_arc_full_circle_plus() {
        // AC4: 360도 이상 각도 허용
        let mut scene = Scene::new("test");
        let full_plus = std::f64::consts::PI * 2.5; // 450도
        let name = scene
            .add_arc_internal("full_plus", 0.0, 0.0, 50.0, 0.0, full_plus)
            .expect("360+ degrees should be allowed");

        assert_eq!(name, "full_plus");
        let entity = scene.find_by_name("full_plus").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Arc { end_angle, .. } if (*end_angle - full_plus).abs() < 1e-10
        ));
    }

    #[test]
    fn test_add_arc_negative_angles() {
        // 음수 각도 허용 (시계 방향)
        let mut scene = Scene::new("test");
        let name = scene
            .add_arc_internal("neg_angle", 0.0, 0.0, 50.0, 0.0, -std::f64::consts::FRAC_PI_2)
            .expect("negative angles should be allowed");

        assert_eq!(name, "neg_angle");
        let entity = scene.find_by_name("neg_angle").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Arc { end_angle, .. } if (*end_angle + std::f64::consts::FRAC_PI_2).abs() < 1e-10
        ));
    }

    #[test]
    fn test_add_arc_duplicate_name_error() {
        // name 중복 시 에러
        let mut scene = Scene::new("test");
        scene
            .add_arc_internal("arc1", 0.0, 0.0, 50.0, 0.0, std::f64::consts::PI)
            .expect("first add should succeed");

        let err = scene
            .add_arc_internal("arc1", 10.0, 10.0, 25.0, 0.0, 1.0)
            .expect_err("duplicate name should error");

        assert_eq!(err.to_string(), "[add_arc] duplicate_name: Entity 'arc1' already exists");
    }

    #[test]
    fn test_add_arc_nan_error() {
        // NaN 입력 시 에러
        let mut scene = Scene::new("test");

        let err = scene
            .add_arc_internal("invalid", f64::NAN, 0.0, 50.0, 0.0, 1.0)
            .expect_err("NaN cx should error");
        assert_eq!(err.to_string(), "[add_arc] invalid_input: NaN or Infinity not allowed");

        let err = scene
            .add_arc_internal("invalid", 0.0, 0.0, 50.0, f64::NAN, 1.0)
            .expect_err("NaN start_angle should error");
        assert_eq!(err.to_string(), "[add_arc] invalid_input: NaN or Infinity not allowed");
    }

    #[test]
    fn test_add_arc_infinity_error() {
        // Infinity 입력 시 에러
        let mut scene = Scene::new("test");

        let err = scene
            .add_arc_internal("invalid", 0.0, 0.0, f64::INFINITY, 0.0, 1.0)
            .expect_err("Infinity radius should error");
        assert_eq!(err.to_string(), "[add_arc] invalid_input: NaN or Infinity not allowed");

        let err = scene
            .add_arc_internal("invalid", 0.0, 0.0, 50.0, 0.0, f64::NEG_INFINITY)
            .expect_err("NEG_INFINITY end_angle should error");
        assert_eq!(err.to_string(), "[add_arc] invalid_input: NaN or Infinity not allowed");
    }
}
