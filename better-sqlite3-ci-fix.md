# better-sqlite3 CI 에러 해결 가이드

## 1. 현재 설정 검증

현재 `.github/workflows/ci.yml`에 포함된 설정:
- ✅ 빌드 도구 설치 (python3, build-essential, make, g++)
- ✅ Node.js 22 사용
- ✅ pnpm install --no-frozen-lockfile
- ✅ pnpm rebuild better-sqlite3
- ✅ Import 테스트

## 2. 추가 디버깅 방법

### 방법 1: 상세한 에러 로그 확인
```yaml
- name: Rebuild native modules (better-sqlite3) with verbose
  run: |
    cd apps/cad-mcp
    # 자세한 로그 출력
    npm_config_loglevel=verbose pnpm rebuild better-sqlite3
```

### 방법 2: node-gyp 직접 재빌드
```yaml
- name: Rebuild with node-gyp
  run: |
    cd apps/cad-mcp
    # node_modules 내부로 이동하여 직접 빌드
    cd node_modules/better-sqlite3
    npm run build-release
    cd ../..
```

### 방법 3: 플랫폼별 캐시 분리
```yaml
- name: Cache node_modules (including native bindings)
  uses: actions/cache@v4
  with:
    path: |
      node_modules
      apps/*/node_modules
      packages/*/node_modules
    key: ${{ runner.os }}-node-modules-${{ hashFiles('**/pnpm-lock.yaml') }}-${{ runner.arch }}-${{ matrix.node-version }}
    restore-keys: |
      ${{ runner.os }}-node-modules-${{ hashFiles('**/pnpm-lock.yaml') }}-${{ runner.arch }}-
```

## 3. 근본적인 해결 방법들

### 방법 A: postinstall 스크립트 추가
`apps/cad-mcp/package.json`에 추가:
```json
{
  "scripts": {
    "postinstall": "npm rebuild better-sqlite3"
  }
}
```

### 방법 B: Docker 기반 CI (완전히 격리된 환경)
```yaml
- name: Build in Docker
  run: |
    docker run --rm -v ${{ github.workspace }}:/workspace \
      -w /workspace \
      node:22-alpine \
      sh -c "
        apk add --no-cache python3 make g++ && \
        npm install -g pnpm && \
        pnpm install && \
        cd apps/cad-mcp && \
        pnpm rebuild better-sqlite3
      "
```

### 방법 C: prebuild-install 사용
prebuilt binaries를 사용하도록 설정:
```json
{
  "dependencies": {
    "better-sqlite3": "^12.6.0"
  },
  "optionalDependencies": {
    "prebuild-install": "^7.1.2"
  }
}
```

## 4. Matrix Strategy (여러 플랫폼 테스트)

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node-version: [20, 22]
runs-on: ${{ matrix.os }}
```

## 5. 환경 변수 설정

일부 native module은 환경 변수가 필요할 수 있습니다:
```yaml
env:
  PYTHON: python3
  NODE_OPTIONS: --max-old-space-size=4096
```

## 6. 트러블슈팅 체크리스트

- [ ] Node.js 버전이 로컬과 CI에서 동일한가?
- [ ] pnpm 버전이 일치하는가?
- [ ] 캐시가 오염되었는가? (캐시 키 변경으로 해결)
- [ ] 빌드 도구가 모두 설치되었는가?
- [ ] 플랫폼별 의존성이 있는가?

## 7. 임시 해결책 (최후의 수단)

캐시를 완전히 비활성화하고 매번 clean install:
```yaml
- name: Clean install without cache
  run: |
    rm -rf node_modules apps/*/node_modules packages/*/node_modules
    pnpm install --no-cache
    cd apps/cad-mcp && pnpm rebuild better-sqlite3
```
