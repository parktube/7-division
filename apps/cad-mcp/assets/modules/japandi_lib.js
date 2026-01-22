// Japandi Interior Component Library
// Japandi 스타일 인테리어 컴포넌트 집합 모듈
// - 개별 모듈을 하나로 묶어 편리하게 사용
//
// 사용법:
//   import 'japandi_lib'  // 모든 컴포넌트 로드
//
// 또는 필요한 모듈만 개별 import:
//   import 'lattice_wall'     // 나무 격자벽
//   import 'balcony_window'   // 베란다 창문
//   import 'glass_railing'    // 유리 난간
//   import 'wall_decor'       // 플로팅 선반, 벽 액자
//   import 'furniture_shadow' // 가구 그림자
//
// 조립 예시 (복층 원룸):
//   import 'japandi_lib'
//   import 'interior_lib'
//
//   // 바닥 + 벽
//   parquetFloor('floor', 0, 0, 0, 300, 300, 40, 4, J.oak);
//   box('wall_back', 0, 140, 0, 300, 10, 280, J.white);
//
//   // 격자벽 (공간 분리)
//   woodLatticeWall('lattice', -150, 0, 140, 0, 280);
//
//   // 거실 가구
//   furnitureShadow('tv_shadow', -80, 100, 85, 28);
//   tvStandSet('tv', -80, 100, 0);
//   furnitureShadow('sofa_shadow', -80, -40, 105, 55);
//   sofa('sofa', -80, -40, 0, 100, 50, 38, J.white);
//
//   // 복층 플랫폼 + 난간
//   sunkenPlatformWithStairs('platform', 140, 140, 150, 150, 50, 60, 50, 4, J.white);
//   glassRailing('railing', -10, 140, 150, 150, 50);
//
//   // 복층 침실
//   bed('bed', 65, 75, 50, 95, 120, J.oak, J.white, 148);
//   floatingShelf('shelf', 65, 139, 115);
//   wallFrameSet('frames', 65, 139, 145);
//
// 포함된 모듈:
// - japandi_palette: 색상 팔레트 (japandiOak, japandiGlass, artBeige 등)
// - lattice_wall: woodLatticeWall()
// - balcony_window: balconyWindow()
// - glass_railing: glassRailing()
// - wall_decor: floatingShelf(), wallFrame(), wallFrameSet()
// - furniture_shadow: furnitureShadow()
//
// @builtin true
// @version 2.0.0

// 의존성
import 'interior_lib'
import 'tv_stand_lib'

// 개별 컴포넌트 모듈
import 'japandi_palette'
import 'lattice_wall'
import 'balcony_window'
import 'glass_railing'
import 'wall_decor'
import 'furniture_shadow'
