use crate::scene::entity::{Entity, Geometry, Style, Transform};

/// Entity를 SVG 요소로 변환합니다.
fn entity_to_svg(entity: &Entity) -> String {
    let transform_attr = transform_to_svg(&entity.transform);
    let style_attr = style_to_svg(&entity.style);

    match &entity.geometry {
        Geometry::Line { points } => {
            if points.len() < 2 {
                return String::new();
            }
            let points_str: String = points
                .iter()
                .map(|p| format!("{},{}", p[0], p[1]))
                .collect::<Vec<_>>()
                .join(" ");
            format!(
                r#"    <polyline points="{}" {}{}/>"#,
                points_str, style_attr, transform_attr
            ) + "\n"
        }
        Geometry::Circle { center, radius } => {
            format!(
                r#"    <circle cx="{}" cy="{}" r="{}" {}{}/>"#,
                center[0], center[1], radius, style_attr, transform_attr
            ) + "\n"
        }
        Geometry::Rect {
            origin,
            width,
            height,
        } => {
            format!(
                r#"    <rect x="{}" y="{}" width="{}" height="{}" {}{}/>"#,
                origin[0], origin[1], width, height, style_attr, transform_attr
            ) + "\n"
        }
        Geometry::Arc {
            center,
            radius,
            start_angle,
            end_angle,
        } => {
            // SVG doesn't have a native arc element, use path
            arc_to_svg_path(
                center,
                *radius,
                *start_angle,
                *end_angle,
                &style_attr,
                &transform_attr,
            )
        }
        Geometry::Empty => {
            // Group은 자체 렌더링이 없음 (자식들이 개별 렌더링)
            String::new()
        }
    }
}

/// Arc를 SVG path로 변환합니다.
fn arc_to_svg_path(
    center: &[f64; 2],
    radius: f64,
    start_angle: f64,
    end_angle: f64,
    style_attr: &str,
    transform_attr: &str,
) -> String {
    // Calculate start and end points
    let start_x = center[0] + radius * start_angle.cos();
    let start_y = center[1] + radius * start_angle.sin();
    let end_x = center[0] + radius * end_angle.cos();
    let end_y = center[1] + radius * end_angle.sin();

    // Normalize angle difference to handle wrap-around (e.g., 350° → 10°)
    // Using rem_euclid for efficient normalization to [0, 2π)
    let two_pi = 2.0 * std::f64::consts::PI;
    let angle_diff = (end_angle - start_angle).rem_euclid(two_pi);

    // Determine if arc is larger than 180 degrees
    let large_arc_flag = if angle_diff > std::f64::consts::PI {
        1
    } else {
        0
    };

    // Sweep direction: 1 for counterclockwise (positive angle in our coordinate system)
    // After normalization, any positive angle_diff means counterclockwise sweep
    // large_arc_flag handles arc size, sweep_flag handles direction only
    let sweep_flag = if angle_diff > 0.0 { 1 } else { 0 };

    format!(
        r#"    <path d="M {},{} A {},{} 0 {} {} {},{}" {}{}/>"#,
        start_x,
        start_y,
        radius,
        radius,
        large_arc_flag,
        sweep_flag,
        end_x,
        end_y,
        style_attr,
        transform_attr
    ) + "\n"
}

