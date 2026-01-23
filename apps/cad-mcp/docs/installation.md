# Installation Guide

AI-Native CAD MCP 서버 설치 가이드

## 목차

- [사전 요구사항](#사전-요구사항)
- [일반 사용자](#일반-사용자)
- [개발자](#개발자)
- [플랫폼별 주의사항](#플랫폼별-주의사항)
- [Claude Code Scope 시스템](#claude-code-scope-시스템)
- [문제 해결](#문제-해결)

---

## 사전 요구사항

- **Node.js**: v22 이상 (LTS 권장)
- **npm**: v8 이상
- **Claude Desktop** 또는 **Claude Code**

```bash
# 버전 확인
node --version  # v22.0.0 이상
npm --version   # v8.0.0 이상
```

---

## 일반 사용자

### 방법 1: npx (권장)

설치 없이 바로 사용. 항상 최신 버전 실행.

#### Claude Code

```bash
claude mcp add ai-native-cad -s user -- npx -y @ai-native-cad/mcp start
```

#### Claude Desktop

`claude_desktop_config.json`:

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

### 방법 2: 글로벌 설치

오프라인 사용 가능. 빠른 시작.

```bash
npm install -g @ai-native-cad/mcp
```

#### Claude Code

```bash
claude mcp add ai-native-cad -s user -- ai-native-cad-mcp start
```

#### Claude Desktop

```json
{
  "mcpServers": {
    "ai-native-cad": {
      "command": "ai-native-cad-mcp",
      "args": ["start"]
    }
  }
}
```

---

## 개발자

### 소스에서 설치

```bash
# 저장소 클론
git clone https://github.com/parktube/7-division.git
cd 7-division

# 의존성 설치
pnpm install

# 빌드
pnpm --filter @ai-native-cad/mcp build

# 글로벌 링크 (개발 중 변경사항 즉시 반영)
cd apps/cad-mcp
npm link
```

> **Windows Git Bash 사용자**: pnpm과 Git Bash 호환성 문제로 빌드가 실패할 수 있습니다.
> 이 경우 PowerShell 또는 cmd.exe를 사용하거나, `cmd //c "pnpm build"`로 실행하세요.

### 로컬 설치 (프로젝트별)

```bash
# 프로젝트 디렉토리에서
npm install @ai-native-cad/mcp

# 실행
npx ai-native-cad-mcp start
```

### 로컬 vs 글로벌 우선순위

동시 설치 시 **로컬이 우선**:

```
실행 순서:
1. ./node_modules/.bin/ (로컬) ← 최우선
2. ~/.npm-global/bin/ (글로벌)
```

| 명령어 | 실행 버전 |
|--------|-----------|
| `npx @ai-native-cad/mcp` | 로컬 (있으면) |
| `ai-native-cad-mcp` | 글로벌 |

---

## 플랫폼별 주의사항

### Windows

#### npx 경로 문제

`cmd /c` 래퍼 또는 절대 경로 사용:

```json
{
  "mcpServers": {
    "ai-native-cad": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@ai-native-cad/mcp", "start"]
    }
  }
}
```

또는 절대 경로:

```json
{
  "command": "C:\\Program Files\\nodejs\\npx.cmd",
  "args": ["-y", "@ai-native-cad/mcp", "start"]
}
```

#### 보안 소프트웨어

- Windows Defender/백신에서 node.exe 허용 필요
- 방화벽에서 localhost:3001 (WebSocket) 허용

### macOS

#### Accessibility 권한

시스템 환경설정 → 보안 및 개인정보 → 개인정보 → 손쉬운 사용에서 Terminal/Node 허용

#### 글로벌 설치 권한

```bash
# npm 글로벌 디렉토리 설정 (sudo 없이 설치)
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
```

### Linux

#### WSL2 (Windows Subsystem for Linux)

Windows와 포트 공유됨. 포트 충돌 시:

```bash
# 다른 포트 사용
PORT=3002 ai-native-cad-mcp start
```

#### Wayland

화면 캡처 시 portal 권한 승인 필요

---

## Claude Code Scope 시스템

### Scope 종류

| Scope | 저장 위치 | 공유 | 용도 |
|-------|-----------|------|------|
| `local` | `~/.claude.json` (프로젝트별) | 나만 | 실험적 설정 |
| `project` | `.mcp.json` | 팀 전체 | 팀 도구 공유 |
| `user` | `~/.claude.json` | 나만 (전체 프로젝트) | 개인 도구 |

### Scope 사용 예시

```bash
# 나만 사용 (모든 프로젝트)
claude mcp add ai-native-cad -s user -- npx -y @ai-native-cad/mcp start

# 팀 공유 (프로젝트에 .mcp.json 생성)
claude mcp add ai-native-cad -s project -- npx -y @ai-native-cad/mcp start

# 현재 프로젝트에서만 (기본값)
claude mcp add ai-native-cad -- npx -y @ai-native-cad/mcp start
```

### 우선순위

같은 이름의 서버가 여러 scope에 있으면:

```
local > project > user
```

---

## 문제 해결

### MCP 서버 연결 실패

```bash
# 서버 상태 확인
claude mcp list

# 로그 확인 (Claude Desktop)
# macOS: ~/Library/Logs/Claude/mcp*.log
# Windows: %APPDATA%\Claude\logs\mcp*.log

# 수동 실행 테스트
npx -y @ai-native-cad/mcp start
```

### 포트 충돌

```bash
# 사용 중인 포트 확인
lsof -i :3001  # macOS/Linux
netstat -ano | findstr :3001  # Windows

# 다른 포트로 시작
PORT=3002 npx -y @ai-native-cad/mcp start
```

### npx 캐시 문제

```bash
# npm 캐시 삭제 후 재시도
npm cache clean --force

# npm v11+ 환경에서 npx 캐시 삭제
npm cache npx rm --force

npx -y @ai-native-cad/mcp start
```

### WASM 로드 실패

```bash
# 패키지 재설치
npm uninstall -g @ai-native-cad/mcp
npm install -g @ai-native-cad/mcp

# 또는 소스에서 빌드
cd apps/cad-mcp
npm run build
```

---

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3001` | WebSocket 서버 포트 |
| `CAD_VIEWER_URL` | `https://parktube.github.io/7-division/` | 뷰어 URL (캡처용) |
| `LOG_LEVEL` | `info` | 로그 레벨 (debug/info/warn/error) |

```bash
# 예시: 로컬 뷰어 + 디버그 로그
CAD_VIEWER_URL=http://localhost:5173 LOG_LEVEL=debug ai-native-cad-mcp start
```
