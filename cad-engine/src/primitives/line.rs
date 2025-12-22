/// Line 도형 생성을 위한 유틸리티 함수들
///
/// AX 원칙: AI가 Float64Array로 좌표를 전달하면 내부적으로 Vec<[f64; 2]>로 변환

/// Float64Array에서 추출한 좌표 벡터를 [f64; 2] 배열의 벡터로 변환
///
/// # Arguments
/// * `coords` - [x1, y1, x2, y2, ...] 형태의 좌표 벡터
///
/// # Returns
/// * Ok(Vec<[f64; 2]>) - 성공 시 점 배열
/// * Err(String) - 최소 2점 미만일 경우 에러
///
/// # 입력 보정 정책 (AC3)
/// 홀수 개 좌표가 주어지면 마지막 좌표를 무시하고 정상 처리 (관대한 입력 보정)
pub fn parse_line_points(coords: Vec<f64>) -> Result<Vec<[f64; 2]>, String> {
    // 빈 입력 또는 너무 적은 좌표 조기 리턴
    if coords.len() < 4 {
        return Err("At least 2 points required".to_string());
    }

    // 홀수일 경우 마지막 좌표 무시 (AC3: 관대한 입력 보정)
    // saturating_sub로 의도 명확화 (빈 입력은 위에서 이미 처리됨)
    let valid_len = if coords.len() % 2 != 0 {
        coords.len().saturating_sub(1)
    } else {
        coords.len()
    };

    let points: Vec<[f64; 2]> = coords[..valid_len]
        .chunks(2)
        .map(|chunk| [chunk[0], chunk[1]])
        .collect();

    Ok(points)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_two_points() {
        let coords = vec![0.0, 100.0, 0.0, 50.0];
        let result = parse_line_points(coords).unwrap();
        assert_eq!(result, vec![[0.0, 100.0], [0.0, 50.0]]);
    }

    #[test]
    fn test_parse_polyline() {
        let coords = vec![0.0, 85.0, -20.0, 70.0, -25.0, 50.0];
        let result = parse_line_points(coords).unwrap();
        assert_eq!(
            result,
            vec![[0.0, 85.0], [-20.0, 70.0], [-25.0, 50.0]]
        );
    }

    #[test]
    fn test_parse_odd_coordinates_drops_last() {
        // 홀수 좌표: 마지막 무시
        let coords = vec![0.0, 100.0, 0.0, 50.0, 999.0];
        let result = parse_line_points(coords).unwrap();
        assert_eq!(result, vec![[0.0, 100.0], [0.0, 50.0]]);
    }

    #[test]
    fn test_parse_too_few_points_error() {
        // 2개 미만 (1점만) -> 에러
        let coords = vec![0.0, 100.0];
        let result = parse_line_points(coords);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "At least 2 points required");
    }

    #[test]
    fn test_parse_odd_with_too_few_points() {
        // 3개 값 -> 조기 리턴으로 에러 (4개 미만)
        let coords = vec![0.0, 100.0, 999.0];
        let result = parse_line_points(coords);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "At least 2 points required");
    }
}