/// Transform을 SVG transform 속성으로 변환합니다.
/// pivot이 설정된 경우 rotate/scale의 중심점으로 사용됩니다.
fn transform_to_svg(transform: &Transform) -> String {
    let mut parts = Vec::new();
    let has_pivot = transform.pivot != [0.0, 0.0];
    let [px, py] = transform.pivot;

    // 1. Translation
    if transform.translate != [0.0, 0.0] {
        parts.push(format!(
            "translate({}, {})",
            transform.translate[0], transform.translate[1]
        ));
    }

    // 2. Pivot을 중심으로 한 rotate/scale
    if has_pivot && (transform.rotate != 0.0 || transform.scale != [1.0, 1.0]) {
        // translate to pivot
        parts.push(format!("translate({}, {})", px, py));
    }

    if transform.rotate != 0.0 {
        // SVG uses degrees
        let degrees = transform.rotate * 180.0 / std::f64::consts::PI;
        parts.push(format!("rotate({})", degrees));
    }

    if transform.scale != [1.0, 1.0] {
        parts.push(format!(
            "scale({}, {})",
            transform.scale[0], transform.scale[1]
        ));
    }

    if has_pivot && (transform.rotate != 0.0 || transform.scale != [1.0, 1.0]) {
        // translate back from pivot
        parts.push(format!("translate({}, {})", -px, -py));
    }

    if parts.is_empty() {
        String::new()
    } else {
        format!(r#"transform="{}""#, parts.join(" "))
    }
}

/// Style을 SVG 스타일 속성으로 변환합니다.
fn style_to_svg(style: &Style) -> String {
    let mut attrs = Vec::new();

    // Stroke (default: black, width 1)
    if let Some(stroke) = &style.stroke {
        let [r, g, b, a] = stroke.color;
        // Clamp color values to prevent overflow (0.0 ~ 1.0 -> 0 ~ 255)
        let color = format!(
            "rgba({},{},{},{})",
            (r.clamp(0.0, 1.0) * 255.0) as u8,
            (g.clamp(0.0, 1.0) * 255.0) as u8,
            (b.clamp(0.0, 1.0) * 255.0) as u8,
            a.clamp(0.0, 1.0)
        );
        attrs.push(format!(r#"stroke="{}""#, color));
        attrs.push(format!(r#"stroke-width="{}""#, stroke.width));
    } else {
        attrs.push(r#"stroke="black""#.to_string());
        attrs.push(r#"stroke-width="1""#.to_string());
    }

    // Fill (default: none)
    if let Some(fill) = &style.fill {
        let [r, g, b, a] = fill.color;
        // Clamp color values to prevent overflow (0.0 ~ 1.0 -> 0 ~ 255)
        let color = format!(
            "rgba({},{},{},{})",
            (r.clamp(0.0, 1.0) * 255.0) as u8,
            (g.clamp(0.0, 1.0) * 255.0) as u8,
            (b.clamp(0.0, 1.0) * 255.0) as u8,
            a.clamp(0.0, 1.0)
        );
        attrs.push(format!(r#"fill="{}""#, color));
    } else {
        attrs.push(r#"fill="none""#.to_string());
    }

    attrs.join(" ") + " "
}

/// Scene을 SVG 문자열로 직렬화합니다.
pub fn serialize_scene_svg(entities: &[Entity]) -> String {
    let mut svg = String::new();

    // SVG header with viewBox
    svg.push_str(r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="-200 -200 400 400">"#);
    svg.push('\n');

    // Y-axis flip group (SVG y-axis increases downward)
    svg.push_str(r#"  <g transform="scale(1, -1)">"#);
    svg.push('\n');

    // Convert each entity to SVG elements
    for entity in entities {
        svg.push_str(&entity_to_svg(entity));
    }

    svg.push_str("  </g>\n");
    svg.push_str("</svg>");

    svg
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scene::entity::{EntityType, Metadata};

    fn make_entity(geometry: Geometry) -> Entity {
        Entity {
            id: "test".to_string(),
            entity_type: EntityType::Line,
            geometry,
            transform: Transform::default(),
            style: Style::default(),
            metadata: Metadata::default(),
            parent_id: None,
            children: Vec::new(),
        }
    }

    #[test]
    fn test_line_to_svg() {
        let entity = make_entity(Geometry::Line {
            points: vec![[0.0, 0.0], [100.0, 100.0]],
        });
        let svg = entity_to_svg(&entity);
        assert!(svg.contains("<polyline"));
        assert!(svg.contains("0,0 100,100"));
    }

    #[test]
    fn test_circle_to_svg() {
        let entity = make_entity(Geometry::Circle {
            center: [50.0, 50.0],
            radius: 25.0,
        });
        let svg = entity_to_svg(&entity);
        assert!(svg.contains("<circle"));
        assert!(svg.contains(r#"cx="50""#));
        assert!(svg.contains(r#"cy="50""#));
        assert!(svg.contains(r#"r="25""#));
    }

    #[test]
    fn test_rect_to_svg() {
        let entity = make_entity(Geometry::Rect {
            origin: [0.0, 0.0],
            width: 100.0,
            height: 50.0,
        });
        let svg = entity_to_svg(&entity);
        assert!(svg.contains("<rect"));
        assert!(svg.contains(r#"width="100""#));
        assert!(svg.contains(r#"height="50""#));
    }

    #[test]
    fn test_transform_to_svg() {
        let transform = Transform {
            translate: [10.0, 20.0],
            rotate: std::f64::consts::FRAC_PI_2,
            scale: [2.0, 0.5],
            pivot: [0.0, 0.0],
        };
        let svg = transform_to_svg(&transform);
        assert!(svg.contains("translate(10, 20)"));
        assert!(svg.contains("rotate(90)"));
        assert!(svg.contains("scale(2, 0.5)"));
    }

    #[test]
    fn test_empty_transform() {
        let transform = Transform::default();
        let svg = transform_to_svg(&transform);
        assert!(svg.is_empty());
    }

    #[test]
    fn test_serialize_scene_svg() {
        let entities = vec![make_entity(Geometry::Circle {
            center: [0.0, 100.0],
            radius: 10.0,
        })];
        let svg = serialize_scene_svg(&entities);
        assert!(svg.starts_with("<svg"));
        assert!(svg.ends_with("</svg>"));
        assert!(svg.contains("<circle"));
    }
}
