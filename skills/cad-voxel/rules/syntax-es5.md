# syntax-es5: ES5 호환성 규칙

## 규칙

CAD 코드는 **ES5 문법**만 사용해야 한다. `const`, `let`, 화살표 함수, 템플릿 리터럴 등 ES6+ 문법은 사용 불가.

## 이유

- CAD 엔진의 JavaScript 인터프리터가 ES5만 지원
- ES6 문법 사용 시 파싱 에러 발생
- 모듈 간 일관성 유지

## 올바른 문법

```javascript
// 변수 선언
var x = 10;
var name = 'entity';

// 함수 선언
function createBox(name, x, y) {
  var result = name + '_box';
  return result;
}

// 문자열 연결
var fullName = 'car_' + id + '_body';

// 배열 순회
for (var i = 0; i < items.length; i++) {
  processItem(items[i]);
}

// 객체
var config = {
  color: [1, 0, 0, 1],
  size: 10
};
```

## 금지 문법

```javascript
// ❌ const/let
const x = 10;
let y = 20;

// ❌ 화살표 함수
items.forEach(item => process(item));
var fn = (x) => x * 2;

// ❌ 템플릿 리터럴
var name = `car_${id}_body`;

// ❌ 구조 분해
var { x, y } = point;
var [first, second] = array;

// ❌ 스프레드 연산자
var newArray = [...oldArray, newItem];

// ❌ 클래스 문법 (일부 지원되나 권장 안 함)
class Car extends Vehicle { }

// ❌ for...of
for (var item of items) { }
```

## 에러 메시지 예시

```
SyntaxError: Unexpected token 'const'
SyntaxError: Unexpected token '=>'
SyntaxError: Unexpected token '`'
```

## 팁

- IDE에서 ES5 린트 규칙 적용 권장
- `var`를 습관적으로 사용
- 문자열 연결은 `+` 연산자 사용
