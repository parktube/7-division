use crate::scene::entity::{Entity, EntityType, Geometry, Style, Transform};
use std::collections::HashMap;

/// Entity를 SVG 요소로 변환합니다 (단일 엔티티, 그룹 제외).
fn entity_to_svg_element(entity: &Entity, indent: &str) -> String {
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
                r#"{}<polyline points="{}" {}{}/>"#,
                indent, points_str, style_attr, transform_attr
            ) + "\n"
        }
        Geometry::Polygon { points, holes } => {
            if points.len() < 3 {
                return String::new();
            }

            // holes가 있으면 <path>로, 없으면 <polygon>으로 렌더링
            if holes.is_empty() {
                let points_str: String = points
                    .iter()
                    .map(|p| format!("{},{}", p[0], p[1]))
                    .collect::<Vec<_>>()
                    .join(" ");
                format!(
                    r#"{}<polygon points="{}" {}{}/>"#,
                    indent, points_str, style_attr, transform_attr
                ) + "\n"
            } else {
                // holes가 있으면 <path>로 변환 (fill-rule="evenodd" 사용)
                let mut path_data = String::new();

                // 외곽 contour
                if let Some((first, rest)) = points.split_first() {
                    path_data.push_str(&format!("M {},{}", first[0], first[1]));
                    for p in rest {
                        path_data.push_str(&format!(" L {},{}", p[0], p[1]));
                    }
                    path_data.push_str(" Z");
                }

                // holes (inner contours)
                for hole in holes {
                    if hole.len() >= 3
                        && let Some((first, rest)) = hole.split_first()
                    {
                        path_data.push_str(&format!(" M {},{}", first[0], first[1]));
                        for p in rest {
                            path_data.push_str(&format!(" L {},{}", p[0], p[1]));
                        }
                        path_data.push_str(" Z");
                    }
                }

                format!(
                    r#"{}<path d="{}" fill-rule="evenodd" {}{}/>"#,
                    indent, path_data, style_attr, transform_attr
                ) + "\n"
            }
        }
        Geometry::Circle { center, radius } => {
            format!(
                r#"{}<circle cx="{}" cy="{}" r="{}" {}{}/>"#,
                indent, center[0], center[1], radius, style_attr, transform_attr
            ) + "\n"
        }
        Geometry::Rect {
            center,
            width,
            height,
        } => {
            // SVG rect는 좌상단 기준, center에서 계산
            let x = center[0] - width / 2.0;
            let y = center[1] - height / 2.0;
            format!(
                r#"{}<rect x="{}" y="{}" width="{}" height="{}" {}{}/>"#,
                indent, x, y, width, height, style_attr, transform_attr
            ) + "\n"
        }
        Geometry::Arc {
            center,
            radius,
            start_angle,
            end_angle,
        } => arc_to_svg_path(
            center,
            *radius,
            *start_angle,
            *end_angle,
            &style_attr,
            &transform_attr,
            indent,
        ),
        Geometry::Bezier {
            start,
            segments,
            closed,
        } => bezier_to_svg_path(
            start,
            segments,
            *closed,
            &style_attr,
            &transform_attr,
            indent,
        ),
        Geometry::Empty => String::new(),
    }
}

