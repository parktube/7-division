# Story 3.6: SVG Export 구현

Status: done

## Story

As a **AI 에이전트 (Claude Code)**,
I want **Scene을 SVG 형식으로 내보낼 수 있도록**,
So that **최종 결과물을 벡터 이미지로 저장하고 공유할 수 있다**.

## Acceptance Criteria

### AC1: 기본 SVG 출력
**Given** Scene에 여러 Entity가 있는 상태
**When** `scene.export_svg()` 호출
**Then** 유효한 SVG 문자열이 반환된다
**And** SVG 문자열이 `<svg>` 태그로 시작한다

### AC2: Line SVG 출력
**Given** Line Entity가 있는 경우
**When** export_svg() 실행
**Then** `<line>` 또는 `<polyline>` 요소가 생성된다
**And** points 좌표가 SVG 속성으로 변환된다

### AC3: Circle SVG 출력
**Given** Circle Entity가 있는 경우
**When** export_svg() 실행
**Then** `<circle cx="..." cy="..." r="...">` 요소가 생성된다

### AC4: Rect SVG 출력
**Given** Rect Entity가 있는 경우
**When** export_svg() 실행
**Then** `<rect x="..." y="..." width="..." height="...">` 요소가 생성된다

### AC5: Transform 적용 SVG
**Given** Transform이 적용된 Entity가 있는 경우
**When** export_svg() 실행
**Then** `transform="translate(...) rotate(...) scale(...)"` 속성이 포함된다

### AC6: 파일 저장
**Given** SVG 문자열이 반환된 상태
**When** Claude Code가 `fs.writeFileSync('output.svg', svg)` 실행
**Then** 유효한 SVG 파일이 생성된다
**And** 브라우저에서 열면 도형들이 표시된다

## Tasks / Subtasks

