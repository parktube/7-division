//! SVG Path Parser
//!
//! Parses SVG path strings into Bezier geometry.
//! Note: Implicit command continuation is NOT supported (each coordinate pair needs explicit command).

/// Parsed bezier path result
#[derive(Debug, Clone)]
pub struct ParsedPath {
    pub start: [f64; 2],
    pub segments: Vec<[[f64; 2]; 3]>, // Each: [cp1, cp2, end]
    pub closed: bool,
}

/// Parse SVG path string to bezier segments
///
/// Supported commands (absolute and relative):
/// - M/m x,y (moveto) - sets start point
/// - C/c cp1x,cp1y cp2x,cp2y x,y (cubic bezier)
/// - S/s cp2x,cp2y x,y (smooth cubic - reflects previous cp2)
/// - Q/q cpx,cpy x,y (quadratic bezier - converted to cubic)
/// - L/l x,y (lineto - converted to bezier)
/// - Z/z (closepath)
///
/// Example: "M 0,0 C 30,50 70,50 100,0 S 170,50 200,0"
pub fn parse_svg_path(path: &str) -> Result<ParsedPath, String> {
    let tokens = tokenize(path)?;

    let mut start: Option<[f64; 2]> = None;
    let mut current: [f64; 2] = [0.0, 0.0];
    let mut segments: Vec<[[f64; 2]; 3]> = Vec::new();
    let mut last_cp2: Option<[f64; 2]> = None;
    let mut closed = false;

    let mut i = 0;
    while i < tokens.len() {
        let cmd = &tokens[i];
        i += 1;

        match cmd.as_str() {
            "M" | "m" => {
                // MoveTo: M x,y
                if i + 1 >= tokens.len() {
                    return Err("M command requires 2 coordinates".to_string());
                }
                let x = parse_num(&tokens[i])?;
                let y = parse_num(&tokens[i + 1])?;
                i += 2;

                let point = if cmd == "m" && start.is_some() {
                    [current[0] + x, current[1] + y]
                } else {
                    [x, y]
                };

                if start.is_none() {
                    start = Some(point);
                }
                current = point;
                last_cp2 = None;
            }
            "C" | "c" => {
                // Cubic Bezier: C cp1x,cp1y cp2x,cp2y x,y
                if i + 5 >= tokens.len() {
                    return Err("C command requires 6 coordinates".to_string());
                }
                let cp1x = parse_num(&tokens[i])?;
                let cp1y = parse_num(&tokens[i + 1])?;
                let cp2x = parse_num(&tokens[i + 2])?;
                let cp2y = parse_num(&tokens[i + 3])?;
                let x = parse_num(&tokens[i + 4])?;
                let y = parse_num(&tokens[i + 5])?;
                i += 6;

                let (cp1, cp2, end) = if cmd == "c" {
                    (
                        [current[0] + cp1x, current[1] + cp1y],
                        [current[0] + cp2x, current[1] + cp2y],
                        [current[0] + x, current[1] + y],
                    )
                } else {
                    ([cp1x, cp1y], [cp2x, cp2y], [x, y])
                };

                segments.push([cp1, cp2, end]);
                last_cp2 = Some(cp2);
                current = end;
            }
            "S" | "s" => {
                // Smooth Cubic: S cp2x,cp2y x,y (cp1 is reflection of previous cp2)
                if i + 3 >= tokens.len() {
                    return Err("S command requires 4 coordinates".to_string());
                }
                let cp2x = parse_num(&tokens[i])?;
                let cp2y = parse_num(&tokens[i + 1])?;
                let x = parse_num(&tokens[i + 2])?;
                let y = parse_num(&tokens[i + 3])?;
                i += 4;

                let (cp2, end) = if cmd == "s" {
                    (
                        [current[0] + cp2x, current[1] + cp2y],
                        [current[0] + x, current[1] + y],
                    )
                } else {
                    ([cp2x, cp2y], [x, y])
                };

                // Reflect previous cp2 around current point
                let cp1 = if let Some(prev_cp2) = last_cp2 {
                    [
                        2.0 * current[0] - prev_cp2[0],
                        2.0 * current[1] - prev_cp2[1],
                    ]
                } else {
                    current // No previous cp2, use current point
                };

                segments.push([cp1, cp2, end]);
                last_cp2 = Some(cp2);
                current = end;
            }
            "L" | "l" => {
                // LineTo: L x,y (convert to bezier with control points on the line)
                if i + 1 >= tokens.len() {
                    return Err("L command requires 2 coordinates".to_string());
                }
                let x = parse_num(&tokens[i])?;
                let y = parse_num(&tokens[i + 1])?;
                i += 2;

                let end = if cmd == "l" {
                    [current[0] + x, current[1] + y]
                } else {
                    [x, y]
                };

                // Convert line to cubic bezier (control points at 1/3 and 2/3)
                let cp1 = [
                    current[0] + (end[0] - current[0]) / 3.0,
                    current[1] + (end[1] - current[1]) / 3.0,
                ];
                let cp2 = [
                    current[0] + 2.0 * (end[0] - current[0]) / 3.0,
                    current[1] + 2.0 * (end[1] - current[1]) / 3.0,
                ];

                segments.push([cp1, cp2, end]);
                last_cp2 = None; // L breaks smooth continuation
                current = end;
            }
            "Q" | "q" => {
                // Quadratic Bezier: Q cpx,cpy x,y (convert to cubic)
                if i + 3 >= tokens.len() {
                    return Err("Q command requires 4 coordinates".to_string());
                }
                let cpx = parse_num(&tokens[i])?;
                let cpy = parse_num(&tokens[i + 1])?;
                let x = parse_num(&tokens[i + 2])?;
                let y = parse_num(&tokens[i + 3])?;
                i += 4;

                let (cp, end) = if cmd == "q" {
                    (
                        [current[0] + cpx, current[1] + cpy],
                        [current[0] + x, current[1] + y],
                    )
                } else {
                    ([cpx, cpy], [x, y])
                };

                // Convert quadratic to cubic
                // CP1 = P0 + 2/3 * (CP - P0)
                // CP2 = P1 + 2/3 * (CP - P1)
                let cp1 = [
                    current[0] + 2.0 / 3.0 * (cp[0] - current[0]),
                    current[1] + 2.0 / 3.0 * (cp[1] - current[1]),
                ];
                let cp2 = [
                    end[0] + 2.0 / 3.0 * (cp[0] - end[0]),
                    end[1] + 2.0 / 3.0 * (cp[1] - end[1]),
                ];

                segments.push([cp1, cp2, end]);
                last_cp2 = Some(cp2);
                current = end;
            }
            "Z" | "z" => {
                closed = true;
                // Optionally add segment back to start if not already there
                if let Some(s) = start
                    && ((current[0] - s[0]).abs() > 0.001 || (current[1] - s[1]).abs() > 0.001)
                {
                    // Add closing line segment
                    let cp1 = [
                        current[0] + (s[0] - current[0]) / 3.0,
                        current[1] + (s[1] - current[1]) / 3.0,
                    ];
                    let cp2 = [
                        current[0] + 2.0 * (s[0] - current[0]) / 3.0,
                        current[1] + 2.0 * (s[1] - current[1]) / 3.0,
                    ];
                    segments.push([cp1, cp2, s]);
                }
            }
            _ => {
                // Implicit command continuation (e.g., "M 0,0 10,10") is not supported
                // to avoid complexity and potential infinite loops
                return Err(format!(
                    "Unknown command: {}. Use explicit commands (M, C, S, Q, L, Z)",
                    cmd
                ));
            }
        }
    }

    let start = start.ok_or("Path must start with M command")?;

    if segments.is_empty() {
        return Err("Path must contain at least one curve segment (C, S, Q, or L)".to_string());
    }

    Ok(ParsedPath {
        start,
        segments,
        closed,
    })
}

