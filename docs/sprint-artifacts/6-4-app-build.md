# Story 6.4: 앱 빌드 및 패키징

> **Scope**: Story 6.4는 앱 빌드/패키징, Story 6.5는 Claude Code 사용 가이드로 분리

Status: done

Scope: macOS/Windows (Linux 제외)

## Story

As a **사용자 (인간)**,
I want **설치 가능한 데스크톱 앱을 받을 수 있도록**,
so that **복잡한 설정 없이 AI-Native CAD를 사용할 수 있다**.

## Acceptance Criteria

1. **AC1: Windows 빌드**
   - Given: electron-builder 설정 완료
   - When: `npm run build:win` 실행
   - Then: .exe 설치 파일이 생성된다
   - And: 설치 후 정상 실행된다

2. **AC2: macOS 빌드**
   - Given: electron-builder 설정 완료
   - When: `npm run build:mac` 실행
   - Then: .dmg 또는 .app 파일이 생성된다
   - And: 설치 후 정상 실행된다

3. **AC3: 앱 아이콘**
   - Given: 빌드된 앱
   - When: 앱 아이콘 확인
   - Then: AI-Native CAD 브랜드 아이콘이 표시된다

4. **AC4: 앱 정보**
   - Given: 빌드된 앱
   - When: 앱 정보(About) 확인
   - Then: 앱 이름, 버전, 저작권 정보가 표시된다

5. **AC5: 렌더링 리소스 및 CLI 포함**
   - Given: 빌드된 앱
   - When: 설치 후 실행
   - Then: renderer.js/scene.json/cad-tools CLI 리소스가 포함된다
   - And: 기본 Scene 렌더링이 동작한다

6. **AC6: CI/CD 파이프라인**
   - Given: GitHub Actions 워크플로우 설정 완료
   - When: PR 생성 또는 태그 푸시
   - Then: 자동으로 테스트/빌드가 실행된다
   - And: 태그 푸시 시 GitHub Releases에 빌드 결과물이 업로드된다

7. **AC7: 자동 업데이트 (Optional)**
   - Given: 새 버전 릴리즈
   - When: 앱 실행 시 업데이트 확인
   - Then: 사용자에게 업데이트 알림
   - Note: MVP Stretch Goal

## Tasks / Subtasks

- [x] **Task 1: electron-builder 설정 완성** (AC: 1, 2)
  - [x] 1.1: package.json build 섹션 또는 electron-builder.yml
  - [x] 1.2: Windows 타겟 설정 (nsis)
  - [x] 1.3: macOS 타겟 설정 (dmg)

- [x] **Task 2: 앱 메타데이터** (AC: 3, 4)
  - [x] 2.1: 앱 아이콘 제작 (icon.png)
  - [x] 2.2: 앱 ID 설정 (com.7division.cad-viewer)
  - [x] 2.3: 저작권 정보 설정
  - [x] 2.4: 앱 이름: "CADViewer"
  - [x] 2.5: macOS entitlements 파일 추가

- [x] **Task 3: 빌드 스크립트** (AC: 1, 2)
  - [x] 3.1: npm scripts 추가 (build:win, build:mac)
  - [x] 3.2: 빌드 결과물 경로 설정 (dist/)

- [x] **Task 4: CI/CD 파이프라인** (AC: 6)
  - [x] 4.1: `.github/workflows/ci.yml` - PR 시 Electron 번들 빌드 포함
  - [x] 4.2: `.github/workflows/electron-release.yml` - 태그 푸시 시 Electron 빌드
  - [x] 4.3: Windows/macOS 매트릭스 빌드 설정
  - [x] 4.4: GitHub Releases 자동 업로드 설정
  - [x] 4.5: 워크플로우 테스트 (태그 빌드/릴리즈 확인)
  - [x] 4.6: 태그 규칙 정리 (예: electron-v0.1.0)

- [x] **Task 5: 렌더링 리소스 포함** (AC: 5)
  - [x] 5.1: renderer.js/scene.json 리소스 포함 확인
  - [x] 5.2: cad-engine/pkg extraResources 포함
  - [x] 5.3: cad-tools/dist extraResources 포함
  - [x] 5.4: cad-cli 래퍼 스크립트 포함 (sh/cmd)

- [x] **Task 6: 테스트** (AC: 1, 2, 3, 4, 5, 6)
  - [x] 6.1: Windows 빌드 및 설치 테스트 (설치/실행 검증 완료)
  - [x] 6.2: macOS 빌드 및 설치 테스트
  - [x] 6.3: 아이콘 표시 확인 (placeholder)
  - [x] 6.4: CAD 기능 동작 확인
  - [x] 6.5: CI/CD 파이프라인 동작 확인

- [ ] **Task 7: 자동 업데이트 (Optional)** (AC: 7)
  - [ ] 7.1: electron-updater 설정
  - [ ] 7.2: GitHub Releases 연동
  - [ ] 7.3: 업데이트 알림 UI
  - [ ] 7.4: Note: MVP Stretch Goal

