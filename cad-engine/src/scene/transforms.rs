/// Transform 관리 모듈
///
/// 엔티티의 변환(translate, rotate, scale) 관련 기능을 제공합니다.
use super::Scene;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl Scene {
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

        entity.transform.rotate += angle;

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
    ///
    /// # Note
    /// 0 이하의 스케일 값은 자동으로 양수(최소 0.001)로 보정됩니다.
    /// 예: scale("e", -2, 0) → 실제 적용: (2.0, 0.001)
    pub fn scale(&mut self, name: &str, sx: f64, sy: f64) -> Result<bool, JsValue> {
        let entity = match self.find_by_name_mut(name) {
            Some(e) => e,
            None => return Ok(false),
        };

        // 관대한 입력 보정: 0 이하는 abs().max(0.001)로 변환
        let sx = if sx <= 0.0 { sx.abs().max(0.001) } else { sx };
        let sy = if sy <= 0.0 { sy.abs().max(0.001) } else { sy };

        entity.transform.scale[0] *= sx;
        entity.transform.scale[1] *= sy;

        self.last_operation = Some(format!("scale({}, {}x, {}x)", name, sx, sy));
        Ok(true)
    }

    /// Entity를 월드 좌표 기준으로 이동합니다.
    ///
    /// 부모 그룹의 scale을 역산하여 로컬 delta로 변환 후 적용합니다.
    pub fn translate_world(&mut self, name: &str, dx: f64, dy: f64) -> Result<bool, JsValue> {
        let parent_scale = self.get_parent_world_scale(name);
        let local_dx = dx / parent_scale[0];
        let local_dy = dy / parent_scale[1];
        self.translate(name, local_dx, local_dy)
    }

    /// Entity를 월드 좌표 기준으로 스케일합니다.
    ///
    /// 부모 그룹의 scale을 역산하여 로컬 scale로 변환 후 적용합니다.
    pub fn scale_world(&mut self, name: &str, sx: f64, sy: f64) -> Result<bool, JsValue> {
        let parent_scale = self.get_parent_world_scale(name);
        let local_sx = sx / parent_scale[0];
        let local_sy = sy / parent_scale[1];
        self.scale(name, local_sx, local_sy)
    }

    /// Entity를 삭제합니다.
    ///
    /// Group 삭제 시 자식들의 parent_id를 정리하고,
    /// 부모가 있는 경우 부모의 children 목록에서 제거합니다.
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
                // 삭제 전에 parent_id와 children 정보 저장
                let parent_id = self.entities[i].parent_id.clone();
                let children = self.entities[i].children.clone();

                // 1. 자식들의 parent_id를 None으로 설정 (고아가 됨)
                for child_name in &children {
                    if let Some(child) = self.find_by_name_mut(child_name) {
                        child.parent_id = None;
                    }
                }

                // 2. 부모의 children 목록에서 자신 제거
                if let Some(ref parent_name) = parent_id
                    && let Some(parent) = self.find_by_name_mut(parent_name)
                {
                    parent.children.retain(|c| c != name);
                }

                // 3. 엔티티 삭제 (인덱스로 다시 찾아야 함 - 위에서 borrow 해제됨)
                if let Some(idx) = self.entities.iter().position(|e| e.metadata.name == name) {
                    self.entities.remove(idx);
                    self.last_operation = Some(format!("delete({})", name));
                    Ok(true)
                } else {
                    // 방어적 처리: 논리적으로 도달하지 않아야 하나, 안전하게 false 반환
                    Ok(false)
                }
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
    pub fn set_pivot(&mut self, name: &str, px: f64, py: f64) -> Result<bool, JsValue> {
        self.set_pivot_internal(name, px, py)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// 부모의 누적 world scale을 반환합니다.
    fn get_parent_world_scale(&self, name: &str) -> [f64; 2] {
        // Find entity and its parent
        let entity = match self.find_by_name(name) {
            Some(e) => e,
            None => return [1.0, 1.0],
        };

        let parent_id = match &entity.parent_id {
            Some(id) => id.clone(),
            None => return [1.0, 1.0], // Root entity
        };

        // Get parent's world transform
        if let Some(matrix) = self.get_world_transform_internal(&parent_id) {
            // Extract scale from matrix
            // For a 2D affine matrix [[a, b, tx], [c, d, ty], [0, 0, 1]]
            // scale_x = sqrt(a^2 + c^2), scale_y = sqrt(b^2 + d^2)
            let scale_x = (matrix[0][0] * matrix[0][0] + matrix[1][0] * matrix[1][0]).sqrt();
            let scale_y = (matrix[0][1] * matrix[0][1] + matrix[1][1] * matrix[1][1]).sqrt();
            [scale_x.max(0.001), scale_y.max(0.001)]
        } else {
            [1.0, 1.0]
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Scene;

    // ========================================
    // Story 4-4: set_pivot Tests
    // ========================================

    #[test]
    fn test_set_pivot_basic() {
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
        let mut scene = Scene::new("test");

        let result = scene.set_pivot_internal("nonexistent", 5.0, 10.0);
        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    #[test]
    fn test_set_pivot_negative_values() {
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
        let mut scene = Scene::new("test");
        scene.add_circle_internal("c1", 0.0, 0.0, 10.0).unwrap();

        let json = scene.export_json();
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        let entities = value.get("entities").unwrap().as_array().unwrap();
        let c1 = &entities[0];
        let transform = c1.get("transform").unwrap();
        assert!(transform.get("pivot").is_none());
    }

    #[test]
    fn test_set_pivot_nan_infinity() {
        let mut scene = Scene::new("test");
        scene.add_circle_internal("c1", 0.0, 0.0, 10.0).unwrap();

        assert!(scene.set_pivot_internal("c1", f64::NAN, 0.0).is_err());
        assert!(scene.set_pivot_internal("c1", 0.0, f64::INFINITY).is_err());
        assert!(
            scene
                .set_pivot_internal("c1", f64::NEG_INFINITY, 0.0)
                .is_err()
        );
        assert!(scene.set_pivot_internal("c1", 5.0, 10.0).is_ok());
    }
}
