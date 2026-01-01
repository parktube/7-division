# RFC: Epic 6 아키텍처 - 렌더러 재사용 전략

> **Status**: 결정됨
> **Author**: Codex (Claude Code)
> **Related**: Epic 6 (Electron 뷰어 앱)
> **Decision Date**: 2025-12-31

## 결정 사항

**Option 1 (빌드 시 자동 복사)** 채택

- `viewer/renderer.js` = **Source of Truth** (유일한 원본)
- Electron 빌드 시 자동으로 복사
- wgpu 전환 시 Rust 패키지로 통합

## 배경

### 핵심 질문

**viewer/renderer.js를 Electron 앱에서 어떻게 재사용할 것인가?**

### 현재 구조

```
Claude Code → cad-cli.ts → cad-engine (WASM) → scene.json
                                                    ↓
                                          viewer/renderer.js (Canvas 2D)
```

`scene.json`이 **인터페이스** 역할을 하며, 외부 도구(Claude Code) 연동을 위해 필수.

### viewer/renderer.js 현황

- Canvas 2D 렌더링 (Line, Circle, Rect, Arc)
- Transform 적용 (translate, rotate, scale)
- Style 적용 (stroke, fill)
- 500ms polling으로 scene.json 감시

## 검토한 옵션

### Option 1: 빌드 시 자동 복사 (채택)

```
viewer/
└── renderer.js          # Source of Truth

cad-electron/
├── electron.vite.config.ts  # 빌드 시 복사 설정
└── src/renderer/
    └── (renderer.js)        # 빌드 시 자동 복사됨
```

| 장점 | 단점 |
|------|------|
| 단일 원본 유지 | 없음 (자동 복사로 해결) |
| Epic 6 범위 최소화 | |
| wgpu 전환 시 유리 | |

### Option 2: 공유 패키지 분리 (기각)

```
cad-renderer/            # TypeScript 패키지
├── src/
│   ├── renderer.ts
│   └── types.ts
└── package.json
```

| 장점 | 단점 |
|------|------|
| 타입 안전성 | wgpu 전환 시 폐기될 코드 |
| 명시적 의존성 | Epic 6 범위 확장 |

**기각 이유**: wgpu 전환 계획 시 Canvas 2D → TypeScript 패키지화는 중간 단계가 되어 비효율적.

## 최종 아키텍처

### Epic 6 구조

```
viewer/
└── renderer.js              # Source of Truth (유일한 원본)
        ↓ (빌드 시 자동 복사)
cad-electron/
└── src/renderer/renderer.js # 자동 복사된 파일
```

### Electron 빌드 설정

```javascript
// electron.vite.config.ts
import copy from 'rollup-plugin-copy';

export default {
  plugins: [
    copy({
      targets: [
        { src: '../viewer/renderer.js', dest: 'src/renderer/' }
      ],
      hook: 'buildStart'
    })
  ]
}
```

### wgpu 전환 시 (미래)

```
cad-renderer/                # Rust + wgpu → WASM
├── src/lib.rs
└── pkg/                     # WASM 빌드 출력
        ↓
viewer/ 에서 import
cad-electron/ 에서 import
```

scene.json 인터페이스는 유지 (외부 Claude Code 연동 필요)

## 구현 범위

| Story | 내용 | 비고 |
|-------|------|------|
| Story 6-1 | Electron + Vite 셋업 | renderer.js 복사 설정 포함 |
| Story 6-2 | scene.json 파일 감시 | |
| Story 6-3 | Canvas 렌더링 | 복사된 renderer.js 사용 |
| Story 6-4 | 앱 빌드 및 패키징 | |
| Story 6-5 | Claude Code 사용 가이드 | |

**범위 제외** (Option B-1 채택):
- 채팅 UI
- API 키 관리 UI

## 결론

1. **지금**: viewer/renderer.js를 Electron 빌드 시 자동 복사
2. **미래 (wgpu 전환)**: Rust 패키지로 통합, viewer와 Electron 모두 사용

---

*🤖 Written by Codex (Claude Code)*
*Reviewed by: @jungjaehoon-lifegamez*
