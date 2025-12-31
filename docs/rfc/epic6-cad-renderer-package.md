# RFC: Epic 6 아키텍처 변경 - cad-renderer 공유 패키지 도입

> **Status**: 논의 필요
> **Author**: Codex (Claude Code)
> **Related**: Epic 6 (Electron 통합 앱)

## 핵심 의사결정 포인트

**viewer/renderer.js를 Electron 앱에서 어떻게 재사용할 것인가?**

## 배경

Epic 6에서 Electron 뷰어 앱을 구현할 때, 기존 `viewer/renderer.js`의 Canvas 렌더링 로직을 재사용해야 합니다.

현재 `viewer/renderer.js`는:
- Canvas 2D 렌더링 (Line, Circle, Rect, Arc)
- Transform 적용 (translate, rotate, scale)
- Style 적용 (stroke, fill)
- 500ms polling으로 scene.json 감시

## 옵션 비교

### Option 1: 코드 복사 (원래 Epic 6 계획)

```
viewer/
└── renderer.js          # 원본 (JavaScript)

cad-electron/
└── src/renderer/
    └── renderer.ts      # 복사 + TypeScript 변환
```

| 장점 | 단점 |
|------|------|
| 빠른 구현 | 코드 중복 |
| 독립적 발전 가능 | 버그 수정 시 두 곳 수정 필요 |
| Epic 6 범위 내 | 동기화 비용 |

### Option 2: 공유 패키지 분리 (제안)

```
cad-renderer/            # 🆕 공유 패키지
├── src/
│   ├── renderer.ts      # 공통 렌더링 로직
│   └── types.ts         # Scene, Entity 타입
└── package.json

viewer/                  # cad-renderer 사용
└── index.html

cad-electron/            # cad-renderer 사용
└── src/renderer/
    └── main.ts
```

| 장점 | 단점 |
|------|------|
| 코드 중복 없음 | 초기 설정 필요 |
| 단일 소스 유지 | Epic 6 범위 확장 |
| 버그 수정 한 곳에서 | viewer/ 수정 필요 |
| TypeScript로 타입 안전성 | |

## 제안

**Option 2 (공유 패키지)** 권장

이유:
1. **장기적 유지보수**: 렌더링 버그 발견 시 한 곳만 수정
2. **타입 안전성**: TypeScript로 Scene/Entity 타입 정의
3. **확장성**: 향후 다른 프로젝트에서도 재사용 가능
4. **일관성**: viewer/와 cad-electron/이 동일한 렌더링 결과 보장

## 구현 범위 변경

Option 2 선택 시 Epic 6 범위 변경:

| 항목 | 기존 | 변경 |
|------|------|------|
| **Step 0** | - | cad-renderer 패키지 생성 (신규) |
| **Step 1** | - | viewer/ 수정 (cad-renderer 사용) |
| Story 6-1 | Electron 셋업 | 동일 |
| Story 6-2 | 파일 감시 | 동일 |
| Story 6-3 | Canvas 이식 | cad-renderer import로 단순화 |
| ~~Story 6-4~~ | ~~채팅 UI~~ | 삭제 (Option B-1) |
| ~~Story 6-5~~ | ~~API 키~~ | 삭제 (Option B-1) |
| Story 6-6 | 앱 빌드 | 동일 |

## 파일 구조

```
7-division/
├── cad-renderer/                  # 🆕 공유 렌더링 패키지
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── renderer.ts            # viewer/renderer.js → TS
│       ├── types.ts               # Scene, Entity 타입
│       └── styles.css
│
├── viewer/                        # 수정
│   └── index.html                 # cad-renderer 번들 사용
│
└── cad-electron/                  # 🆕 Electron 앱
    └── ...
```

## 질문

1. **Option 1 vs Option 2**: 어떤 방식이 프로젝트에 더 적합한가?
2. **범위 확장 허용**: Epic 6에 Step 0, Step 1 추가해도 괜찮은가?
3. **viewer/ 수정**: 기존 viewer/가 cad-renderer에 의존하게 되어도 괜찮은가?

---

*🤖 Written by Codex (Claude Code)*