- [ ] **Task 1: SVG Serializer 구현** (AC: #1)
  - [ ] 1.1: `serializers/svg.rs` 파일 생성
  - [ ] 1.2: SVG 헤더 생성 로직 (`<svg>` 태그, viewBox 등)
  - [ ] 1.3: SVG 푸터 생성 로직 (`</svg>`)

- [ ] **Task 2: 도형별 SVG 변환** (AC: #2, #3, #4)
  - [ ] 2.1: Line → `<polyline>` 또는 `<line>` 변환
  - [ ] 2.2: Circle → `<circle>` 변환
  - [ ] 2.3: Rect → `<rect>` 변환

- [ ] **Task 3: Transform 적용** (AC: #5)
  - [ ] 3.1: translate → `translate(dx, dy)`
  - [ ] 3.2: rotate → `rotate(deg)`
  - [ ] 3.3: scale → `scale(sx, sy)`
  - [ ] 3.4: transform 속성 문자열 생성

- [ ] **Task 4: Scene에 통합** (AC: #1, #6)
  - [ ] 4.1: Scene impl에 export_svg 메서드 추가
  - [ ] 4.2: wasm_bindgen export 확인

- [ ] **Task 5: 테스트 작성** (AC: #1, #2, #3, #4, #5, #6)
  - [ ] 5.1: 빈 Scene SVG 출력 테스트
  - [ ] 5.2: 각 도형별 SVG 요소 테스트
  - [ ] 5.3: Transform 적용 SVG 테스트
  - [ ] 5.4: 브라우저에서 SVG 열기 확인

- [ ] **Task 6: Tool Use 등록** (AC: #1)
  - [ ] 6.1: `cad-tools/src/schema.ts` - export_svg 스키마 추가
  - [ ] 6.2: `cad-tools/src/executor.ts` - export_svg case 추가
  - [ ] 6.3: DOMAINS.export에 "export_svg" 추가
  - [ ] 6.4: `cad-tools/tests/executor.test.ts` - export_svg 테스트 추가

## Dev Notes

### Architecture Patterns

#### export_svg 함수 시그니처

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl Scene {
    /// Scene을 SVG 문자열로 직렬화합니다.
    ///
    /// # Returns
    /// * SVG 문자열
    pub fn export_svg(&self) -> String {
        let mut svg = String::new();

        // SVG 헤더
        svg.push_str(r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="-200 -200 400 400">"#);
        svg.push('\n');

        // y축 뒤집기 그룹 (SVG는 y축이 아래로 증가)
        svg.push_str(r#"  <g transform="scale(1, -1)">"#);
        svg.push('\n');

        // 각 Entity를 SVG 요소로 변환
        for entity in &self.entities {
            svg.push_str(&self.entity_to_svg(entity));
        }

        svg.push_str("  </g>\n");
        svg.push_str("</svg>");

        svg
    }

    fn entity_to_svg(&self, entity: &Entity) -> String {
        let transform_attr = self.transform_to_svg(&entity.transform);
        let style_attr = self.style_to_svg(&entity.style);

        match &entity.geometry {
            Geometry::Line { points } => {
                let points_str: String = points
                    .iter()
                    .map(|p| format!("{},{}", p[0], p[1]))
                    .collect::<Vec<_>>()
                    .join(" ");
                format!(
                    r#"    <polyline points="{}" fill="none" stroke="black" {}{}/>"#,
                    points_str, style_attr, transform_attr
                ) + "\n"
            }
            Geometry::Circle { center, radius } => {
                format!(
                    r#"    <circle cx="{}" cy="{}" r="{}" fill="none" stroke="black" {}{}/>"#,
                    center[0], center[1], radius, style_attr, transform_attr
                ) + "\n"
            }
            Geometry::Rect { origin, width, height } => {
                format!(
                    r#"    <rect x="{}" y="{}" width="{}" height="{}" fill="none" stroke="black" {}{}/>"#,
                    origin[0], origin[1], width, height, style_attr, transform_attr
                ) + "\n"
            }
        }
    }

    fn transform_to_svg(&self, transform: &Transform) -> String {
        let mut parts = Vec::new();

        if transform.translate != [0.0, 0.0] {
            parts.push(format!("translate({}, {})", transform.translate[0], transform.translate[1]));
        }

        if transform.rotate != 0.0 {
            // SVG는 degrees 사용
            let degrees = transform.rotate * 180.0 / std::f64::consts::PI;
            parts.push(format!("rotate({})", degrees));
        }

        if transform.scale != [1.0, 1.0] {
            parts.push(format!("scale({}, {})", transform.scale[0], transform.scale[1]));
        }

        if parts.is_empty() {
            String::new()
        } else {
            format!(r#"transform="{}""#, parts.join(" "))
        }
    }

    fn style_to_svg(&self, style: &Style) -> String {
        let mut attrs = Vec::new();

        if let Some(stroke) = &style.stroke {
            attrs.push(format!(r#"stroke="{}""#, stroke));
        }

        if let Some(fill) = &style.fill {
            attrs.push(format!(r#"fill="{}""#, fill));
        }

        if let Some(stroke_width) = style.stroke_width {
            attrs.push(format!(r#"stroke-width="{}""#, stroke_width));
        }

        if attrs.is_empty() {
            String::new()
        } else {
            attrs.join(" ") + " "
        }
    }
}
```

#### 출력 SVG 예시

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-200 -200 400 400">
  <g transform="scale(1, -1)">
    <circle cx="0" cy="100" r="10" fill="none" stroke="black" />
    <polyline points="0,90 0,50" fill="none" stroke="black" />
    <polyline points="0,85 -20,70 -25,50" fill="none" stroke="black" transform="scale(1, 1.5)"/>
    <polyline points="0,85 20,70 25,50" fill="none" stroke="black" />
    <polyline points="0,50 -15,20 -15,0" fill="none" stroke="black" />
    <polyline points="0,50 15,20 15,0" fill="none" stroke="black" />
  </g>
</svg>
```

#### Claude Code 사용 예시

```javascript
import { Scene } from './cad-engine/pkg/cad_engine.js';
import fs from 'fs';

const scene = new Scene("skeleton");
// ... 도형 추가

// SVG 출력 및 파일 저장
const svg = scene.export_svg();
fs.writeFileSync('output.svg', svg);

console.log("output.svg saved");
```

### SVG 좌표계

- SVG는 y축이 아래로 증가 (Canvas와 동일)
- viewBox로 좌표계 정의
- `scale(1, -1)`로 y축 뒤집기 (선택적)

### 디렉토리 구조

```
cad-engine/src/
├── lib.rs
├── scene/
│   ├── mod.rs          # export_svg 메서드 추가
│   └── entity.rs
├── primitives/
│   └── ...
├── transforms/
│   └── ...
└── serializers/
    ├── mod.rs
    ├── json.rs
    └── svg.rs          # ← 이 스토리
```

### Project Structure Notes

- SVG 1.1 표준 준수
- viewBox 자동 계산 또는 고정 크기 (400x400)
- stroke: black, fill: none 기본값
- Phase 1 마지막 스토리

### Dependencies

- Story 1.2 (Scene 클래스 및 Entity 구조)
- Story 2.1 (JSON Export) - 동일 패턴
- Story 3.1-3.3 (Transform) - transform 속성 사용
- **Story 3.0 (Tool Use Foundation)** - Tool 등록용

## References

- [Source: docs/architecture.md#API Design - export_svg]
- [Source: docs/prd.md#CAD 엔진 - Output]
- [Source: docs/epics.md#Story 3.6]
- [Source: docs/ai-native-cad-proposal.md#Phase 1 - SVG로 시작]

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

- cad-engine/src/serializers/svg.rs (신규)
- cad-engine/src/serializers/mod.rs (수정 - mod svg 추가)
- cad-engine/src/scene/mod.rs (수정 - export_svg 추가)
