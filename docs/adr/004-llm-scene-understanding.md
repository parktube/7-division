# ADR-004: LLM Scene Understanding

**상태**: 완료

## Context

LLM이 Scene을 어떻게 이해하는 것이 최적인가?

## Decision

**JSON (구조적 정보) + PNG (시각적 정보)** 병행 제공.

| JSON (구조) | PNG (시각) |
|-------------|------------|
| entity 이름, 좌표 | 실제 모습 |
| 계층 구조 | 색상, 배치 |
| 스타일 속성 | 전체 느낌 |

## JSON 역할

- **Read-Only** 포맷
- LLM이 현재 Scene 상태 이해용
- 조작은 항상 Tool Call로

```
LLM → "현재 씬에 뭐가 있지?" → JSON 읽기
LLM → "head를 옮겨야겠다" → Tool Call (translate)
```

## PNG 역할

- Vision 모델 활용
- "이거 더 길게" 같은 요청에 "이거"를 시각적으로 이해
- Scene 변경 시에만 갱신 (dirty flag)

## API

```bash
npx tsx cad-cli.ts export_json
npx tsx cad-cli.ts capture_viewport  # PNG
```
