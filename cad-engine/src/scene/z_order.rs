/// Z-Order 관리 모듈
///
/// 엔티티의 드로우 순서(z-order) 관련 기능을 제공합니다.
use super::Scene;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl Scene {
    // ========================================
    // Z-Order 통합 명령어 (draw_order)
    // ========================================

    /// 통합 Z-Order 명령어: Entity의 드로우 순서를 변경합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름
    /// * `mode` - 이동 모드:
    ///   - "front": 맨 앞으로
    ///   - "back": 맨 뒤로
    ///   - "+N" (예: "+1", "+2"): N단계 앞으로
    ///   - "-N" (예: "-1", "-2"): N단계 뒤로
    ///   - "above:target": target 엔티티 위로
    ///   - "below:target": target 엔티티 아래로
    ///
    /// # Returns
    /// * Ok(true) - 성공
    /// * Ok(false) - name 미발견 또는 이동 불가
    pub fn draw_order(&mut self, name: &str, mode: &str) -> Result<bool, JsValue> {
        let mode_lower = mode.trim();

        if mode_lower == "front" {
            let result = self.bring_to_front_internal(name)?;
            if result {
                let parent_id = self.find_by_name(name).and_then(|e| e.parent_id.clone());
                self.normalize_scope_z_indices(parent_id.as_deref());
            }
            return Ok(result);
        } else if mode_lower == "back" {
            let result = self.send_to_back_internal(name)?;
            if result {
                let parent_id = self.find_by_name(name).and_then(|e| e.parent_id.clone());
                self.normalize_scope_z_indices(parent_id.as_deref());
            }
            return Ok(result);
        } else if let Some(target) = mode_lower.strip_prefix("above:") {
            let result = self.move_above_internal(name, target)?;
            if result {
                let parent_id = self.find_by_name(name).and_then(|e| e.parent_id.clone());
                self.normalize_scope_z_indices(parent_id.as_deref());
            }
            return Ok(result);
        } else if let Some(target) = mode_lower.strip_prefix("below:") {
            let result = self.move_below_internal(name, target)?;
            if result {
                let parent_id = self.find_by_name(name).and_then(|e| e.parent_id.clone());
                self.normalize_scope_z_indices(parent_id.as_deref());
            }
            return Ok(result);
        } else if let Some(stripped) = mode_lower.strip_prefix('+') {
            if let Ok(steps) = stripped.parse::<i32>() {
                for _ in 0..steps {
                    if !self.bring_forward_internal(name)? {
                        break;
                    }
                }
                let parent_id = self.find_by_name(name).and_then(|e| e.parent_id.clone());
                self.normalize_scope_z_indices(parent_id.as_deref());
                return Ok(true);
            }
        } else if let Some(stripped) = mode_lower.strip_prefix('-') {
            if let Ok(steps) = stripped.parse::<i32>() {
                for _ in 0..steps {
                    if !self.send_backward_internal(name)? {
                        break;
                    }
                }
                let parent_id = self.find_by_name(name).and_then(|e| e.parent_id.clone());
                self.normalize_scope_z_indices(parent_id.as_deref());
                return Ok(true);
            }
        } else if let Ok(steps) = mode_lower.parse::<i32>() {
            if steps > 0 {
                for _ in 0..steps {
                    if !self.bring_forward_internal(name)? {
                        break;
                    }
                }
            } else if steps < 0 {
                for _ in 0..steps.abs() {
                    if !self.send_backward_internal(name)? {
                        break;
                    }
                }
            }
            // 스코프별 z-index 정규화
            let parent_id = self.find_by_name(name).and_then(|e| e.parent_id.clone());
            self.normalize_scope_z_indices(parent_id.as_deref());
            return Ok(true);
        }

        // 위 분기에서 처리 안된 경우
        Ok(false)
    }

    /// 특정 스코프의 z-index를 0, 1, 2...로 정규화
    ///
    /// parent_id가 None이면 root level, Some이면 해당 그룹의 children을 정규화
    fn normalize_scope_z_indices(&mut self, parent_id: Option<&str>) {
        // 해당 스코프의 엔티티 인덱스와 z-index 수집
        let mut scope_entities: Vec<(usize, i32)> = self
            .entities
            .iter()
            .enumerate()
            .filter(|(_, e)| e.parent_id.as_deref() == parent_id)
            .map(|(idx, e)| (idx, e.metadata.z_index))
            .collect();

        // 현재 z_index 순으로 정렬 (상대 순서 유지)
        scope_entities.sort_by_key(|(_, z)| *z);

        // 0, 1, 2...로 재할당
        for (new_z, (idx, _)) in scope_entities.iter().enumerate() {
            self.entities[*idx].metadata.z_index = new_z as i32;
        }
    }

    // ========================================
    // Z-Order 내부 구현
    // ========================================

    pub(crate) fn bring_to_front_internal(&mut self, name: &str) -> Result<bool, JsValue> {
        let entity = match self.find_by_name(name) {
            Some(e) => e,
            None => return Ok(false),
        };
        let parent_id = entity.parent_id.clone();

        let max_z = self
            .entities
            .iter()
            .filter(|e| e.parent_id == parent_id)
            .map(|e| e.metadata.z_index)
            .max()
            .unwrap_or(0);

        if let Some(e) = self.find_by_name_mut(name) {
            e.metadata.z_index = max_z + 1;
        }

        self.last_operation = Some(format!("draw_order({}, front)", name));
        Ok(true)
    }

    pub(crate) fn send_to_back_internal(&mut self, name: &str) -> Result<bool, JsValue> {
        let entity = match self.find_by_name(name) {
            Some(e) => e,
            None => return Ok(false),
        };
        let parent_id = entity.parent_id.clone();

        let min_z = self
            .entities
            .iter()
            .filter(|e| e.parent_id == parent_id)
            .map(|e| e.metadata.z_index)
            .min()
            .unwrap_or(0);

        if let Some(e) = self.find_by_name_mut(name) {
            e.metadata.z_index = min_z - 1;
        }

        self.last_operation = Some(format!("draw_order({}, back)", name));
        Ok(true)
    }

    pub(crate) fn bring_forward_internal(&mut self, name: &str) -> Result<bool, JsValue> {
        let entity = match self.find_by_name(name) {
            Some(e) => e,
            None => return Ok(false),
        };
        let parent_id = entity.parent_id.clone();
        let current_z = entity.metadata.z_index;

        let next_sibling = self
            .entities
            .iter()
            .filter(|e| e.parent_id == parent_id && e.metadata.z_index > current_z)
            .min_by_key(|e| e.metadata.z_index)
            .map(|e| (e.metadata.name.clone(), e.metadata.z_index));

        match next_sibling {
            Some((sibling_name, sibling_z)) => {
                if let Some(e) = self.find_by_name_mut(name) {
                    e.metadata.z_index = sibling_z;
                }
                if let Some(e) = self.find_by_name_mut(&sibling_name) {
                    e.metadata.z_index = current_z;
                }
                self.last_operation = Some(format!("draw_order({}, +1)", name));
                Ok(true)
            }
            None => Ok(false),
        }
    }

    pub(crate) fn send_backward_internal(&mut self, name: &str) -> Result<bool, JsValue> {
        let entity = match self.find_by_name(name) {
            Some(e) => e,
            None => return Ok(false),
        };
        let parent_id = entity.parent_id.clone();
        let current_z = entity.metadata.z_index;

        let prev_sibling = self
            .entities
            .iter()
            .filter(|e| e.parent_id == parent_id && e.metadata.z_index < current_z)
            .max_by_key(|e| e.metadata.z_index)
            .map(|e| (e.metadata.name.clone(), e.metadata.z_index));

        match prev_sibling {
            Some((sibling_name, sibling_z)) => {
                if let Some(e) = self.find_by_name_mut(name) {
                    e.metadata.z_index = sibling_z;
                }
                if let Some(e) = self.find_by_name_mut(&sibling_name) {
                    e.metadata.z_index = current_z;
                }
                self.last_operation = Some(format!("draw_order({}, -1)", name));
                Ok(true)
            }
            None => Ok(false),
        }
    }

    pub(crate) fn move_above_internal(
        &mut self,
        name: &str,
        target: &str,
    ) -> Result<bool, JsValue> {
        let entity = match self.find_by_name(name) {
            Some(e) => e,
            None => return Ok(false),
        };
        let target_entity = match self.find_by_name(target) {
            Some(e) => e,
            None => return Ok(false),
        };

        if entity.parent_id != target_entity.parent_id {
            return Ok(false);
        }

        let target_z = target_entity.metadata.z_index;

        if let Some(e) = self.find_by_name_mut(name) {
            e.metadata.z_index = target_z + 1;
        }

        self.last_operation = Some(format!("draw_order({}, above:{})", name, target));
        Ok(true)
    }

    pub(crate) fn move_below_internal(
        &mut self,
        name: &str,
        target: &str,
    ) -> Result<bool, JsValue> {
        let entity = match self.find_by_name(name) {
            Some(e) => e,
            None => return Ok(false),
        };
        let target_entity = match self.find_by_name(target) {
            Some(e) => e,
            None => return Ok(false),
        };

        if entity.parent_id != target_entity.parent_id {
            return Ok(false);
        }

        let target_z = target_entity.metadata.z_index;

        if let Some(e) = self.find_by_name_mut(name) {
            e.metadata.z_index = target_z - 1;
        }

        self.last_operation = Some(format!("draw_order({}, below:{})", name, target));
        Ok(true)
    }

    // ========================================
    // Z-Order 레거시 명령어들 (draw_order 사용 권장)
    // ========================================

    /// [Deprecated] draw_order(name, "front") 사용 권장
    pub fn bring_to_front(&mut self, name: &str) -> Result<bool, JsValue> {
        self.bring_to_front_internal(name)
    }

    /// [Deprecated] draw_order(name, "back") 사용 권장
    pub fn send_to_back(&mut self, name: &str) -> Result<bool, JsValue> {
        self.send_to_back_internal(name)
    }

    /// [Deprecated] draw_order(name, "+1") 사용 권장
    pub fn bring_forward(&mut self, name: &str) -> Result<bool, JsValue> {
        self.bring_forward_internal(name)
    }

    /// [Deprecated] draw_order(name, "-1") 사용 권장
    pub fn send_backward(&mut self, name: &str) -> Result<bool, JsValue> {
        self.send_backward_internal(name)
    }

    /// [Deprecated] draw_order(name, "above:target") 사용 권장
    pub fn move_above(&mut self, name: &str, target: &str) -> Result<bool, JsValue> {
        self.move_above_internal(name, target)
    }

    /// [Deprecated] draw_order(name, "below:target") 사용 권장
    pub fn move_below(&mut self, name: &str, target: &str) -> Result<bool, JsValue> {
        self.move_below_internal(name, target)
    }

    /// Entity의 z-order(렌더링 순서)를 직접 설정합니다.
    ///
    /// 주의: 대부분의 경우 draw_order 사용 권장
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
    pub fn get_z_order(&self, name: &str) -> Option<i32> {
        self.find_by_name(name).map(|e| e.metadata.z_index)
    }
}
