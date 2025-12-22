use serde::{Deserialize, Serialize};

/// 선의 끝 모양
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum LineCap {
    Butt,
    Round,
    Square,
}

impl Default for LineCap {
    fn default() -> Self {
        LineCap::Butt
    }
}

/// 선의 꺾임 모양
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum LineJoin {
    Miter,
    Round,
    Bevel,
}

impl Default for LineJoin {
    fn default() -> Self {
        LineJoin::Miter
    }
}

/// 선(stroke) 스타일
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrokeStyle {
    pub width: f64,
    pub color: [f64; 4],  // RGBA, 0.0-1.0
    pub dash: Option<Vec<f64>>,
    pub cap: LineCap,
    pub join: LineJoin,
}

impl Default for StrokeStyle {
    fn default() -> Self {
        StrokeStyle {
            width: 1.0,
            color: [0.0, 0.0, 0.0, 1.0],  // 검은색
            dash: None,
            cap: LineCap::default(),
            join: LineJoin::default(),
        }
    }
}

/// 면(fill) 스타일
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FillStyle {
    pub color: [f64; 4],  // RGBA, 0.0-1.0
}

impl Default for FillStyle {
    fn default() -> Self {
        FillStyle {
            color: [0.0, 0.0, 0.0, 1.0],  // 검은색
        }
    }
}

/// Entity 스타일 (stroke + fill)
#[derive(Debug, Clone, Serialize, Deserialize)]
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
            color: [0.0, 0.0, 1.0, 1.0],  // 파란색
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
        let parsed: StrokeStyle = serde_json::from_str(&json).expect("deserialization should succeed");
        assert_eq!(parsed.width, 2.0);
        assert_eq!(parsed.cap, LineCap::Round);
    }

    #[test]
    fn test_fill_style_json_serialization() {
        let fill = FillStyle {
            color: [1.0, 0.0, 0.0, 0.5],  // 반투명 빨간색
        };

        let json = serde_json::to_string(&fill).expect("serialization should succeed");
        assert!(json.contains("\"color\":[1.0,0.0,0.0,0.5]"));

        let parsed: FillStyle = serde_json::from_str(&json).expect("deserialization should succeed");
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
