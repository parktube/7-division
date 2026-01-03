# AGENTS.md

AI 에이전트(Claude, Cursor, Copilot 등)를 위한 개발 규칙.

## CAD CLI 사용법

```bash
cd cad-tools
npx tsx cad-cli.ts <command> '<json_params>'
```

### Primitives (도형)

```bash
npx tsx cad-cli.ts draw_circle '{"name":"head","x":0,"y":100,"radius":30}'
npx tsx cad-cli.ts draw_rect '{"name":"body","x":-25,"y":0,"width":50,"height":80}'
npx tsx cad-cli.ts draw_line '{"name":"arm","points":[0,50,50,30]}'
npx tsx cad-cli.ts draw_arc '{"name":"smile","cx":0,"cy":90,"radius":10,"start_angle":180,"end_angle":360}'
npx tsx cad-cli.ts draw_polygon '{"name":"roof","points":[-30,50, 0,80, 30,50]}'
npx tsx cad-cli.ts draw_bezier '{"name":"wave","points":[0,0, 20,50,40,-50,60,0],"closed":false}'
```

**Bezier 포맷**: `[startX, startY, cp1x,cp1y,cp2x,cp2y,endX,endY, ...]` (시작점 2개 + 세그먼트 6개씩)

### Style (스타일)

```bash
npx tsx cad-cli.ts set_fill '{"name":"head","fill":{"color":[1,0.8,0.6,1]}}'
npx tsx cad-cli.ts set_stroke '{"name":"body","stroke":{"color":[0,0,1,1],"width":2}}'
```

색상: RGBA `[r, g, b, a]` (0.0~1.0)

### Transforms (변환)

```bash
npx tsx cad-cli.ts translate '{"name":"head","dx":10,"dy":20}'
npx tsx cad-cli.ts rotate '{"name":"arm","angle":0.785}'  # 라디안 (≈45°)
npx tsx cad-cli.ts scale '{"name":"body","sx":1.5,"sy":1.5}'
npx tsx cad-cli.ts set_pivot '{"name":"arm","px":0,"py":50}'  # 회전/스케일 중심점
npx tsx cad-cli.ts delete '{"name":"temp"}'
```

### Groups (그룹화 - 객체지향 씬 설계)

```bash
npx tsx cad-cli.ts create_group '{"name":"arm_group","children":["upper_arm","forearm"]}'
npx tsx cad-cli.ts ungroup '{"name":"arm_group"}'
npx tsx cad-cli.ts add_to_group '{"group_name":"body_group","entity_name":"spine"}'
npx tsx cad-cli.ts remove_from_group '{"group_name":"body_group","entity_name":"spine"}'
```

**계층적 그룹 설계 패턴**:
```javascript
// run_cad_code 내에서
// 1. 엔티티 네이밍: prefix_part (h1_wall, h1_roof, h1_door)
// 2. 개체 그룹: createGroup("house_1", ["h1_wall", "h1_roof", "h1_door"])
// 3. 카테고리 그룹: createGroup("houses", ["house_1", "house_2"])
// 4. 씬 그룹: createGroup("village", ["houses", "trees"])
// 5. Root z-order 필수: setZOrder("background", 0); setZOrder("village", 100);
```

**주의**: 그룹 내 children은 개별 z-order로 정렬됨

### Query (조회)

```bash
npx tsx cad-cli.ts list_entities
npx tsx cad-cli.ts get_entity '{"name":"head"}'
npx tsx cad-cli.ts get_scene_info
npx tsx cad-cli.ts get_selection     # 뷰어에서 선택된 도형 조회
```

### Export & Capture

```bash
npx tsx cad-cli.ts export_json
npx tsx cad-cli.ts export_svg
npx tsx cad-cli.ts capture_viewport  # 뷰어 스크린샷 캡처 (PNG)
```

### Session

```bash
npx tsx cad-cli.ts reset    # 새 scene
npx tsx cad-cli.ts status
```

### Code & Module Framework (중요)

반복 패턴이나 복잡한 기하는 JavaScript로 작성하여 실행합니다. **파일을 직접 생성하지 말고 도구를 통해 관리하세요.**

```bash
# 코드 실행 + scene.code.js에 자동 저장
npx tsx cad-cli.ts run_cad_code '<javascript_code>'

# 현재 (마지막으로 실행 성공한) 코드를 재사용 가능한 모듈로 저장
npx tsx cad-cli.ts save_module '{"name":"lib_name"}'

# 모듈 로드 및 실행
npx tsx cad-cli.ts run_module '{"name":"lib_name"}'
```

#### ⚠️ 에이전트 주의사항 (AX Lessons Learned)

1. **Source of Truth**: `write_to_file`로 코드를 직접 관리하지 마세요. `run_cad_code` → `save_module` 워크플로우를 따라야 `get_scene_code`로 씬의 원본 소스를 항상 조회할 수 있습니다.
2. **Import 방식**: `import 'module'`은 단순 코드 치환 방식입니다. 모듈과 메인 스크립트 간에 `const`, `let` 식별자가 중복되면 오류가 발생하므로 전역 변수명에 주의하세요.
3. **모듈 이름**: 영문, 숫자, 언더스코어(`_`), 하이픈(`-`)만 사용 가능합니다.
4. **선언 vs 실행**: `save_module`은 실행에 성공한 코드를 저장하므로, 함수 선언만 있는 라이브러리를 만들 때는 `run_cad_code`로 먼저 선언문을 '실행(등록)'한 뒤 저장하세요.

결과: `viewer/scene.json`에 저장
뷰어: `node viewer/server.cjs` 실행 후 http://localhost:8000

## TypeScript (`cad-tools/`)

**Console 금지** - `logger` 사용:

```typescript
import { logger } from "./logger.js";
logger.debug("dev only"); // production에서 미출력
logger.error("always"); // 항상 출력
```

**ESLint**: `no-console: error`, `no-unused-vars` (`_` prefix 허용)

## Rust (`cad-engine/`)

**Clippy** (`-D warnings`):

- `derivable_impls`: Default derive 사용
- `too_many_arguments`: 8개 이상 시 `#[allow]` 필요

**포맷**: `cargo fmt`

## 에러 메시지 형식

```
[function_name] error_type: detail
```

예: `[add_circle] invalid_input: NaN not allowed`

## CI/Pre-commit

```bash
npm install  # husky + lint-staged 설치
```

| Rust                        | TypeScript     |
| --------------------------- | -------------- |
| `cargo fmt --check`         | `eslint`       |
| `cargo clippy -D warnings`  | `tsc --noEmit` |
| `cargo test`                | `vitest run`   |
| `wasm-pack build --release` | `tsc`          |