/// Entity를 SVG로 변환합니다 (계층 구조 지원).
fn entity_to_svg_hierarchical(
    entity: &Entity,
    entities_by_name: &HashMap<String, &Entity>,
    indent: &str,
) -> String {
    match entity.entity_type {
        EntityType::Group => {
            // Group은 <g> 요소로 렌더링, 자식들을 재귀적으로 렌더링
            let transform_attr = transform_to_svg(&entity.transform);
            let mut result = String::new();

            if transform_attr.is_empty() {
                result.push_str(&format!("{}<g>\n", indent));
            } else {
                result.push_str(&format!("{}<g {}>\n", indent, transform_attr));
            }

            let child_indent = format!("{}  ", indent);

            // 자식들을 z_index로 정렬 (낮은 값이 먼저 렌더링 = 뒤에 위치)
            let mut sorted_children: Vec<_> = entity
                .children
                .iter()
                .filter_map(|name| entities_by_name.get(name).map(|e| (name, *e)))
                .collect();
            sorted_children.sort_by_key(|(_, e)| e.metadata.z_index);

            for (_, child) in sorted_children {
                result.push_str(&entity_to_svg_hierarchical(
                    child,
                    entities_by_name,
                    &child_indent,
                ));
            }

            result.push_str(&format!("{}</g>\n", indent));
            result
        }
        _ => entity_to_svg_element(entity, indent),
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
    indent: &str,
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
        r#"{}<path d="M {},{} A {},{} 0 {} {} {},{}" {}{}/>"#,
        indent,
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

/// Bezier 커브를 SVG path로 변환합니다.
fn bezier_to_svg_path(
    start: &[f64; 2],
    segments: &[[[f64; 2]; 3]],
    closed: bool,
    style_attr: &str,
    transform_attr: &str,
    indent: &str,
) -> String {
    if segments.is_empty() {
        return String::new();
    }

    let mut path_data = format!("M {},{}", start[0], start[1]);

    for seg in segments {
        let [cp1, cp2, end] = seg;
        path_data.push_str(&format!(
            " C {},{} {},{} {},{}",
            cp1[0], cp1[1], cp2[0], cp2[1], end[0], end[1]
        ));
    }

    if closed {
        path_data.push_str(" Z");
    }

    format!(
        r#"{}<path d="{}" {}{}/>"#,
        indent, path_data, style_attr, transform_attr
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

/// Scene을 SVG 문자열로 직렬화합니다 (계층 구조 지원).
pub fn serialize_scene_svg(entities: &[Entity]) -> String {
    let mut svg = String::new();

    // SVG header with viewBox
    svg.push_str(r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="-200 -200 400 400">"#);
    svg.push('\n');

    // Y-axis flip group (SVG y-axis increases downward)
    svg.push_str(r#"  <g transform="scale(1, -1)">"#);
    svg.push('\n');

    // Build name -> entity map for hierarchical lookup
    let entities_by_name: HashMap<String, &Entity> = entities
        .iter()
        .map(|e| (e.metadata.name.clone(), e))
        .collect();

    // Only render root entities (those without parent_id)
    // Children will be rendered recursively by their parent groups
    for entity in entities {
        if entity.parent_id.is_none() {
            svg.push_str(&entity_to_svg_hierarchical(
                entity,
                &entities_by_name,
                "    ",
            ));
        }
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

    /// 테스트용 헬퍼: entity_to_svg_element with default indent
    fn entity_to_svg(entity: &Entity) -> String {
        entity_to_svg_element(entity, "")
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
            center: [50.0, 25.0],
            width: 100.0,
            height: 50.0,
        });
        let svg = entity_to_svg(&entity);
        assert!(svg.contains("<rect"));
        assert!(svg.contains(r#"width="100""#));
        assert!(svg.contains(r#"height="50""#));
        // center [50, 25] with w=100, h=50 → x=0, y=0
        assert!(svg.contains(r#"x="0""#));
        assert!(svg.contains(r#"y="0""#));
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

    fn make_named_entity(name: &str, geometry: Geometry, entity_type: EntityType) -> Entity {
        Entity {
            id: name.to_string(),
            entity_type,
            geometry,
            transform: Transform::default(),
            style: Style::default(),
            metadata: Metadata {
                name: name.to_string(),
                layer: None,
                locked: false,
                z_index: 0,
            },
            parent_id: None,
            children: Vec::new(),
        }
    }

    #[test]
    fn test_hierarchical_svg_group() {
        // Create a group with a circle child
        let mut group = make_named_entity("grp", Geometry::Empty, EntityType::Group);
        group.children = vec!["circle1".to_string()];

        let mut circle = make_named_entity(
            "circle1",
            Geometry::Circle {
                center: [10.0, 10.0],
                radius: 5.0,
            },
            EntityType::Circle,
        );
        circle.parent_id = Some("grp".to_string());

        let entities = vec![group, circle];
        let svg = serialize_scene_svg(&entities);

        // Group should be rendered as <g>
        assert!(svg.contains("<g>"));
        assert!(svg.contains("</g>"));
        // Circle should be inside (content-wise)
        assert!(svg.contains("<circle"));
    }

    #[test]
    fn test_hierarchical_svg_group_with_transform() {
        // Create a group with transform
        let mut group = make_named_entity("grp", Geometry::Empty, EntityType::Group);
        group.children = vec!["rect1".to_string()];
        group.transform = Transform {
            translate: [50.0, 50.0],
            rotate: 0.0,
            scale: [1.0, 1.0],
            pivot: [0.0, 0.0],
        };

        let mut rect = make_named_entity(
            "rect1",
            Geometry::Rect {
                center: [10.0, 5.0],
                width: 20.0,
                height: 10.0,
            },
            EntityType::Rect,
        );
        rect.parent_id = Some("grp".to_string());

        let entities = vec![group, rect];
        let svg = serialize_scene_svg(&entities);

        // Group should have transform attribute
        assert!(svg.contains(r#"<g transform="#));
        assert!(svg.contains("translate(50, 50)"));
        // Rect should be rendered
        assert!(svg.contains("<rect"));
    }

    #[test]
    fn test_hierarchical_svg_children_not_rendered_at_root() {
        // Create a group with children - children should not appear twice
        let mut group = make_named_entity("grp", Geometry::Empty, EntityType::Group);
        group.children = vec!["c1".to_string()];

        let mut circle = make_named_entity(
            "c1",
            Geometry::Circle {
                center: [0.0, 0.0],
                radius: 10.0,
            },
            EntityType::Circle,
        );
        circle.parent_id = Some("grp".to_string());

        let entities = vec![group, circle];
        let svg = serialize_scene_svg(&entities);

        // Count occurrences of <circle - should be exactly 1
        let circle_count = svg.matches("<circle").count();
        assert_eq!(
            circle_count, 1,
            "Circle should be rendered only once (inside group)"
        );
    }

    #[test]
    fn test_hierarchical_svg_nested_groups() {
        // Create nested groups: outer_grp -> inner_grp -> circle
        let mut outer = make_named_entity("outer_grp", Geometry::Empty, EntityType::Group);
        outer.children = vec!["inner_grp".to_string()];

        let mut inner = make_named_entity("inner_grp", Geometry::Empty, EntityType::Group);
        inner.parent_id = Some("outer_grp".to_string());
        inner.children = vec!["c".to_string()];

        let mut circle = make_named_entity(
            "c",
            Geometry::Circle {
                center: [5.0, 5.0],
                radius: 3.0,
            },
            EntityType::Circle,
        );
        circle.parent_id = Some("inner_grp".to_string());

        let entities = vec![outer, inner, circle];
        let svg = serialize_scene_svg(&entities);

        // Should have nested <g> elements
        let g_count = svg.matches("<g").count();
        // Note: there's also <g transform="scale(1, -1)"> wrapper, so expecting 3 total
        assert!(
            g_count >= 2,
            "Should have at least 2 group elements (outer + inner + wrapper)"
        );
        assert!(svg.contains("<circle"));
    }

    #[test]
    fn test_hierarchical_svg_pivot_transform() {
        // Test transform with pivot
        let mut entity = make_entity(Geometry::Circle {
            center: [0.0, 0.0],
            radius: 10.0,
        });
        entity.transform = Transform {
            translate: [0.0, 0.0],
            rotate: std::f64::consts::FRAC_PI_2, // 90 degrees
            scale: [1.0, 1.0],
            pivot: [50.0, 50.0],
        };

        let svg = entity_to_svg(&entity);

        // Should have pivot translation
        assert!(svg.contains("translate(50, 50)"));
        assert!(svg.contains("rotate(90)"));
        assert!(svg.contains("translate(-50, -50)"));
    }
}
