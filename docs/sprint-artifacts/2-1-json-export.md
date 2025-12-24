# Story 2.1: JSON Export 기능 구현

Status: done

## Story

As a **AI 에이전트 (Claude Code)**,
I want **Scene을 JSON 형식으로 직렬화하여 파일로 저장할 수 있도록**,
So that **뷰어가 파일을 읽어 렌더링할 수 있다**.

## Acceptance Criteria

### AC1: JSON 직렬화
**Given** Scene에 여러 Entity가 추가된 상태
**When** `scene.export_json()` 호출
**Then** 전체 Scene이 JSON 문자열로 반환된다
**And** JSON에 모든 entities 배열이 포함된다
**And** 각 Entity의 id, type, geometry, transform 정보가 포함된다

### AC2: Claude Code 파일 저장
**Given** JSON 문자열이 반환된 상태
**When** Claude Code가 `fs.writeFileSync('scene.json', json)` 실행
**Then** 파일 시스템에 scene.json 파일이 생성된다
**And** 파일 내용이 유효한 JSON이다

### AC3: 빈 Scene 처리
**Given** 빈 Scene (entities가 없음)
**When** export_json() 호출
**Then** `{"entities": []}` 형태의 유효한 JSON이 반환된다

## Tasks / Subtasks

- [x] **Task 1: serializers 모듈 생성** (AC: #1)
  - [x] 1.1: `serializers/` 디렉토리 생성
  - [x] 1.2: `serializers/mod.rs` 파일 생성
  - [x] 1.3: `serializers/json.rs` 파일 생성

- [x] **Task 2: JSON Export 함수 구현** (AC: #1, #3)
  - [x] 2.1: `export_json(&self) -> String` 메서드 구현
  - [x] 2.2: serde_json::to_string_pretty() 사용
  - [x] 2.3: 빈 Scene 처리 확인

- [x] **Task 3: Scene JSON 구조 정의** (AC: #1)
  - [x] 3.1: SceneJson 구조체 정의 (name, entities 포함)
  - [x] 3.2: Entity의 serde Serialize 검증
  - [x] 3.3: 출력 JSON 포맷 문서화

- [x] **Task 4: Scene에 통합** (AC: #1, #2)
  - [x] 4.1: Scene impl에 export_json 메서드 추가
  - [x] 4.2: wasm_bindgen export 확인

- [x] **Task 5: 테스트 작성** (AC: #1, #2, #3)
  - [x] 5.1: 단일 Entity JSON 출력 테스트
  - [x] 5.2: 여러 Entity JSON 출력 테스트
  - [x] 5.3: 빈 Scene JSON 출력 테스트
  - [x] 5.4: JSON 유효성 검증 테스트

## Dev Notes

### Architecture Patterns

#### export_json 함수 시그니처

```rust
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct SceneJson<'a> {
    name: &'a str,
    entities: &'a Vec<Entity>,
}

#[wasm_bindgen]
impl Scene {
    /// Scene을 JSON 문자열로 직렬화합니다.
    ///
    /// # Returns
    /// * JSON 문자열 (뷰어 렌더링용)
    pub fn export_json(&self) -> String {
        let scene_json = SceneJson {
            name: &self.name,
            entities: &self.entities,
        };

        serde_json::to_string_pretty(&scene_json)
            .unwrap_or_else(|_| r#"{"entities": []}"#.to_string())
    }
}
```

#### 출력 JSON 포맷 (scene.json)

```json
{
  "name": "skeleton",
  "entities": [
    {
      "id": "entity_abc123",
      "entity_type": "Circle",
      "geometry": {
        "Circle": {
          "center": [0, 100],
          "radius": 10
        }
      },
      "transform": {
        "translate": [0, 0],
        "rotate": 0,
        "scale": [1, 1]
      },
      "style": {
        "stroke": {
          "width": 1.0,
          "color": [0.0, 0.0, 0.0, 1.0],
          "dash": null,
          "cap": "Butt",
          "join": "Miter"
        },
        "fill": null
      },
      "metadata": {
        "name": "head",
        "layer": null,
        "locked": false
      }
    },
    {
      "id": "entity_def456",
      "entity_type": "Line",
      "geometry": {
        "Line": {
          "points": [[0, 90], [0, 50]]
        }
      },
      "transform": {
        "translate": [0, 0],
        "rotate": 0,
        "scale": [1, 1]
      },
      "style": {
        "stroke": {
          "width": 1.0,
          "color": [0.0, 0.0, 0.0, 1.0],
          "dash": null,
          "cap": "Butt",
          "join": "Miter"
        },
        "fill": null
      },
      "metadata": {
        "name": "spine",
        "layer": null,
        "locked": false
      }
    }
  ]
}
```

#### Claude Code에서 파일 저장

```javascript
import { Scene } from './cad-engine/pkg/cad_engine.js';
import fs from 'fs';

const scene = new Scene("skeleton");
scene.add_circle("head", 0, 100, 10);  // 머리
scene.add_line("spine", new Float64Array([0, 90, 0, 50]));  // 척추

// JSON 출력 및 파일 저장
const json = scene.export_json();
fs.writeFileSync('viewer/scene.json', json);

console.log("scene.json saved for viewer");
```

### State Management (Architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│              Claude Code 세션 동안                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    Scene 인스턴스 (WASM 메모리)                                  │
│         │                                                       │
│         ├─▶ add_circle(), add_line() 등                         │
│         │   (메모리에서 빠르게 처리)                              │
│         │                                                       │
│         └─▶ export_json() 호출 시                               │
│             └─▶ scene.json 파일 저장                            │
│                 └─▶ Polling → 브라우저 갱신                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 디렉토리 구조

```
cad-engine/src/
├── lib.rs
├── scene/
│   ├── mod.rs          # export_json 메서드 추가
│   └── entity.rs
├── primitives/
│   └── ...
└── serializers/
    ├── mod.rs          # ← 이 스토리
    └── json.rs         # ← 이 스토리
```

### Project Structure Notes

- scene.json은 뷰어와의 계약 (인터페이스)
- Entity의 모든 필드가 serde Serialize를 구현해야 함
- JSON pretty print로 디버깅 용이하게

### Dependencies

- Story 1.2 (Scene 클래스 및 Entity 구조)
- Story 1.3-1.5 (도형 생성) - 선택적, 빈 Scene도 가능

## References

- [Source: docs/architecture.md#State Management - Phase 1](../architecture.md#state-management)
- [Source: docs/architecture.md#API Design - export_json](../architecture.md#api-design)
- [Source: docs/prd.md#Data Model - Scene 구조](../prd.md#data-model)
- [Source: docs/epics.md#Story 2.1](../epics.md#story-21-json-export-%EA%B8%B0%EB%8A%A5-%EA%B5%AC%ED%98%84)

## Dev Agent Record

### Context Reference

- SceneJson 래퍼로 `name`과 `entities`를 직렬화
- 빈 Scene은 `entities: []`만 포함하도록 처리

### Agent Model Used

Codex (GPT-5)

### Debug Log References

### Completion Notes List

- serializers/json.rs 추가 및 SceneJson 정의
- Scene::export_json이 String 반환 및 pretty JSON 출력
- 빈 Scene/다중 Entity JSON 테스트 추가

### Change Log

- 2025-12-22: Story 2.1 JSON export 구현 완료

### File List

- cad-engine/src/serializers/mod.rs (신규)
- cad-engine/src/serializers/json.rs (신규)
- cad-engine/src/scene/mod.rs (수정 - export_json 추가)
- cad-engine/src/lib.rs (수정 - mod serializers 추가)
