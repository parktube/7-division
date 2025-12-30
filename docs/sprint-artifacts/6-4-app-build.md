# Story 6.4: 앱 빌드 및 패키징

> **번호 변경**: 기존 Story 6.6 → Story 6.4 (Story 6.4, 6.5 삭제로 인해)

Status: backlog

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

3. **AC3: Linux 빌드**
   - Given: electron-builder 설정 완료
   - When: `npm run build:linux` 실행
   - Then: .AppImage 또는 .deb 파일이 생성된다
   - And: 실행 후 정상 동작한다

4. **AC4: 앱 아이콘**
   - Given: 빌드된 앱
   - When: 앱 아이콘 확인
   - Then: AI-Native CAD 브랜드 아이콘이 표시된다

5. **AC5: 앱 정보**
   - Given: 빌드된 앱
   - When: 앱 정보(About) 확인
   - Then: 앱 이름, 버전, 저작권 정보가 표시된다

6. **AC6: WASM 파일 포함**
   - Given: 빌드된 앱
   - When: 설치 후 실행
   - Then: WASM CAD 엔진이 정상 로드된다
   - And: 모든 CAD 기능이 동작한다

7. **AC7: CI/CD 파이프라인**
   - Given: GitHub Actions 워크플로우 설정 완료
   - When: PR 생성 또는 태그 푸시
   - Then: 자동으로 테스트/빌드가 실행된다
   - And: 태그 푸시 시 GitHub Releases에 빌드 결과물이 업로드된다

8. **AC8: 자동 업데이트 (Optional)**
   - Given: 새 버전 릴리즈
   - When: 앱 실행 시 업데이트 확인
   - Then: 사용자에게 업데이트 알림
   - Note: MVP Stretch Goal

## Tasks / Subtasks

- [ ] **Task 1: electron-builder 설정 완성** (AC: 1, 2, 3)
  - [ ] 1.1: package.json build 섹션 또는 electron-builder.yml
  - [ ] 1.2: Windows 타겟 설정 (nsis, portable)
  - [ ] 1.3: macOS 타겟 설정 (dmg, zip)
  - [ ] 1.4: Linux 타겟 설정 (AppImage, deb)

- [ ] **Task 2: 앱 메타데이터** (AC: 4, 5)
  - [ ] 2.1: 앱 아이콘 제작 (256x256 이상)
  - [ ] 2.2: 앱 ID 설정 (com.example.ai-native-cad)
  - [ ] 2.3: 버전, 저작권 정보 설정
  - [ ] 2.4: 앱 이름: "AI-Native CAD"

- [ ] **Task 3: 빌드 스크립트** (AC: 1, 2, 3)
  - [ ] 3.1: npm scripts 추가 (build:win, build:mac, build:linux)
  - [ ] 3.2: 빌드 결과물 경로 설정 (dist/)

- [ ] **Task 4: CI/CD 파이프라인** (AC: 7)
  - [ ] 4.1: `.github/workflows/ci.yml` - PR 시 lint, test, WASM 빌드
  - [ ] 4.2: `.github/workflows/release.yml` - 태그 푸시 시 Electron 빌드
  - [ ] 4.3: Windows/macOS/Linux 매트릭스 빌드 설정
  - [ ] 4.4: GitHub Releases 자동 업로드 설정
  - [ ] 4.5: 워크플로우 테스트 (테스트 PR 및 태그 생성)

- [ ] **Task 5: WASM 번들링** (AC: 6)
  - [ ] 5.1: WASM 파일을 빌드에 포함
  - [ ] 5.2: extraResources 또는 files 설정
  - [ ] 5.3: 빌드 후 경로 확인

- [ ] **Task 6: 테스트** (AC: 1, 2, 3, 4, 5, 6, 7)
  - [ ] 6.1: Windows 빌드 및 설치 테스트
  - [ ] 6.2: macOS 빌드 및 설치 테스트 (가능한 경우)
  - [ ] 6.3: Linux 빌드 및 실행 테스트
  - [ ] 6.4: 아이콘 표시 확인
  - [ ] 6.5: CAD 기능 동작 확인
  - [ ] 6.6: CI/CD 파이프라인 동작 확인

- [ ] **Task 7: 자동 업데이트 (Optional)** (AC: 8)
  - [ ] 7.1: electron-updater 설정
  - [ ] 7.2: GitHub Releases 연동
  - [ ] 7.3: 업데이트 알림 UI
  - [ ] 7.4: Note: MVP Stretch Goal

## Dev Notes

### Architecture Compliance

**배포 가능한 단일 앱:**

- WASM CAD 엔진 + Canvas Viewer가 하나의 앱으로 패키징
- ~~채팅 UI~~ → Claude Code 사용 (별도 설치)
- 설치 후 추가 설정 없이 Viewer 사용 가능

**오프라인 동작:**

- 모든 CAD 기능은 로컬에서 동작
- AI 인터페이스는 Claude Code 사용

### Technical Requirements

1. **electron-builder.yml 예시**:

   ```yaml
   appId: com.example.ai-native-cad
   productName: AI-Native CAD
   copyright: Copyright © 2024

   directories:
     output: dist
     buildResources: build

   files:
     - "dist/**/*"
     - "wasm/**/*"
     - "package.json"

   extraResources:
     - from: "wasm/"
       to: "wasm"
       filter:
         - "**/*"

   win:
     target:
       - nsis
     icon: build/icon.ico

   mac:
     target:
       - dmg
     icon: build/icon.icns
     category: public.app-category.graphics-design

   linux:
     target:
       - AppImage
       - deb
     icon: build/icon.png
     category: Graphics
   ```

2. **package.json scripts**:

   ```json
   {
     "scripts": {
       "build": "vite build && electron-builder",
       "build:win": "vite build && electron-builder --win",
       "build:mac": "vite build && electron-builder --mac",
       "build:linux": "vite build && electron-builder --linux"
     }
   }
   ```

3. **아이콘 파일**:

   ```
   build/
   ├── icon.ico     # Windows (256x256)
   ├── icon.icns    # macOS
   └── icon.png     # Linux (512x512 권장)
   ```

4. **WASM 경로 처리 (프로덕션)**:

   ```typescript
   import path from 'path';
   import { app } from 'electron';

   function getWasmPath() {
       if (app.isPackaged) {
           // 패키징된 앱
           return path.join(process.resourcesPath, 'wasm');
       } else {
           // 개발 모드
           return path.join(__dirname, '../wasm');
       }
   }
   ```

5. **코드 서명 (배포 시 권장)**:
   - Windows: EV 코드 서명 인증서
   - macOS: Apple Developer ID
   - Note: MVP에서는 선택적

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
