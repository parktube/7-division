use serde::Serialize;

use crate::scene::entity::Entity;

#[derive(Serialize)]
struct SceneJson<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<&'a str>,
    entities: &'a [Entity],
    /// LLM이 마지막으로 실행한 작업
    #[serde(skip_serializing_if = "Option::is_none")]
    last_operation: Option<&'a str>,
}

pub fn serialize_scene(name: &str, entities: &[Entity], last_operation: Option<&str>) -> String {
    let scene_json = SceneJson {
        // AC3: omit the name for empty scenes to avoid implying content exists.
        name: if entities.is_empty() {
            None
        } else {
            Some(name)
        },
        entities,
        last_operation,
    };

    serde_json::to_string_pretty(&scene_json).unwrap_or_else(|err| {
        eprintln!(
            "Warning: Scene serialization failed for '{}': {}",
            name, err
        );
        r#"{"entities": []}"#.to_string()
    })
}
