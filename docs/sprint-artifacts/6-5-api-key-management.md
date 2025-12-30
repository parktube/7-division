# Story 6.5: API 키 입력 및 관리

Status: backlog

## Story

As a **사용자 (인간)**,
I want **API 키를 입력하고 안전하게 저장할 수 있도록**,
so that **매번 API 키를 입력하지 않아도 된다**.

## Acceptance Criteria

1. **AC1: API 키 입력 UI**
   - Given: 앱 첫 실행 또는 API 키 미설정 상태
   - When: 채팅 시도
   - Then: API 키 입력 다이얼로그가 표시된다
   - And: 키를 입력하고 저장할 수 있다

2. **AC2: API 키 저장**
   - Given: 사용자가 API 키를 입력
   - When: 저장 버튼 클릭
   - Then: API 키가 로컬에 안전하게 저장된다
   - And: 앱 재시작 후에도 유지된다

3. **AC3: API 키 수정**
   - Given: API 키가 이미 저장된 상태
   - When: 설정 메뉴에서 API 키 변경 선택
   - Then: 현재 키를 마스킹하여 표시 (sk-ant-...xxxx)
   - And: 새 키로 교체할 수 있다

4. **AC4: API 키 삭제**
   - Given: API 키가 저장된 상태
   - When: 설정에서 키 삭제 선택
   - Then: 저장된 키가 제거된다
   - And: 다음 채팅 시 다시 입력 요청

5. **AC5: 오프라인 동작 (NFR17)**
   - Given: API 키가 없는 상태
   - When: CAD 명령 직접 실행 (CLI 또는 도형 선택)
   - Then: 도형 생성/편집은 정상 동작한다
   - And: 채팅만 비활성화된다

6. **AC6: 키 유효성 검증**
   - Given: 사용자가 API 키 입력
   - When: 저장 시도
   - Then: 간단한 API 호출로 키 유효성을 검증한다
   - And: 잘못된 키일 경우 에러 메시지 표시

7. **AC7: 보안 저장**
   - Given: API 키 저장
   - When: 저장 위치 확인
   - Then: 평문이 아닌 암호화된 형태로 저장된다
   - And: OS 키체인 또는 암호화된 로컬 파일 사용

## Tasks / Subtasks

- [ ] **Task 1: API 키 입력 UI** (AC: 1, 3)
  - [ ] 1.1: ApiKeyDialog.ts 컴포넌트 생성
  - [ ] 1.2: 입력 필드 (password 타입)
  - [ ] 1.3: 저장/취소 버튼
  - [ ] 1.4: 마스킹 표시 (sk-ant-...xxxx)

- [ ] **Task 2: 키 저장소 구현** (AC: 2, 4, 7)
  - [ ] 2.1: electron-store 또는 keytar 라이브러리 선택
  - [ ] 2.2: key-store.ts 서비스 생성
  - [ ] 2.3: save, load, delete 함수 구현
  - [ ] 2.4: 암호화 처리

- [ ] **Task 3: 키 유효성 검증** (AC: 6)
  - [ ] 3.1: Claude API 간단한 호출 (모델 목록 등)
  - [ ] 3.2: 성공/실패 결과 반환
  - [ ] 3.3: 에러 메시지 표시

- [ ] **Task 4: 설정 메뉴** (AC: 3, 4)
  - [ ] 4.1: 설정 버튼/메뉴 추가
  - [ ] 4.2: API 키 관리 옵션
  - [ ] 4.3: 키 변경/삭제 기능

- [ ] **Task 5: 오프라인 모드** (AC: 5)
  - [ ] 5.1: API 키 유무 확인 로직
  - [ ] 5.2: 키 없을 시 채팅 UI 비활성화
  - [ ] 5.3: CAD 기능은 정상 동작 유지
  - [ ] 5.4: "API 키를 설정하세요" 안내 메시지

- [ ] **Task 6: 테스트** (AC: 1, 2, 3, 4, 5, 6, 7)
  - [ ] 6.1: 키 입력/저장 테스트
  - [ ] 6.2: 키 로드 (앱 재시작) 테스트
  - [ ] 6.3: 키 수정/삭제 테스트
  - [ ] 6.4: 유효성 검증 테스트
  - [ ] 6.5: 오프라인 모드 테스트
  - [ ] 6.6: 저장된 키 암호화 확인

## Dev Notes

### Architecture Compliance

**보안 고려사항:**
- API 키는 민감 정보 → 평문 저장 금지
- electron-store (암호화 옵션) 또는 keytar (OS 키체인) 사용
- Renderer에서 직접 API 호출 시 키가 메모리에 존재하지만, 로컬 앱이므로 허용

**NFR17 준수:**
- API 키 없이도 CAD 기능은 완전 동작
- 채팅만 API 키 필요

### Technical Requirements

1. **electron-store 사용 (암호화)**:
   ```typescript
   import Store from 'electron-store';

   const store = new Store({
       encryptionKey: 'your-encryption-key',  // 또는 머신별 키 생성
       schema: {
           apiKey: {
               type: 'string',
           }
       }
   });

   export function saveApiKey(key: string) {
       store.set('apiKey', key);
   }

   export function loadApiKey(): string | undefined {
       return store.get('apiKey');
   }

   export function deleteApiKey() {
       store.delete('apiKey');
   }
   ```

2. **keytar 사용 (OS 키체인) - 더 안전**:
   ```typescript
   import keytar from 'keytar';

   const SERVICE_NAME = 'ai-native-cad';
   const ACCOUNT_NAME = 'claude-api-key';

   export async function saveApiKey(key: string) {
       await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, key);
   }

   export async function loadApiKey(): Promise<string | null> {
       return keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
   }

   export async function deleteApiKey() {
       await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
   }
   ```

3. **키 마스킹**:
   ```typescript
   function maskApiKey(key: string): string {
       if (key.length <= 10) return '****';
       return key.slice(0, 7) + '...' + key.slice(-4);
       // sk-ant-...abcd
   }
   ```

4. **유효성 검증**:
   ```typescript
   async function validateApiKey(key: string): Promise<boolean> {
       try {
           const client = new Anthropic({ apiKey: key });
           // 간단한 API 호출
           await client.messages.create({
               model: 'claude-sonnet-4-20250514',
               max_tokens: 10,
               messages: [{ role: 'user', content: 'test' }]
           });
           return true;
       } catch (e) {
           return false;
       }
   }
   ```

### File Structure Notes

새로 생성:
- `electron-app/src/renderer/components/ApiKeyDialog.ts`
- `electron-app/src/renderer/components/SettingsMenu.ts`
- `electron-app/src/main/services/key-store.ts` (또는 renderer에서 직접)

의존성 추가:
- `electron-store` 또는 `keytar`

### References

- [Source: docs/epics.md#Story 6.5: API 키 입력 및 관리]
- [Source: docs/architecture.md#Epic 6 보안 고려사항]
- [electron-store 문서](https://github.com/sindresorhus/electron-store)
- [keytar 문서](https://github.com/atom/node-keytar)

## Dev Agent Record

### Context Reference

- docs/epics.md (Epic 6, Story 6.5)
- docs/architecture.md (보안)

### Agent Model Used

(구현 시 기록)

### Debug Log References

(구현 시 기록)

### Completion Notes List

(구현 시 기록)

### File List

(구현 시 기록)
