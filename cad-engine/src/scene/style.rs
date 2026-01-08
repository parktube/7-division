/// Style 모듈
///
/// 스타일 타입 정의 및 스타일 조작 함수를 제공합니다.
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use super::Scene;

/// 선의 끝 모양
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
pub enum LineCap {
    #[default]
    Butt,
    Round,
    Square,
}

impl LineCap {
    /// 문자열에서 LineCap 파싱 (실패 시 기본값 반환)
    pub fn parse_str(s: &str) -> Self {
        match s {
            "Round" => LineCap::Round,
            "Square" => LineCap::Square,
            _ => LineCap::Butt,
        }
    }
}

/// 선의 꺾임 모양
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
pub enum LineJoin {
    #[default]
    Miter,
    Round,
    Bevel,
}

impl LineJoin {
    /// 문자열에서 LineJoin 파싱 (실패 시 기본값 반환)
    pub fn parse_str(s: &str) -> Self {
        match s {
            "Round" => LineJoin::Round,
            "Bevel" => LineJoin::Bevel,
            _ => LineJoin::Miter,
        }
    }
}

/// JSON 배열에서 RGBA 색상 파싱 (0.0-1.0 범위로 클램핑)
///
/// # Arguments
/// * `arr` - JSON 배열 (4개 요소: R, G, B, A)
/// * `default` - 파싱 실패 시 기본값
///
/// # Returns
/// RGBA 색상 배열 [r, g, b, a], 각 값은 0.0-1.0 범위
fn parse_rgba_color(arr: &[serde_json::Value], default: [f64; 4]) -> [f64; 4] {
    if arr.len() != 4 {
        return default;
    }
    [
        arr[0].as_f64().unwrap_or(default[0]).clamp(0.0, 1.0),
        arr[1].as_f64().unwrap_or(default[1]).clamp(0.0, 1.0),
        arr[2].as_f64().unwrap_or(default[2]).clamp(0.0, 1.0),
        arr[3].as_f64().unwrap_or(default[3]).clamp(0.0, 1.0),
    ]
}

/// 선(stroke) 스타일
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct StrokeStyle {
    pub width: f64,
    pub color: [f64; 4], // RGBA, 0.0-1.0
    pub dash: Option<Vec<f64>>,
    pub cap: LineCap,
    pub join: LineJoin,
}

impl Default for StrokeStyle {
    fn default() -> Self {
        StrokeStyle {
            width: 1.0,
            color: [0.0, 0.0, 0.0, 1.0], // 검은색
            dash: None,
            cap: LineCap::default(),
            join: LineJoin::default(),
        }
    }
}

/// 면(fill) 스타일
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct FillStyle {
    pub color: [f64; 4], // RGBA, 0.0-1.0
}

impl Default for FillStyle {
    fn default() -> Self {
        FillStyle {
            color: [0.0, 0.0, 0.0, 1.0], // 검은색
        }
    }
}

/// Entity 스타일 (stroke + fill)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct Style {
    pub stroke: Option<StrokeStyle>,
    pub fill: Option<FillStyle>,
}

impl Default for Style {
    fn default() -> Self {
        Style {
            stroke: Some(StrokeStyle::default()),
            fill: None,
        }
    }
}

// ========================================
// Style Operations (WASM)
// ========================================

