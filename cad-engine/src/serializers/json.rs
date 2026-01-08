use serde::Serialize;
use std::collections::{HashMap, HashSet};

use crate::scene::Scene;
use crate::scene::entity::{Entity, EntityType};

/// 계산된 필드 (Viewer용, WASM에서 계산)
#[derive(Serialize, Clone)]
pub struct Computed {
    /// 월드 좌표계 바운딩 박스
    #[serde(skip_serializing_if = "Option::is_none")]
    pub world_bounds: Option<Bounds>,
    /// 로컬 좌표계 바운딩 박스
    #[serde(skip_serializing_if = "Option::is_none")]
    pub local_bounds: Option<Bounds>,
    /// 월드 좌표계 중심점
    #[serde(skip_serializing_if = "Option::is_none")]
    pub center: Option<[f64; 2]>,
    /// 크기 [width, height]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<[f64; 2]>,
}

#[derive(Serialize, Clone)]
pub struct Bounds {
    pub min: [f64; 2],
    pub max: [f64; 2],
}

/// Tree node for LayerPanel (Dumb View - pre-computed)
#[derive(Serialize, Clone)]
pub struct TreeNode {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub entity_type: String,
    #[serde(rename = "zOrder")]
    pub z_order: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<TreeNode>>,
}

/// Entity와 computed 필드를 함께 직렬화하는 wrapper
#[derive(Serialize)]
struct EntityWithComputed<'a> {
    #[serde(flatten)]
    entity: &'a Entity,
    computed: Computed,
}

#[derive(Serialize)]
struct SceneJson<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<&'a str>,
    entities: Vec<EntityWithComputed<'a>>,
    /// Pre-computed tree for LayerPanel (Dumb View)
    tree: Vec<TreeNode>,
    /// LLM이 마지막으로 실행한 작업
    #[serde(skip_serializing_if = "Option::is_none")]
    last_operation: Option<&'a str>,
}

/// Find entity by ID or name from lookup maps
fn find_entity_by_key<'a>(
    key: &str,
    entity_by_id: &HashMap<&str, &'a Entity>,
    entity_by_name: &HashMap<&str, &'a Entity>,
) -> Option<&'a Entity> {
    entity_by_id
        .get(key)
        .copied()
        .or_else(|| entity_by_name.get(key).copied())
}

/// Get z-order from entity
fn get_z_order(entity: &Entity) -> i32 {
    entity.metadata.z_index
}

/// Build tree structure for LayerPanel (Dumb View)
fn build_tree(entities: &[Entity]) -> Vec<TreeNode> {
    // Build lookup maps by ID and name
    let entity_by_id: HashMap<&str, &Entity> =
        entities.iter().map(|e| (e.id.as_str(), e)).collect();
    let entity_by_name: HashMap<&str, &Entity> = entities
        .iter()
        .map(|e| (e.metadata.name.as_str(), e))
        .collect();

    // Collect all child IDs (entities that belong to a group)
    let mut child_ids: HashSet<&str> = HashSet::new();
    for entity in entities {
        if entity.entity_type == EntityType::Group {
            for child_key in &entity.children {
                if let Some(child) = find_entity_by_key(child_key, &entity_by_id, &entity_by_name) {
                    child_ids.insert(&child.id);
                }
            }
        }
    }

    // Recursively convert Entity to TreeNode
    fn to_tree_node(
        entity: &Entity,
        entity_by_id: &HashMap<&str, &Entity>,
        entity_by_name: &HashMap<&str, &Entity>,
    ) -> TreeNode {
        let children = if entity.entity_type == EntityType::Group && !entity.children.is_empty() {
            let mut child_entities: Vec<(usize, &Entity)> = entity
                .children
                .iter()
                .enumerate()
                .filter_map(|(idx, key)| {
                    find_entity_by_key(key, entity_by_id, entity_by_name).map(|e| (idx, e))
                })
                .collect();

            // LayerPanel 표시 순서: 높은 z-order가 먼저 (위에 표시 = 앞에 그려짐)
            // 동일 z-order면 나중에 추가된 것이 먼저 (index 역순)
            child_entities.sort_by(|a, b| {
                let z_diff = get_z_order(b.1).cmp(&get_z_order(a.1));
                if z_diff != std::cmp::Ordering::Equal {
                    z_diff
                } else {
                    b.0.cmp(&a.0)
                }
            });

            let child_nodes: Vec<TreeNode> = child_entities
                .into_iter()
                .map(|(_, e)| to_tree_node(e, entity_by_id, entity_by_name))
                .collect();

            if child_nodes.is_empty() {
                None
            } else {
                Some(child_nodes)
            }
        } else {
            None
        };

        TreeNode {
            id: entity.id.clone(),
            name: entity.metadata.name.clone(),
            entity_type: entity.entity_type.as_str().to_string(),
            z_order: get_z_order(entity),
            children,
        }
    }

    // Get root-level entities (not children of any group)
    let mut root_entities: Vec<(usize, &Entity)> = entities
        .iter()
        .enumerate()
        .filter(|(_, e)| !child_ids.contains(e.id.as_str()))
        .collect();

    // LayerPanel 표시 순서: 높은 z-order가 먼저 (위에 표시 = 앞에 그려짐)
    // 동일 z-order면 나중에 추가된 것이 먼저 (index 역순)
    root_entities.sort_by(|a, b| {
        let z_diff = get_z_order(b.1).cmp(&get_z_order(a.1));
        if z_diff != std::cmp::Ordering::Equal {
            z_diff
        } else {
            b.0.cmp(&a.0)
        }
    });

    root_entities
        .into_iter()
        .map(|(_, e)| to_tree_node(e, &entity_by_id, &entity_by_name))
        .collect()
}

pub fn serialize_scene(scene: &Scene) -> String {
    let entities = scene.entities();

    let entities_with_computed: Vec<EntityWithComputed> = entities
        .iter()
        .map(|entity| {
            let name = &entity.metadata.name;

            // 월드 바운드 계산
            let world_bounds = scene
                .get_world_bounds_for_entity(name)
                .map(|(min, max)| Bounds { min, max });

            // 로컬 바운드 계산
            let local_bounds = scene
                .get_local_bounds_for_entity(name)
                .map(|(min, max)| Bounds { min, max });

            // center, size 계산 (world_bounds 기준)
            let (center, size) = if let Some(ref wb) = world_bounds {
                let center = [(wb.min[0] + wb.max[0]) / 2.0, (wb.min[1] + wb.max[1]) / 2.0];
                let size = [wb.max[0] - wb.min[0], wb.max[1] - wb.min[1]];
                (Some(center), Some(size))
            } else {
                (None, None)
            };

            EntityWithComputed {
                entity,
                computed: Computed {
                    world_bounds,
                    local_bounds,
                    center,
                    size,
                },
            }
        })
        .collect();

    // Build tree for LayerPanel (Dumb View)
    let tree = build_tree(entities);

    let scene_json = SceneJson {
        // AC3: omit the name for empty scenes to avoid implying content exists.
        name: if entities_with_computed.is_empty() {
            None
        } else {
            Some(scene.name())
        },
        entities: entities_with_computed,
        tree,
        last_operation: scene.last_operation(),
    };

    serde_json::to_string_pretty(&scene_json).unwrap_or_else(|err| {
        eprintln!(
            "Warning: Scene serialization failed for '{}': {}",
            scene.name(),
            err
        );
        r#"{"entities": [], "tree": []}"#.to_string()
    })
}