## Dev Notes

### Architecture Compliance

**배포 가능한 단일 앱:**

- Canvas Viewer 중심으로 패키징 (scene.json 기반)
- ~~채팅 UI~~ → Claude Code 사용 (별도 설치)
- 설치 후 추가 설정 없이 Viewer 사용 가능

**오프라인 동작:**

- 모든 CAD 기능은 로컬에서 동작
- AI 인터페이스는 Claude Code 사용

### Technical Requirements

1. **electron-builder.yml 예시**:

   ```yaml
   appId: com.7division.cad-viewer
   productName: CADViewer
   copyright: Copyright © 2026 7division

   directories:
     output: dist
     buildResources: resources

   extraResources:
     - from: "../cad-engine/pkg"
       to: "cad-engine/pkg"
       filter:
         - "**/*"
     - from: "../cad-tools/dist"
       to: "cad-tools/dist"
       filter:
         - "**/*"

   win:
     target:
       - nsis
     icon: resources/icon.ico

   mac:
     target:
       - dmg
     icon: resources/icon.icns
     category: public.app-category.graphics-design
   ```

2. **package.json scripts**:

   ```json
   {
     "scripts": {
       "prepare:cad-tools": "npm --prefix ../cad-tools run build",
       "build": "node scripts/run-electron-vite.cjs build",
       "build:win": "npm run prepare:cad-tools && npm run build && electron-builder --win",
       "build:mac": "npm run prepare:cad-tools && npm run build && electron-builder --mac"
     }
   }
   ```

3. **아이콘 파일**:

   ```
   resources/
   ├── icon.ico     # Windows (256x256, optional)
   ├── icon.icns    # macOS (optional)
   ├── icon.png     # Optional fallback
   ├── entitlements.mac.plist
   ├── cad-cli.sh   # macOS wrapper
   └── cad-cli.cmd  # Windows wrapper
   ```

   - icon.ico/icon.icns가 준비되어 있으면 기본 아이콘 대신 표시됨

4. **추가 리소스 경로 (프로덕션)**:

   ```typescript
   import path from 'path';
   import { app } from 'electron';

   function getResourcePath() {
       if (app.isPackaged) {
           return path.join(process.resourcesPath, 'cad-engine/pkg');
       } else {
           return path.join(__dirname, '../cad-engine/pkg');
       }
   }
   ```

5. **cad-cli wrapper 사용 예시**:

   ```bash
   /Applications/CADViewer.app/Contents/Resources/cad-cli.sh \
     draw_circle '{"name":"head","x":0,"y":80,"radius":12}'
   ```

5. **코드 서명 (배포 시 권장)**:
   - Windows: EV 코드 서명 인증서
   - macOS: Apple Developer ID
   - Note: MVP에서는 선택적

### QA Notes

- Windows 빌드 산출물: `dist/CADViewer-0.1.0-setup.exe`, `dist/win-unpacked/`
- Windows 설치/실행 검증 완료 (사용자 확인)
- Windows 설치 폴더는 productName(CADViewer) 기준이며, assisted installer(oneClick=false)로 생성

### Release / Versioning (manual)

- 기준: `cad-electron/package.json` 버전과 git 태그 버전 일치
- 태그 규칙: `electron-v*` (예: `electron-v0.1.0`)
- 사람이 patch/minor/major 결정 후 버전/태그 생성

```bash
cd cad-electron
npm version patch --tag-version-prefix electron-v
git push origin <branch> --follow-tags
```

- 태그 푸시 시 `electron-release.yml`이 실행되며, Actions Artifacts와 GitHub Releases에 산출물이 업로드됨

### File Structure Notes

생성 대상:

- `electron-app/build/` - 빌드 리소스 (아이콘 등)
- `electron-app/electron-builder.yml` - 빌드 설정
- `.github/workflows/ci.yml` - CI 파이프라인 (PR 시 테스트/빌드 검증)
- `.github/workflows/release.yml` - CD 파이프라인 (태그 시 Electron 빌드 + Release)

수정 대상:

- `electron-app/package.json` - 빌드 스크립트 추가

### References

- [Source: docs/epics.md#Story 6.4: 앱 빌드 및 패키징]
- [Source: docs/architecture.md#ADR-MVP-010: CI/CD 전략]
- [electron-builder 문서](https://www.electron.build/)
- [Electron 배포 가이드](https://www.electronjs.org/docs/latest/tutorial/application-distribution)
- [GitHub Actions 문서](https://docs.github.com/en/actions)

## Dev Agent Record

### Context Reference

- docs/epics.md (Epic 6, Story 6.4)
- electron-builder 문서

### Agent Model Used

(구현 시 기록)

### Debug Log References

(구현 시 기록)

### Completion Notes List

(구현 시 기록)

### File List

(구현 시 기록)