#[wasm_bindgen]
impl Scene {
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
                existing.color = parse_rgba_color(color, existing.color);
            }
            if let Some(dash) = json_value.get("dash") {
                if dash.is_null() {
                    existing.dash = None;
                } else if let Some(arr) = dash.as_array() {
                    existing.dash = Some(arr.iter().filter_map(|v| v.as_f64()).collect());
                }
            }
            if let Some(cap) = json_value.get("cap").and_then(|v| v.as_str()) {
                existing.cap = LineCap::parse_str(cap);
            }
            if let Some(join) = json_value.get("join").and_then(|v| v.as_str()) {
                existing.join = LineJoin::parse_str(join);
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
                    .map(|arr| parse_rgba_color(arr, [0.0, 0.0, 0.0, 1.0]))
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
                    .map(LineCap::parse_str)
                    .unwrap_or(LineCap::Butt),
                join: json_value
                    .get("join")
                    .and_then(|v| v.as_str())
                    .map(LineJoin::parse_str)
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
            .map(|arr| parse_rgba_color(arr, [0.0, 0.0, 0.0, 1.0]))
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_line_cap_default() {
        assert_eq!(LineCap::default(), LineCap::Butt);
    }

    #[test]
    fn test_line_join_default() {
        assert_eq!(LineJoin::default(), LineJoin::Miter);
    }

    #[test]
    fn test_stroke_style_default() {
        let stroke = StrokeStyle::default();
        assert_eq!(stroke.width, 1.0);
        assert_eq!(stroke.color, [0.0, 0.0, 0.0, 1.0]);
        assert!(stroke.dash.is_none());
        assert_eq!(stroke.cap, LineCap::Butt);
        assert_eq!(stroke.join, LineJoin::Miter);
    }

    #[test]
    fn test_fill_style_default() {
        let fill = FillStyle::default();
        assert_eq!(fill.color, [0.0, 0.0, 0.0, 1.0]);
    }

    #[test]
    fn test_style_default() {
        // AC4: Style::default()는 stroke: 검은색 1px, fill: None
        let style = Style::default();
        assert!(style.stroke.is_some());
        assert!(style.fill.is_none());

        let stroke = style.stroke.unwrap();
        assert_eq!(stroke.width, 1.0);
        assert_eq!(stroke.color, [0.0, 0.0, 0.0, 1.0]);
    }

    #[test]
    fn test_stroke_style_json_serialization() {
        // AC5: JSON 직렬화
        let stroke = StrokeStyle {
            width: 2.0,
            color: [0.0, 0.0, 1.0, 1.0], // 파란색
            dash: Some(vec![5.0, 3.0]),
            cap: LineCap::Round,
            join: LineJoin::Bevel,
        };

        let json = serde_json::to_string(&stroke).expect("serialization should succeed");
        assert!(json.contains("\"width\":2.0"));
        assert!(json.contains("\"color\":[0.0,0.0,1.0,1.0]"));
        assert!(json.contains("\"dash\":[5.0,3.0]"));
        assert!(json.contains("\"cap\":\"Round\""));
        assert!(json.contains("\"join\":\"Bevel\""));

        // 역직렬화
        let parsed: StrokeStyle =
            serde_json::from_str(&json).expect("deserialization should succeed");
        assert_eq!(parsed.width, 2.0);
        assert_eq!(parsed.cap, LineCap::Round);
    }

    #[test]
    fn test_fill_style_json_serialization() {
        let fill = FillStyle {
            color: [1.0, 0.0, 0.0, 0.5], // 반투명 빨간색
        };

        let json = serde_json::to_string(&fill).expect("serialization should succeed");
        assert!(json.contains("\"color\":[1.0,0.0,0.0,0.5]"));

        let parsed: FillStyle =
            serde_json::from_str(&json).expect("deserialization should succeed");
        assert_eq!(parsed.color, [1.0, 0.0, 0.0, 0.5]);
    }

    #[test]
    fn test_style_json_serialization() {
        // AC5: 전체 Style JSON 직렬화
        let style = Style {
            stroke: Some(StrokeStyle {
                width: 2.0,
                color: [0.0, 0.0, 1.0, 1.0],
                dash: None,
                cap: LineCap::Round,
                join: LineJoin::Miter,
            }),
            fill: Some(FillStyle {
                color: [1.0, 0.0, 0.0, 0.5],
            }),
        };

        let json = serde_json::to_string(&style).expect("serialization should succeed");
        assert!(json.contains("\"stroke\":{"));
        assert!(json.contains("\"fill\":{"));

        let parsed: Style = serde_json::from_str(&json).expect("deserialization should succeed");
        assert!(parsed.stroke.is_some());
        assert!(parsed.fill.is_some());
    }

    #[test]
    fn test_style_json_no_stroke() {
        // stroke 없는 경우
        let style = Style {
            stroke: None,
            fill: Some(FillStyle::default()),
        };

        let json = serde_json::to_string(&style).expect("serialization should succeed");
        assert!(json.contains("\"stroke\":null"));
        assert!(json.contains("\"fill\":{"));
    }

    #[test]
    fn test_style_json_no_fill() {
        // fill 없는 경우 (기본값)
        let style = Style::default();

        let json = serde_json::to_string(&style).expect("serialization should succeed");
        assert!(json.contains("\"stroke\":{"));
        assert!(json.contains("\"fill\":null"));
    }
}
