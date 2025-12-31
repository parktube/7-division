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
```

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

### Groups (그룹화)
```bash
npx tsx cad-cli.ts create_group '{"name":"arm_group","children":["upper_arm","forearm"]}'
npx tsx cad-cli.ts ungroup '{"name":"arm_group"}'
npx tsx cad-cli.ts add_to_group '{"group":"body_group","child":"spine"}'
npx tsx cad-cli.ts remove_from_group '{"group":"body_group","child":"spine"}'
```

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

결과: `viewer/scene.json`에 저장
뷰어: `node viewer/server.cjs` 실행 후 http://localhost:8000

## TypeScript (`cad-tools/`)

**Console 금지** - `logger` 사용:
```typescript
import { logger } from './logger.js';
logger.debug('dev only');   // production에서 미출력
logger.error('always');     // 항상 출력
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

| Rust | TypeScript |
|------|------------|
| `cargo fmt --check` | `eslint` |
| `cargo clippy -D warnings` | `tsc --noEmit` |
| `cargo test` | `vitest run` |
| `wasm-pack build --release` | `tsc` |
