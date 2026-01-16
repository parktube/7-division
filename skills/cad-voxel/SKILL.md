# CAD Voxel Art Skill

---
name: cad-voxel
description: Crossy Road 스타일 이소메트릭 복셀 아트 제작
globs:
  - "**/*.js"
allowed-tools:
  - mcp__ai-native-cad__glob
  - mcp__ai-native-cad__read
  - mcp__ai-native-cad__edit
  - mcp__ai-native-cad__write
  - mcp__ai-native-cad__lsp
  - mcp__ai-native-cad__bash
---

## 개요

AI-Native CAD 시스템에서 Crossy Road 스타일 이소메트릭 복셀 아트를 제작하는 스킬입니다.

**⚠️ 중요**: 일반 Read/Write가 아닌 **CAD 전용 MCP 도구**를 사용하세요!

## Rules

상세 규칙은 `rules/` 디렉토리를 참조하세요.

### 🔧 도구 사용법 (Critical)
- [tools-mcp.md](rules/tools-mcp.md) - MCP 도구 (glob, read, edit, write, lsp, bash)

### 📐 함수 레퍼런스 (Critical)
- [functions-primitives.md](rules/functions-primitives.md) - 도형 생성 (drawCircle, drawRect, ...)
- [functions-transforms.md](rules/functions-transforms.md) - 변환 (translate, rotate, scale, ...)
- [functions-style.md](rules/functions-style.md) - 스타일, 그룹, 쿼리

### 🎨 Z-Order 패턴 (High)
- [zorder-internal.md](rules/zorder-internal.md) - 오브젝트 내부 z-order
- [zorder-isometric.md](rules/zorder-isometric.md) - 이소메트릭 그룹간 정렬

### 📍 좌표 시스템 (High)
- [coords-local-group.md](rules/coords-local-group.md) - 그룹 로컬 좌표 패턴

### 📝 문법 & 워크플로우 (Medium)
- [syntax-es5.md](rules/syntax-es5.md) - ES5 호환성 규칙
- [workflow-design.md](rules/workflow-design.md) - 설계 체크 워크플로우

## Quick Start

```javascript
// 1. 기존 코드 확인
glob()
read({ file: 'main' })

// 2. 함수 스키마 조회
lsp({ operation: 'domains' })
lsp({ operation: 'describe', domain: 'primitives' })

// 3. 코드 작성 (자동 실행)
write({ file: 'main', code: "drawCircle('c', 0, 0, 50)" })

// 4. 결과 확인
bash({ command: 'capture' })
```

## 색상 팔레트

```javascript
// RGBA (0~1 범위)
var PALETTE = {
  grass: [0.4, 0.8, 0.3, 1],
  road: [0.3, 0.3, 0.35, 1],
  water: [0.2, 0.5, 0.8, 1],
  wood: [0.5, 0.35, 0.2, 1]
};
```

## 참고 문서

- [cad-mcp-guide.md](../../docs/cad-mcp-guide.md) - 전체 도구/함수 가이드
- [cad-sandbox-workflow.md](../../docs/cad-sandbox-workflow.md) - 샌드박스 코딩 워크플로우
