use wasm_bindgen::prelude::*;

pub mod primitives;
pub mod scene;
pub mod serializers;

pub use scene::Scene;

/// WASM 모듈 초기화 함수
/// Node.js에서 모듈 로드 시 자동 실행
/// - dev feature 활성화 시 패닉 훅 설정 (디버깅 개선)
#[wasm_bindgen(start)]
pub fn init() {
    // dev 빌드에서만 패닉 시 콘솔에 스택 트레이스 출력
    #[cfg(feature = "dev")]
    console_error_panic_hook::set_once();
}

/// 테스트용 인사 함수
///
/// # Arguments
/// * `name` - 인사할 대상 이름
///
/// # Returns
/// "Hello, {name}!" 형태의 문자열
#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        assert_eq!(greet("World"), "Hello, World!");
    }

    #[test]
    fn test_greet_cad() {
        assert_eq!(greet("CAD"), "Hello, CAD!");
    }
}
