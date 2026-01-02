# Claude Code 사용 가이드 (Electron 배포)

이 문서는 **배포된 Electron 앱**과 함께 제공되는 `cad-tools` CLI를 Claude Code에서 사용하는 방법을 정리합니다.  
앱은 `scene.json`을 **사용자 쓰기 가능한 경로**에 저장하고, 렌더러가 그 파일을 자동 폴링합니다.

현재 배포 범위: macOS/Windows (Linux 제외)

## 기본 흐름

1) Electron 앱 실행  
2) Claude Code에서 `cad-cli` 실행  
3) `scene.json`이 갱신되면 앱 화면이 자동 업데이트

## Claude Code 설정 (사용자 CLAUDE.md에 추가)

Claude Code는 작업 중인 저장소의 `CLAUDE.md`를 참고합니다.  
아래 섹션을 **사용자 프로젝트의 `CLAUDE.md`에 복사**해 사용하세요.  
(이 저장소의 `CLAUDE.md`를 수정하는 것이 아닙니다.)

```md
## CADViewer (Electron)
- cad-cli 위치
  - macOS: /Applications/CADViewer.app/Contents/Resources/cad-cli.sh
  - Windows: %LOCALAPPDATA%\Programs\CADViewer\resources\cad-cli.cmd
- 필요 시 CAD_APP_PATH, CAD_APP_NAME, CAD_SCENE_PATH, CAD_STATE_PATH 사용
- 명령어 목록: 위 경로에 `help` 또는 `describe <domain>`을 붙여 실행
- 예시 (macOS)
  - /Applications/CADViewer.app/Contents/Resources/cad-cli.sh draw_circle '{"name":"head","x":0,"y":80,"radius":12}'
```

## 명령어 확인 (help)

macOS:
```bash
/Applications/CADViewer.app/Contents/Resources/cad-cli.sh help
/Applications/CADViewer.app/Contents/Resources/cad-cli.sh describe primitives
```

Windows:
```bat
"%LOCALAPPDATA%\Programs\CADViewer\resources\cad-cli.cmd" help
"%LOCALAPPDATA%\Programs\CADViewer\resources\cad-cli.cmd" describe primitives
```

## macOS

```bash
/Applications/CADViewer.app/Contents/Resources/cad-cli.sh \
  draw_circle '{"name":"head","x":0,"y":80,"radius":12}'
```

앱 설치 위치가 다르면:

```bash
CAD_APP_PATH="/path/to/CADViewer.app" \
  /path/to/CADViewer.app/Contents/Resources/cad-cli.sh \
  export_json
```

## Windows (NSIS)

```bat
"%LOCALAPPDATA%\Programs\CADViewer\resources\cad-cli.cmd" ^
  draw_rect "{\"name\":\"body\",\"x\":-25,\"y\":0,\"width\":50,\"height\":80}"
```

설치 경로가 다르면:

```bat
set CAD_APP_PATH=C:\Path\To\CADViewer
"%CAD_APP_PATH%\resources\cad-cli.cmd" export_json
```
경로에 공백이 있으면 반드시 따옴표로 감싸세요.

## 환경 변수

- `CAD_APP_NAME`: 기본 앱 이름 (기본값: `CADViewer`)
- `CAD_APP_PATH`: 앱 설치 경로
- `CAD_SCENE_PATH`: scene.json 저장 경로 강제 지정
- `CAD_STATE_PATH`: CLI 상태 파일 경로

## 참고

- 앱이 실행 중이면 즉시 화면에 반영됩니다.
- 앱을 종료해도 `cad-cli`로 scene.json을 갱신할 수 있고, 다음 실행 시 상태가 유지됩니다.
- 현재 Linux 배포는 제외되어 있습니다.
