# @ai-native-cad/mcp

AI-Native CAD를 위한 MCP (Model Context Protocol) 서버

LLM이 CAD 도구를 직접 조작하여 2D/3D 도면을 생성하고 편집할 수 있습니다.

## Quick Start

### Claude Code

```bash
# MCP 서버 추가 (user scope - 모든 프로젝트에서 사용)
claude mcp add ai-native-cad -s user -- npx -y @ai-native-cad/mcp start

# 확인
claude mcp list
```

### Claude Desktop

`claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "ai-native-cad": {
      "command": "npx",
      "args": ["-y", "@ai-native-cad/mcp", "start"]
    }
  }
}
```

설정 파일 위치:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

## 상세 설치 가이드

플랫폼별, 사용자 유형별 상세 설치 방법은 [Installation Guide](docs/installation.md)를 참조하세요.

## 주요 기능

| 도구 | 설명 |
|------|------|
| `glob` | CAD 모듈 파일 목록 조회 |
| `read` | CAD 코드 읽기 |
| `write` | CAD 코드 작성 → 자동 실행 |
| `edit` | CAD 코드 부분 수정 → 자동 실행 |
| `lsp` | 도메인/함수 탐색 (Progressive Disclosure) |
| `bash` | 씬 조회, 캡처, 내보내기 |

### MAMA 도구 (Memory-Augmented Meta Agent)

| 도구 | 설명 |
|------|------|
| `mama_save` | 결정/체크포인트 저장 |
| `mama_search` | 추론 그래프 검색 |
| `mama_update` | 결정 결과 업데이트 |
| `mama_load_checkpoint` | 이전 세션 복원 |
| `mama_workflow` | 디자인 워크플로우 관리 |
| `mama_recommend_modules` | 모듈 추천 |
| `mama_health` | 추론 그래프 건강도 |
| `mama_growth_report` | 성장 지표 리포트 |

## 사용 예시

```javascript
// 도메인 확인
lsp({ operation: 'domains' })

// 원 그리기
write({ file: 'main', code: `
  drawCircle('my_circle', 0, 0, 50);
  setFill('my_circle', [1, 0, 0, 1]);
`})

// 스크린샷 캡처
bash({ command: 'capture' })

// MAMA: 디자인 워크플로우 시작
mama_workflow({ command: 'start', project_name: 'My House' })

// MAMA: 결정 저장
mama_save({
  type: 'decision',
  topic: 'color_scheme',
  decision: 'Use warm earth tones for exterior'
})
```

## 뷰어

실시간 렌더링 뷰어: https://parktube.github.io/7-division/

로컬 개발 시:
```bash
pnpm --filter @ai-native-cad/viewer dev
# → http://localhost:5173
```

## 라이선스

MIT
