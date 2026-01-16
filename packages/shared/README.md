# @ai-native-cad/shared

AI-Native CAD 프로젝트의 공유 타입 및 Zod 스키마 패키지.

## 설치

```bash
pnpm add @ai-native-cad/shared
```

## 사용법

```typescript
import {
  WSMessageSchema,
  validateMessage,
  safeValidateMessage,
  type WSMessage,
  type Scene
} from '@ai-native-cad/shared';

// 메시지 검증
const message = validateMessage(rawData); // throws on invalid

// 안전한 검증 (실패 시 null 반환)
const message = safeValidateMessage(rawData);
if (message) {
  // 유효한 메시지
}
```

## 내보내기

### 스키마
- `WSMessageSchema` - WebSocket 메시지 discriminated union 스키마
- `SceneSchema` - 씬 데이터 스키마
- `SceneUpdateDataSchema` - 씬 업데이트 데이터 스키마
- `SelectionDataSchema` - 선택 데이터 스키마
- `ConnectionDataSchema` - 연결 데이터 스키마
- `ErrorDataSchema` - 에러 데이터 스키마

### 타입
- `WSMessage` - WebSocket 메시지 타입
- `WSMessageType` - 메시지 타입 리터럴 유니온
- `Scene` - 씬 타입
- `SceneUpdateData`, `SelectionData`, `ConnectionData`, `ErrorData`

### 유틸리티
- `validateMessage(raw: unknown): WSMessage` - 검증 (실패 시 throw)
- `safeValidateMessage(raw: unknown): WSMessage | null` - 안전한 검증

## 개발

```bash
# 빌드
pnpm build

# 타입 체크
pnpm typecheck

# 테스트
pnpm test

# 린트
pnpm lint
```