/// Tokenize SVG path string
fn tokenize(path: &str) -> Result<Vec<String>, String> {
    let mut tokens = Vec::new();
    let mut current = String::new();

    for ch in path.chars() {
        match ch {
            'M' | 'm' | 'C' | 'c' | 'S' | 's' | 'L' | 'l' | 'Q' | 'q' | 'Z' | 'z' => {
                if !current.is_empty() {
                    tokens.push(current.clone());
                    current.clear();
                }
                tokens.push(ch.to_string());
            }
            ',' | ' ' | '\t' | '\n' | '\r' => {
                if !current.is_empty() {
                    tokens.push(current.clone());
                    current.clear();
                }
            }
            '-' => {
                // Minus can be part of number or separator
                if !current.is_empty() && !current.ends_with('e') && !current.ends_with('E') {
                    tokens.push(current.clone());
                    current.clear();
                }
                current.push(ch);
            }
            '0'..='9' | '.' | 'e' | 'E' | '+' => {
                current.push(ch);
            }
            _ => {
                // Ignore other characters
            }
        }
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    Ok(tokens)
}

/// Parse number from string
fn parse_num(s: &str) -> Result<f64, String> {
    s.parse::<f64>()
        .map_err(|_| format!("Invalid number: {}", s))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_cubic() {
        let path = "M 0,0 C 30,50 70,50 100,0";
        let result = parse_svg_path(path).unwrap();
        assert_eq!(result.start, [0.0, 0.0]);
        assert_eq!(result.segments.len(), 1);
        assert_eq!(result.segments[0][2], [100.0, 0.0]); // end point
        assert!(!result.closed);
    }

    #[test]
    fn test_smooth_continuation() {
        let path = "M 0,0 C 30,50 70,50 100,0 S 170,50 200,0";
        let result = parse_svg_path(path).unwrap();
        assert_eq!(result.segments.len(), 2);
        // S command should reflect cp2 of first segment
        // Previous cp2 was (70,50), current is (100,0)
        // Reflected cp1 = 2*(100,0) - (70,50) = (130,-50)
        assert_eq!(result.segments[1][0], [130.0, -50.0]);
    }

    #[test]
    fn test_closed_path() {
        let path = "M 0,0 C 50,100 100,100 100,0 Z";
        let result = parse_svg_path(path).unwrap();
        assert!(result.closed);
    }

    #[test]
    fn test_relative_commands() {
        let path = "M 100,100 c 30,50 70,50 100,0";
        let result = parse_svg_path(path).unwrap();
        assert_eq!(result.start, [100.0, 100.0]);
        assert_eq!(result.segments[0][2], [200.0, 100.0]); // relative end: 100+100, 100+0
    }
}
