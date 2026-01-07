//! Group 관련 내부 로직
//!
//! Story 4.1~4.3에서 구현된 그룹 관련 기능:
//! - create_group: 여러 Entity를 그룹으로 묶기
//! - ungroup: 그룹 해제
//! - add_to_group: 그룹에 Entity 추가
//! - remove_from_group: 그룹에서 Entity 제거

use super::entity::{Entity, EntityType, Geometry, Metadata, Style, Transform};
use super::{Scene, SceneError, generate_id};

impl Scene {
    /// 순환 참조 검사: ancestor가 descendant의 조상인지 확인
    ///
    /// parent_id 체인을 따라가며 ancestor가 있는지 확인합니다.
    /// 최대 100단계까지만 탐색하여 무한루프를 방지합니다.
    fn is_ancestor_of(&self, ancestor: &str, descendant: &str) -> bool {
        const MAX_DEPTH: usize = 100;
        let mut current = descendant.to_string();
        let mut depth = 0;

        while depth < MAX_DEPTH {
            if let Some(entity) = self.find_by_name(&current) {
                if let Some(ref parent_id) = entity.parent_id {
                    if parent_id == ancestor {
                        return true;
                    }
                    current = parent_id.clone();
                    depth += 1;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        }
        // 최대 깊이 도달 시 안전하게 true 반환 (순환으로 간주)
        true
    }

    /// 내부용 그룹 생성 함수 (테스트용)
    pub(crate) fn create_group_internal(
        &mut self,
        name: &str,
        children_names: Vec<String>,
    ) -> Result<String, SceneError> {
        // name 중복 검사
        if self.has_entity(name) {
            return Err(SceneError::DuplicateEntityName(
                "create_group".to_string(),
                name.to_string(),
            ));
        }

        // 존재하는 자식만 필터링
        let valid_children: Vec<String> = children_names
            .into_iter()
            .filter(|child_name| self.has_entity(child_name))
            .collect();

        // 자식의 기존 부모에서 제거 + parent_id 설정
        for child_name in &valid_children {
            // 자식의 현재 parent_id 확인
            let old_parent = self
                .find_by_name(child_name)
                .and_then(|e| e.parent_id.clone());

            // 기존 부모가 있으면 그 부모의 children에서 제거
            if let Some(old_parent_name) = old_parent
                && let Some(old_parent_entity) = self.find_by_name_mut(&old_parent_name)
            {
                old_parent_entity.children.retain(|c| c != child_name);
            }

            // 자식의 parent_id를 새 그룹으로 설정
            if let Some(child_entity) = self.find_by_name_mut(child_name) {
                child_entity.parent_id = Some(name.to_string());
            }
        }

        // Group Entity 생성
        let group_entity = Entity {
            id: generate_id(),
            entity_type: EntityType::Group,
            geometry: Geometry::Empty,
            transform: Transform::default(),
            style: Style::default(),
            metadata: Metadata {
                name: name.to_string(),
                ..Default::default()
            },
            parent_id: None,
            children: valid_children,
        };

        self.entities.push(group_entity);
        self.last_operation = Some(format!("create_group({})", name));
        Ok(name.to_string())
    }

    /// 내부용 그룹 해제 함수 (테스트용)
    ///
    /// # Returns
    /// * Ok(true) - 그룹 해제 성공
    /// * Ok(false) - name이 존재하지 않음
    /// * Err - name이 Group 타입이 아님
    pub(crate) fn ungroup_internal(&mut self, name: &str) -> Result<bool, SceneError> {
        // Entity 존재 여부 확인
        let entity = match self.find_by_name(name) {
            Some(e) => e,
            None => return Ok(false),
        };

        // Group 타입 확인
        if !matches!(entity.entity_type, EntityType::Group) {
            return Err(SceneError::NotAGroup(
                "ungroup".to_string(),
                name.to_string(),
            ));
        }

        // children 목록 복사 (borrow 문제 회피)
        let children = entity.children.clone();

        // 각 자식의 parent_id를 None으로 설정
        for child_name in &children {
            if let Some(child) = self.find_by_name_mut(child_name) {
                child.parent_id = None;
            }
        }

        // 그룹 Entity 삭제
        self.entities.retain(|e| e.metadata.name != name);

        self.last_operation = Some(format!("ungroup({})", name));
        Ok(true)
    }

    /// 내부용 그룹에 자식 추가 함수 (테스트용)
    ///
    /// # 월드 위치 보존 (Story 7.5.3)
    /// addToGroup 시 엔티티의 월드 좌표가 유지됩니다.
    /// 내부적으로 역행렬 계산을 통해 새 로컬 transform을 자동 계산합니다.
    ///
    /// # Returns
    /// * Ok(true) - 추가 성공
    /// * Ok(false) - group_name 또는 entity_name이 존재하지 않음
    /// * Err - group_name이 Group 타입이 아님
    pub(crate) fn add_to_group_internal(
        &mut self,
        group_name: &str,
        entity_name: &str,
    ) -> Result<bool, SceneError> {
        // 그룹 존재 여부 확인
        let group = match self.find_by_name(group_name) {
            Some(e) => e,
            None => return Ok(false),
        };

        // Group 타입 확인
        if !matches!(group.entity_type, EntityType::Group) {
            return Err(SceneError::NotAGroup(
                "add_to_group".to_string(),
                group_name.to_string(),
            ));
        }

        // 추가할 Entity 존재 여부 확인
        if !self.has_entity(entity_name) {
            return Ok(false);
        }

        // 순환 참조 방지: entity_name이 group_name의 조상인지 확인
        if self.is_ancestor_of(entity_name, group_name) {
            return Err(SceneError::InvalidOperation(format!(
                "Cannot add '{}' to '{}': would create circular reference",
                entity_name, group_name
            )));
        }

        // ============================================
        // 월드 위치 보존 로직 (Story 7.5.3)
        // ============================================
        // 1. entity의 현재 월드 transform 저장
        // 2. 부모 그룹의 월드 transform 역행렬 계산
        // 3. 새 로컬 transform = 역행렬 × entity 월드 transform

        // Entity의 현재 월드 transform 저장
        let entity_world_matrix = self.get_world_transform_internal(entity_name);

        // 부모 그룹의 월드 transform 저장
        let group_world_matrix = self.get_world_transform_internal(group_name);

        // 자식의 기존 부모에서 제거
        let old_parent = self
            .find_by_name(entity_name)
            .and_then(|e| e.parent_id.clone());

        if let Some(old_parent_name) = old_parent
            && let Some(old_parent_entity) = self.find_by_name_mut(&old_parent_name)
        {
            old_parent_entity.children.retain(|c| c != entity_name);
        }

        // 새 로컬 transform 계산 및 적용
        if let (Some(entity_world), Some(group_world)) = (entity_world_matrix, group_world_matrix) {
            // 부모 그룹의 역행렬
            if let Some(group_inverse) = Transform::inverse_matrix(&group_world) {
                // 새 로컬 = 그룹역행렬 × 엔티티월드
                let new_local_matrix = Transform::multiply_matrices(&group_inverse, &entity_world);
                let new_transform = Transform::from_matrix(&new_local_matrix);

                // transform 업데이트
                if let Some(child) = self.find_by_name_mut(entity_name) {
                    child.transform = new_transform;
                    child.parent_id = Some(group_name.to_string());
                }
            } else {
                // 역행렬 계산 실패 시 기존 동작 (parent_id만 변경)
                if let Some(child) = self.find_by_name_mut(entity_name) {
                    child.parent_id = Some(group_name.to_string());
                }
            }
        } else {
            // 월드 transform 없으면 기존 동작
            if let Some(child) = self.find_by_name_mut(entity_name) {
                child.parent_id = Some(group_name.to_string());
            }
        }

        // 그룹의 children에 추가
        if let Some(group) = self.find_by_name_mut(group_name)
            && !group.children.contains(&entity_name.to_string())
        {
            group.children.push(entity_name.to_string());
        }

        self.last_operation = Some(format!("add_to_group({}, {})", group_name, entity_name));
        Ok(true)
    }

    /// 내부용 그룹에서 자식 제거 함수 (테스트용)
    ///
    /// # Returns
    /// * Ok(true) - 제거 성공
    /// * Ok(false) - group_name 또는 entity_name이 존재하지 않음, 또는 entity가 해당 그룹의 자식이 아님
    /// * Err - group_name이 Group 타입이 아님
    pub(crate) fn remove_from_group_internal(
        &mut self,
        group_name: &str,
        entity_name: &str,
    ) -> Result<bool, SceneError> {
        // 그룹 존재 여부 확인
        let group = match self.find_by_name(group_name) {
            Some(e) => e,
            None => return Ok(false),
        };

        // Group 타입 확인
        if !matches!(group.entity_type, EntityType::Group) {
            return Err(SceneError::NotAGroup(
                "remove_from_group".to_string(),
                group_name.to_string(),
            ));
        }

        // Entity 존재 여부 확인
        let entity = match self.find_by_name(entity_name) {
            Some(e) => e,
            None => return Ok(false),
        };

        // 해당 그룹의 자식인지 확인
        if entity.parent_id.as_deref() != Some(group_name) {
            return Ok(false);
        }

        // Entity의 parent_id 해제
        if let Some(child) = self.find_by_name_mut(entity_name) {
            child.parent_id = None;
        }

        // 그룹의 children에서 제거
        if let Some(group) = self.find_by_name_mut(group_name) {
            group.children.retain(|c| c != entity_name);
        }

        self.last_operation = Some(format!(
            "remove_from_group({}, {})",
            group_name, entity_name
        ));
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // 테스트 헬퍼: 기본 Circle Entity 생성
    fn add_test_circle(scene: &mut Scene, name: &str) {
        scene
            .add_circle_internal(name, 0.0, 0.0, 10.0)
            .expect("Failed to add circle");
    }

    // ========================================
    // create_group 테스트
    // ========================================

    #[test]
    fn test_create_group_basic() {
        let mut scene = Scene::new("test");

        // Circle 2개 생성
        add_test_circle(&mut scene, "c1");
        add_test_circle(&mut scene, "c2");

        // 그룹 생성
        let result = scene.create_group_internal("grp", vec!["c1".to_string(), "c2".to_string()]);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "grp");

        // 그룹 Entity 확인
        let group = scene.find_by_name("grp").expect("Group not found");
        assert!(matches!(group.entity_type, EntityType::Group));
        assert!(matches!(group.geometry, Geometry::Empty));
        assert_eq!(group.children.len(), 2);
        assert!(group.children.contains(&"c1".to_string()));
        assert!(group.children.contains(&"c2".to_string()));

        // 자식의 parent_id 확인
        let c1 = scene.find_by_name("c1").expect("c1 not found");
        assert_eq!(c1.parent_id, Some("grp".to_string()));

        let c2 = scene.find_by_name("c2").expect("c2 not found");
        assert_eq!(c2.parent_id, Some("grp".to_string()));

        // last_operation 확인
        assert_eq!(scene.last_operation, Some("create_group(grp)".to_string()));
    }

    #[test]
    fn test_create_group_nonexistent_children() {
        let mut scene = Scene::new("test");

        add_test_circle(&mut scene, "c1");

        // 존재하지 않는 자식 포함하여 그룹 생성
        let result =
            scene.create_group_internal("grp", vec!["c1".to_string(), "nonexistent".to_string()]);
        assert!(result.is_ok());

        // 존재하는 자식만 포함되어야 함
        let group = scene.find_by_name("grp").expect("Group not found");
        assert_eq!(group.children.len(), 1);
        assert!(group.children.contains(&"c1".to_string()));
    }

    #[test]
    fn test_create_group_empty_children() {
        let mut scene = Scene::new("test");

        // 빈 자식으로 그룹 생성
        let result = scene.create_group_internal("empty_grp", vec![]);
        assert!(result.is_ok());

        let group = scene.find_by_name("empty_grp").expect("Group not found");
        assert!(group.children.is_empty());
    }

    #[test]
    fn test_create_group_duplicate_name_error() {
        let mut scene = Scene::new("test");

        add_test_circle(&mut scene, "existing");

        // 이미 존재하는 이름으로 그룹 생성 시도
        let result = scene.create_group_internal("existing", vec![]);
        assert!(result.is_err());

        let err = result.unwrap_err();
        assert!(matches!(err, SceneError::DuplicateEntityName(_, _)));
    }

    #[test]
    fn test_create_group_nested() {
        let mut scene = Scene::new("test");

        add_test_circle(&mut scene, "c1");
        add_test_circle(&mut scene, "c2");

        // 첫 번째 그룹 생성
        scene
            .create_group_internal("inner", vec!["c1".to_string()])
            .unwrap();

        // 중첩 그룹 생성 (inner 그룹을 포함)
        scene
            .create_group_internal("outer", vec!["inner".to_string(), "c2".to_string()])
            .unwrap();

        // outer 그룹 확인
        let outer = scene.find_by_name("outer").expect("outer not found");
        assert_eq!(outer.children.len(), 2);

        // inner 그룹의 parent_id 확인
        let inner = scene.find_by_name("inner").expect("inner not found");
        assert_eq!(inner.parent_id, Some("outer".to_string()));
    }

    #[test]
    fn test_create_group_move_child_between_groups() {
        let mut scene = Scene::new("test");

        add_test_circle(&mut scene, "c1");

        // 첫 번째 그룹에 c1 추가
        scene
            .create_group_internal("grp1", vec!["c1".to_string()])
            .unwrap();

        // 두 번째 그룹에 c1 추가 (이동)
        scene
            .create_group_internal("grp2", vec!["c1".to_string()])
            .unwrap();

        // c1은 grp2의 자식이어야 함
        let c1 = scene.find_by_name("c1").expect("c1 not found");
        assert_eq!(c1.parent_id, Some("grp2".to_string()));

        // grp1에서는 c1이 제거되어야 함
        let grp1 = scene.find_by_name("grp1").expect("grp1 not found");
        assert!(!grp1.children.contains(&"c1".to_string()));

        // grp2에는 c1이 있어야 함
        let grp2 = scene.find_by_name("grp2").expect("grp2 not found");
        assert!(grp2.children.contains(&"c1".to_string()));
    }

    #[test]
    fn test_create_group_json_serialization() {
        let mut scene = Scene::new("test");

        add_test_circle(&mut scene, "c1");

        scene
            .create_group_internal("grp", vec!["c1".to_string()])
            .unwrap();

        // JSON 직렬화 확인 (pretty print로 공백 포함)
        let json = scene.export_json();
        assert!(json.contains("\"entity_type\": \"Group\""));
        assert!(json.contains("\"c1\"")); // children 배열에 c1 포함
        assert!(json.contains("\"parent_id\": \"grp\""));
    }

    // ========================================
    // ungroup 테스트
    // ========================================

    #[test]
    fn test_ungroup_basic() {
        let mut scene = Scene::new("test");

        add_test_circle(&mut scene, "c1");
        add_test_circle(&mut scene, "c2");

        scene
            .create_group_internal("grp", vec!["c1".to_string(), "c2".to_string()])
            .unwrap();

        // 그룹 해제
        let result = scene.ungroup_internal("grp");
        assert!(result.is_ok());
        assert!(result.unwrap());

        // 그룹이 삭제되었는지 확인
        assert!(scene.find_by_name("grp").is_none());

        // 자식들의 parent_id가 None인지 확인
        let c1 = scene.find_by_name("c1").expect("c1 not found");
        assert!(c1.parent_id.is_none());

        let c2 = scene.find_by_name("c2").expect("c2 not found");
        assert!(c2.parent_id.is_none());

        // last_operation 확인
        assert_eq!(scene.last_operation, Some("ungroup(grp)".to_string()));
    }

    #[test]
    fn test_ungroup_not_found() {
        let mut scene = Scene::new("test");

        // 존재하지 않는 그룹 해제 시도
        let result = scene.ungroup_internal("nonexistent");
        assert!(result.is_ok());
        assert!(!result.unwrap()); // false 반환
    }

    #[test]
    fn test_ungroup_not_a_group() {
        let mut scene = Scene::new("test");

        add_test_circle(&mut scene, "circle");

        // Circle에 ungroup 시도
        let result = scene.ungroup_internal("circle");
        assert!(result.is_err());

        let err = result.unwrap_err();
        assert!(matches!(err, SceneError::NotAGroup(_, _)));
    }

    #[test]
    fn test_ungroup_nested() {
        let mut scene = Scene::new("test");

        add_test_circle(&mut scene, "c1");

        // 중첩 그룹 생성
        scene
            .create_group_internal("inner", vec!["c1".to_string()])
            .unwrap();
        scene
            .create_group_internal("outer", vec!["inner".to_string()])
            .unwrap();

        // outer 해제
        scene.ungroup_internal("outer").unwrap();

        // outer는 삭제됨
        assert!(scene.find_by_name("outer").is_none());

        // inner의 parent_id는 None
        let inner = scene.find_by_name("inner").expect("inner not found");
        assert!(inner.parent_id.is_none());

        // c1은 여전히 inner의 자식
        let c1 = scene.find_by_name("c1").expect("c1 not found");
        assert_eq!(c1.parent_id, Some("inner".to_string()));
    }

    #[test]
    fn test_ungroup_empty_group() {
        let mut scene = Scene::new("test");

        // 빈 그룹 생성 후 해제
        scene.create_group_internal("empty", vec![]).unwrap();
        let result = scene.ungroup_internal("empty");
        assert!(result.is_ok());
        assert!(result.unwrap());

        assert!(scene.find_by_name("empty").is_none());
    }

    #[test]
    fn test_ungroup_json_serialization() {
        let mut scene = Scene::new("test");

        add_test_circle(&mut scene, "c1");

        scene
            .create_group_internal("grp", vec!["c1".to_string()])
            .unwrap();
        scene.ungroup_internal("grp").unwrap();

        // JSON에서 그룹이 없어야 함
        let json = scene.export_json();
        assert!(!json.contains("\"entity_type\": \"Group\""));

        // c1의 parent_id가 없어야 함 (skip_serializing_if로 None일 때 생략됨)
        // parent_id는 c1 엔티티에 없어야 함
        assert!(!json.contains("\"parent_id\""));
    }

    // ========================================
    // add_to_group 테스트
    // ========================================

    #[test]
    fn test_add_to_group_basic() {
        let mut scene = Scene::new("test");

        add_test_circle(&mut scene, "c1");
        scene.create_group_internal("grp", vec![]).unwrap();

        // 그룹에 추가
        let result = scene.add_to_group_internal("grp", "c1");
        assert!(result.is_ok());
        assert!(result.unwrap());

        // 그룹의 children 확인
        let grp = scene.find_by_name("grp").expect("grp not found");
        assert!(grp.children.contains(&"c1".to_string()));

        // c1의 parent_id 확인
        let c1 = scene.find_by_name("c1").expect("c1 not found");
        assert_eq!(c1.parent_id, Some("grp".to_string()));
    }

    #[test]
    fn test_add_to_group_not_found() {
        let mut scene = Scene::new("test");

        scene.create_group_internal("grp", vec![]).unwrap();

        // 존재하지 않는 entity 추가 시도
        let result = scene.add_to_group_internal("grp", "nonexistent");
        assert!(result.is_ok());
        assert!(!result.unwrap());

        // 존재하지 않는 그룹에 추가 시도
        add_test_circle(&mut scene, "c1");
        let result = scene.add_to_group_internal("nonexistent", "c1");
        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    #[test]
    fn test_add_to_group_not_a_group() {
        let mut scene = Scene::new("test");

        add_test_circle(&mut scene, "c1");
        add_test_circle(&mut scene, "c2");

        // Circle에 추가 시도
        let result = scene.add_to_group_internal("c1", "c2");
        assert!(result.is_err());

        let err = result.unwrap_err();
        assert!(matches!(err, SceneError::NotAGroup(_, _)));
    }

    #[test]
    fn test_add_to_group_move_between_groups() {
        let mut scene = Scene::new("test");

        add_test_circle(&mut scene, "c1");
        scene
            .create_group_internal("grp1", vec!["c1".to_string()])
            .unwrap();
        scene.create_group_internal("grp2", vec![]).unwrap();

        // grp2로 이동
        scene.add_to_group_internal("grp2", "c1").unwrap();

        // grp1에서 제거됨
        let grp1 = scene.find_by_name("grp1").expect("grp1 not found");
        assert!(!grp1.children.contains(&"c1".to_string()));

        // grp2에 추가됨
        let grp2 = scene.find_by_name("grp2").expect("grp2 not found");
        assert!(grp2.children.contains(&"c1".to_string()));

        // c1의 parent_id 변경
        let c1 = scene.find_by_name("c1").expect("c1 not found");
        assert_eq!(c1.parent_id, Some("grp2".to_string()));
    }

    #[test]
    fn test_add_to_group_duplicate() {
        let mut scene = Scene::new("test");

        add_test_circle(&mut scene, "c1");
        scene
            .create_group_internal("grp", vec!["c1".to_string()])
            .unwrap();

        // 이미 있는 entity 다시 추가
        scene.add_to_group_internal("grp", "c1").unwrap();

        // children에 중복 없어야 함
        let grp = scene.find_by_name("grp").expect("grp not found");
        assert_eq!(grp.children.len(), 1);
    }

    // ========================================
    // remove_from_group 테스트
    // ========================================

    #[test]
    fn test_remove_from_group_basic() {
        let mut scene = Scene::new("test");

        add_test_circle(&mut scene, "c1");
        scene
            .create_group_internal("grp", vec!["c1".to_string()])
            .unwrap();

        // 그룹에서 제거
        let result = scene.remove_from_group_internal("grp", "c1");
        assert!(result.is_ok());
        assert!(result.unwrap());

        // 그룹의 children에서 제거됨
        let grp = scene.find_by_name("grp").expect("grp not found");
        assert!(!grp.children.contains(&"c1".to_string()));

        // c1의 parent_id가 None
        let c1 = scene.find_by_name("c1").expect("c1 not found");
        assert!(c1.parent_id.is_none());
    }

    #[test]
    fn test_remove_from_group_not_found() {
        let mut scene = Scene::new("test");

        scene.create_group_internal("grp", vec![]).unwrap();

        // 존재하지 않는 entity 제거 시도
        let result = scene.remove_from_group_internal("grp", "nonexistent");
        assert!(result.is_ok());
        assert!(!result.unwrap());

        // 존재하지 않는 그룹에서 제거 시도
        add_test_circle(&mut scene, "c1");
        let result = scene.remove_from_group_internal("nonexistent", "c1");
        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    #[test]
    fn test_remove_from_group_not_a_group() {
        let mut scene = Scene::new("test");

        add_test_circle(&mut scene, "c1");
        add_test_circle(&mut scene, "c2");

        // Circle에서 제거 시도
        let result = scene.remove_from_group_internal("c1", "c2");
        assert!(result.is_err());

        let err = result.unwrap_err();
        assert!(matches!(err, SceneError::NotAGroup(_, _)));
    }

    #[test]
    fn test_remove_from_group_not_a_child() {
        let mut scene = Scene::new("test");

        add_test_circle(&mut scene, "c1");
        add_test_circle(&mut scene, "c2");
        scene
            .create_group_internal("grp", vec!["c1".to_string()])
            .unwrap();

        // 그룹의 자식이 아닌 entity 제거 시도
        let result = scene.remove_from_group_internal("grp", "c2");
        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    #[test]
    fn test_remove_from_group_independent_entity() {
        let mut scene = Scene::new("test");

        add_test_circle(&mut scene, "c1");
        scene.create_group_internal("grp", vec![]).unwrap();

        // 독립 entity를 그룹에서 제거 시도 (parent_id가 None)
        let result = scene.remove_from_group_internal("grp", "c1");
        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    // ========================================
    // 월드 위치 유지 테스트 (Story 7.5.3)
    // ========================================

    /// 월드 좌표 비교 헬퍼 (오차 허용)
    fn approx_eq(a: f64, b: f64) -> bool {
        (a - b).abs() < 0.01
    }

    /// 엔티티에 translate 적용 헬퍼
    fn apply_translate(scene: &mut Scene, name: &str, dx: f64, dy: f64) {
        if let Some(entity) = scene.find_by_name_mut(name) {
            entity.transform.translate[0] += dx;
            entity.transform.translate[1] += dy;
        }
    }

    /// 엔티티에 scale 적용 헬퍼
    fn apply_scale(scene: &mut Scene, name: &str, sx: f64, sy: f64) {
        if let Some(entity) = scene.find_by_name_mut(name) {
            entity.transform.scale[0] *= sx;
            entity.transform.scale[1] *= sy;
        }
    }

    #[test]
    fn test_add_to_group_preserves_world_position_simple() {
        let mut scene = Scene::new("test");

        // 그룹 생성: translate(-80, -10)
        scene.create_group_internal("house", vec![]).unwrap();
        apply_translate(&mut scene, "house", -80.0, -10.0);

        // 창문 생성: world position (100, 50)
        scene
            .add_rect_internal("window", 100.0, 50.0, 20.0, 30.0)
            .unwrap();

        // addToGroup 전 world bounds 저장
        let before_bounds = scene.get_world_bounds_internal("window").unwrap();

        // 그룹에 추가
        scene.add_to_group_internal("house", "window").unwrap();

        // addToGroup 후 world bounds 확인
        let after_bounds = scene.get_world_bounds_internal("window").unwrap();

        // 월드 위치가 동일해야 함
        assert!(
            approx_eq(before_bounds.0[0], after_bounds.0[0]),
            "min_x: before={}, after={}",
            before_bounds.0[0],
            after_bounds.0[0]
        );
        assert!(
            approx_eq(before_bounds.0[1], after_bounds.0[1]),
            "min_y: before={}, after={}",
            before_bounds.0[1],
            after_bounds.0[1]
        );
        assert!(
            approx_eq(before_bounds.1[0], after_bounds.1[0]),
            "max_x: before={}, after={}",
            before_bounds.1[0],
            after_bounds.1[0]
        );
        assert!(
            approx_eq(before_bounds.1[1], after_bounds.1[1]),
            "max_y: before={}, after={}",
            before_bounds.1[1],
            after_bounds.1[1]
        );
    }

    #[test]
    fn test_add_to_group_preserves_world_position_with_scale() {
        let mut scene = Scene::new("test");

        // 그룹 생성: scale(2, 2) + translate(10, 10)
        scene.create_group_internal("scaled_grp", vec![]).unwrap();
        apply_scale(&mut scene, "scaled_grp", 2.0, 2.0);
        apply_translate(&mut scene, "scaled_grp", 10.0, 10.0);

        // 원 생성
        scene.add_circle_internal("c1", 50.0, 50.0, 10.0).unwrap();

        // addToGroup 전 world bounds 저장
        let before_bounds = scene.get_world_bounds_internal("c1").unwrap();

        // 그룹에 추가
        scene.add_to_group_internal("scaled_grp", "c1").unwrap();

        // addToGroup 후 world bounds 확인
        let after_bounds = scene.get_world_bounds_internal("c1").unwrap();

        // 월드 위치가 동일해야 함
        assert!(
            approx_eq(before_bounds.0[0], after_bounds.0[0]),
            "min_x differs: {} vs {}",
            before_bounds.0[0],
            after_bounds.0[0]
        );
        assert!(
            approx_eq(before_bounds.0[1], after_bounds.0[1]),
            "min_y differs: {} vs {}",
            before_bounds.0[1],
            after_bounds.0[1]
        );
    }

    #[test]
    fn test_add_to_group_preserves_world_position_nested() {
        let mut scene = Scene::new("test");

        // 중첩 그룹: outer contains inner
        scene.create_group_internal("inner", vec![]).unwrap();
        apply_translate(&mut scene, "inner", 20.0, 0.0);
        scene
            .create_group_internal("outer", vec!["inner".to_string()])
            .unwrap();
        apply_translate(&mut scene, "outer", 100.0, 100.0);

        // 원 생성: world position (50, 50)
        scene.add_circle_internal("c1", 50.0, 50.0, 5.0).unwrap();

        // addToGroup 전 world bounds 저장
        let before_bounds = scene.get_world_bounds_internal("c1").unwrap();

        // inner 그룹에 추가 (3레벨 중첩)
        scene.add_to_group_internal("inner", "c1").unwrap();

        // addToGroup 후 world bounds 확인
        let after_bounds = scene.get_world_bounds_internal("c1").unwrap();

        // 월드 위치가 동일해야 함
        assert!(
            approx_eq(before_bounds.0[0], after_bounds.0[0]),
            "min_x differs: {} vs {}",
            before_bounds.0[0],
            after_bounds.0[0]
        );
        assert!(
            approx_eq(before_bounds.0[1], after_bounds.0[1]),
            "min_y differs: {} vs {}",
            before_bounds.0[1],
            after_bounds.0[1]
        );
    }

    #[test]
    fn test_add_to_group_move_between_groups_preserves_position() {
        let mut scene = Scene::new("test");

        // 두 그룹 생성
        scene.create_group_internal("grp1", vec![]).unwrap();
        apply_translate(&mut scene, "grp1", 10.0, 10.0);

        scene.create_group_internal("grp2", vec![]).unwrap();
        apply_translate(&mut scene, "grp2", -50.0, -50.0);

        // 원을 grp1에 추가
        scene.add_circle_internal("c1", 0.0, 0.0, 10.0).unwrap();
        scene.add_to_group_internal("grp1", "c1").unwrap();

        // 이동 후 world bounds 저장
        let before_bounds = scene.get_world_bounds_internal("c1").unwrap();

        // grp1에서 grp2로 이동
        scene.add_to_group_internal("grp2", "c1").unwrap();

        // world bounds 확인
        let after_bounds = scene.get_world_bounds_internal("c1").unwrap();

        // 월드 위치가 동일해야 함
        assert!(
            approx_eq(before_bounds.0[0], after_bounds.0[0]),
            "min_x differs: {} vs {}",
            before_bounds.0[0],
            after_bounds.0[0]
        );
        assert!(
            approx_eq(before_bounds.0[1], after_bounds.0[1]),
            "min_y differs: {} vs {}",
            before_bounds.0[1],
            after_bounds.0[1]
        );
    }
}
