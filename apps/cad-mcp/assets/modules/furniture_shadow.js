// Furniture Shadow
// 가구 그림자 유틸리티
// - isometric 가구 아래 부드러운 그림자
//
// 사용법:
//   import 'furniture_shadow'
//   furnitureShadow('shadow', 0, 0, 80, 40);
//
// 조립 예시:
//   // 소파 + 그림자
//   furnitureShadow('sofa_shadow', 0, -40, 105, 55);
//   sofa('sofa', 0, -40, 0, 100, 50, 38, J.white);
//
//   // 테이블 + 그림자
//   furnitureShadow('table_shadow', 0, 20, 65, 38);
//   coffeeTable('table', 0, 20, 0, 60, 35, 18);
//
//   // 침대 + 그림자 (복층)
//   furnitureShadow('bed_shadow', 0, 80, 100, 125);
//   bed('bed', 0, 80, 50, 95, 120, J.oak, J.white, 148);
//
// @builtin true
// @version 1.0.0

// 의존성: interior_lib, japandi_palette (japandi_lib에서 로드)
// 필요 심볼: japandiShadow (rgba(0,0,0,0.25)), box (primitives)

// 가구 그림자 추가
// name: 이름, x/y: 좌표, w/d: 너비/깊이, offset: 오프셋 (기본 4)
function furnitureShadow(name, x, y, w, d, offset) {
  offset = typeof offset === 'number' ? offset : 4;
  box(name, x - offset, y, 0.5, w, d, 1, japandiShadow);
}
