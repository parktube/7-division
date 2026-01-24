# Installation Guide

AI-Native CAD MCP 서버의 OS별 설치 및 설정 가이드입니다.

## 목차

- [사용자 설치 (npx)](#사용자-설치-npx)
- [개발자 설치 (소스 빌드)](#개발자-설치-소스-빌드)
- [Claude Code 설정](#claude-code-설정)
- [Claude Desktop 설정](#claude-desktop-설정)
- [VS Code 설정 주의사항](#vs-code-설정-주의사항)
- [문제 해결](#문제-해결)

---

## 사용자 설치 (npx)

가장 간단한 방법입니다. 빌드 없이 바로 사용 가능합니다.

```bash
# MCP 서버 시작
npx @ai-native-cad/mcp start

# 웹 Viewer 열기
# → https://parktube.github.io/7-division/
```

---

## 개발자 설치 (소스 빌드)

### Prerequisites

| 도구 | 필요 버전 | 설치 확인 |
|------|----------|----------|
| **Rust** | 1.85.0+ (stable) | `rustc --version` |
| **Node.js** | 22.x LTS | `node --version` |
| **pnpm** | 9.x+ | `pnpm --version` |
| **wasm-pack** | 0.13.1 | `wasm-pack --version` |

### 1. 소스 클론

```bash
git clone https://github.com/parktube/7-division.git
cd 7-division
pnpm install
```

### 2. WASM 빌드

```bash
# Rust WASM 타겟 추가
rustup target add wasm32-unknown-unknown

# wasm-pack 설치 (drager fork 필수)
cargo install --git https://github.com/drager/wasm-pack.git \
  --rev 24bdca457abad34e444912e6165eb71422a51046 --force

# WASM 빌드
pnpm run build:wasm:release
```

### 3. MCP 서버 빌드

#### macOS / Linux

```bash
pnpm --filter @ai-native-cad/mcp build
```

#### Windows (PowerShell 필수!)

> ⚠️ **중요**: Windows에서는 반드시 **PowerShell**을 사용하세요. Git Bash에서는 빌드가 실패합니다.

**방법 1: PowerShell에서 직접 실행**
```powershell
pnpm --filter @ai-native-cad/mcp build
```

**방법 2: Git Bash에서 PowerShell 호출**
```bash
powershell.exe -Command "pnpm --filter @ai-native-cad/mcp build"
```

**빌드 성공 확인:**
```
> @ai-native-cad/mcp@0.1.0 build
> pnpm exec tsc
```

### 4. 실행

```bash
# MCP 서버 시작
pnpm --filter @ai-native-cad/mcp start

# Viewer 개발 서버 (별도 터미널)
pnpm --filter @ai-native-cad/viewer dev
# → http://localhost:5173
```

---

## Claude Code 설정

Claude Code (CLI)에서 MCP 서버를 사용하려면 **글로벌 설정 파일**을 생성합니다.

### 설정 파일 위치

| OS | 경로 |
|----|------|
| **Windows** | `%USERPROFILE%\.claude\mcp.json` (예: `C:\Users\username\.claude\mcp.json`) |
| **macOS** | `~/.claude/mcp.json` |
| **Linux** | `~/.claude/mcp.json` |

### 설정 방법

#### 방법 1: npx 사용 (권장)

빌드 없이 npm 패키지를 직접 실행합니다.

```json
{
  "mcpServers": {
    "ai-native-cad": {
      "command": "npx",
      "args": ["@ai-native-cad/mcp", "start"]
    }
  }
}
```

#### 방법 2: 로컬 빌드 사용 (개발자용)

로컬에서 빌드한 버전을 사용합니다.

**Windows:**
```json
{
  "mcpServers": {
    "ai-native-cad": {
      "command": "node",
      "args": ["C:\\Users\\username\\projects\\7-division\\apps\\cad-mcp\\dist\\mcp-cli.js", "start"],
      "cwd": "C:\\Users\\username\\projects\\7-division"
    }
  }
}
```

**macOS / Linux:**
```json
{
  "mcpServers": {
    "ai-native-cad": {
      "command": "node",
      "args": ["/Users/username/projects/7-division/apps/cad-mcp/dist/mcp-cli.js", "start"],
      "cwd": "/Users/username/projects/7-division"
    }
  }
}
```

### 설정 후 재시작

설정 파일 수정 후 **Claude Code를 재시작**해야 MCP 서버가 활성화됩니다.

---

## Claude Desktop 설정

Claude Desktop 앱에서 MCP 서버를 사용하려면 별도의 설정 파일을 수정합니다.

### 설정 파일 위치

| OS | 경로 |
|----|------|
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

### 설정 예시

기존 설정에 `ai-native-cad`를 추가합니다:

```json
{
  "mcpServers": {
    "ai-native-cad": {
      "command": "npx",
      "args": ["@ai-native-cad/mcp", "start"]
    }
  }
}
```

---

## VS Code 설정 주의사항

### 프로젝트별 `.mcp.json` 사용 시 포트 충돌 문제

VS Code Claude 확장은 프로젝트 루트의 `.mcp.json` 파일을 자동으로 읽습니다.

**문제:**
- 글로벌 설정(`~/.claude/mcp.json`)과 프로젝트 설정(`.mcp.json`)이 **동시에 활성화**되면
- 동일한 MCP 서버가 **두 번 시작**되어
- WebSocket 포트(3002) **충돌** 발생

**해결책:**

1. **글로벌 설정만 사용 (권장)**
   - 프로젝트에 `.mcp.json` 파일을 두지 않음
   - `~/.claude/mcp.json`에만 설정

2. **프로젝트 설정만 사용**
   - 글로벌 `~/.claude/mcp.json`에서 `ai-native-cad` 제거
   - 프로젝트 `.mcp.json`에만 설정

3. **다른 포트 사용**
   - 환경 변수로 WebSocket 포트 변경 (현재 미지원)

### 권장 구성

```
글로벌 설정 (~/.claude/mcp.json)
└── ai-native-cad: 로컬 빌드 또는 npx

프로젝트 설정 (.mcp.json)
└── 사용하지 않음 (충돌 방지)
```

---

## 문제 해결

### Windows: Git Bash에서 빌드 실패

**증상:**
```
> pnpm --filter @ai-native-cad/mcp build
error: ...
```

**원인:** Git Bash의 경로 처리 문제

**해결:** PowerShell 사용
```bash
powershell.exe -Command "pnpm --filter @ai-native-cad/mcp build"
```

### 포트 충돌 (EADDRINUSE)

**증상:**
```
Error: listen EADDRINUSE: address already in use :::3002
```

**원인:** 다른 MCP 서버 인스턴스가 이미 실행 중

**해결:**
```bash
# Windows
netstat -ano | findstr :3002
taskkill /PID <PID> /F

# macOS / Linux
lsof -i :3002
kill -9 <PID>
```

### MCP 서버 연결 안 됨

**확인사항:**
1. MCP 서버가 실행 중인지 확인
2. 웹 Viewer 콘솔에서 WebSocket 연결 상태 확인
3. 방화벽이 `localhost:3002` 차단하는지 확인

### 캡처 실패 (Puppeteer)

**Windows 환경 변수:**
```bash
# Chrome GPU 가속 문제 시
CAD_CAPTURE_METHOD=puppeteer
```

---

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `CAD_VIEWER_URL` | `https://parktube.github.io/7-division/` | Puppeteer 캡처 시 사용할 뷰어 URL |
| `CAD_CAPTURE_METHOD` | (자동 감지) | 캡처 방식: `puppeteer` 강제 사용 |
| `CAD_WS_HOST` | `127.0.0.1` | WebSocket 바인딩 호스트. WSL2/LAN 접근 시 `0.0.0.0` 설정 |

**로컬 개발 시:**
```bash
CAD_VIEWER_URL=http://localhost:5173 pnpm --filter @ai-native-cad/mcp start
```

**WSL2에서 Windows 브라우저 연결 시:**
```bash
CAD_WS_HOST=0.0.0.0 pnpm --filter @ai-native-cad/mcp start
```

---

*작성: 2026-01-24*
