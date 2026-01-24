let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    }
}

let WASM_VECTOR_LEN = 0;

const SceneFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_scene_free(ptr >>> 0, 1));

export class Scene {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SceneFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_scene_free(ptr, 0);
    }
    /**
     * @param {string} name
     */
    constructor(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_new(ptr0, len0);
        this.__wbg_ptr = ret >>> 0;
        SceneFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {string}
     */
    get_name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.scene_get_name(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    entity_count() {
        const ret = wasm.scene_entity_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Scene을 JSON으로 내보냅니다.
     * @returns {string}
     */
    export_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.scene_export_json(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Scene을 SVG로 내보냅니다.
     * @returns {string}
     */
    export_svg() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.scene_export_svg(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * 선분(Line) 도형을 생성합니다.
     *
     * # Arguments
     * * `name` - Entity 이름 (예: "spine", "left_arm") - Scene 내 unique
     * * `points` - [x1, y1, x2, y2, ...] 형태의 Float64Array
     *
     * # Returns
     * * Ok(name) - 성공 시 name 반환
     * * Err - name 중복 또는 잘못된 입력
     *
     * # 입력 보정 (AC3)
     * 홀수 개 좌표가 주어지면 마지막 좌표를 무시하고 정상 처리
     * @param {string} name
     * @param {Float64Array} points
     * @returns {string}
     */
    add_line(name, points) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.scene_add_line(this.__wbg_ptr, ptr0, len0, points);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * 원(Circle) 도형을 생성합니다.
     *
     * # Arguments
     * * `name` - Entity 이름 (예: "head", "joint_elbow") - Scene 내 unique
     * * `x` - 중심점 x 좌표
     * * `y` - 중심점 y 좌표
     * * `radius` - 반지름 (음수/0 → abs().max(0.001)로 보정)
     *
     * # Returns
     * * Ok(name) - 성공 시 name 반환
     *
     * # Errors
     * * name 중복 시 에러
     * * x, y, radius 중 NaN 또는 Infinity 입력 시 에러
     *
     * # 입력 보정 (AC2)
     * 음수/0 반지름은 abs().max(0.001)로 양수 변환
     * @param {string} name
     * @param {number} x
     * @param {number} y
     * @param {number} radius
     * @returns {string}
     */
    add_circle(name, x, y, radius) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.scene_add_circle(this.__wbg_ptr, ptr0, len0, x, y, radius);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * 사각형(Rect) 도형을 생성합니다.
     *
     * # Arguments
     * * `name` - Entity 이름 (예: "torso", "background") - Scene 내 unique
     * * `x` - 원점 x 좌표 (Y-up 중심 좌표계)
     * * `y` - 원점 y 좌표 (Y-up 중심 좌표계)
     * * `width` - 너비 (음수/0 → abs().max(0.001)로 보정)
     * * `height` - 높이 (음수/0 → abs().max(0.001)로 보정)
     *
     * # Returns
     * * Ok(name) - 성공 시 name 반환
     *
     * # Errors
     * * name 중복 시 에러
     * * x, y, width, height 중 NaN 또는 Infinity 입력 시 에러
     *
     * # 입력 보정 (AC2)
     * 음수/0 크기는 abs().max(0.001)로 양수 변환
     * @param {string} name
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @returns {string}
     */
    add_rect(name, x, y, width, height) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.scene_add_rect(this.__wbg_ptr, ptr0, len0, x, y, width, height);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * 호(Arc) 도형을 생성합니다.
     *
     * # Arguments
     * * `name` - Entity 이름 (예: "shoulder_arc") - Scene 내 unique
     * * `cx` - 중심점 x 좌표
     * * `cy` - 중심점 y 좌표
     * * `radius` - 반지름 (음수/0 → abs().max(0.001)로 보정)
     * * `start_angle` - 시작 각도 (라디안, 0 = 3시 방향)
     * * `end_angle` - 끝 각도 (라디안, 양수 = CCW)
     *
     * # Returns
     * * Ok(name) - 성공 시 name 반환
     *
     * # Errors
     * * name 중복 시 에러
     * * NaN 또는 Infinity 입력 시 에러
     *
     * # 입력 보정
     * 음수/0 반지름은 abs().max(0.001)로 양수 변환
     * @param {string} name
     * @param {number} cx
     * @param {number} cy
     * @param {number} radius
     * @param {number} start_angle
     * @param {number} end_angle
     * @returns {string}
     */
    add_arc(name, cx, cy, radius, start_angle, end_angle) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.scene_add_arc(this.__wbg_ptr, ptr0, len0, cx, cy, radius, start_angle, end_angle);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * 스타일이 적용된 호(Arc)를 생성합니다.
     *
     * # Arguments
     * * `name` - Entity 이름 - Scene 내 unique
     * * `cx` - 중심점 x 좌표
     * * `cy` - 중심점 y 좌표
     * * `radius` - 반지름 (음수/0 → abs().max(0.001)로 보정)
     * * `start_angle` - 시작 각도 (라디안)
     * * `end_angle` - 끝 각도 (라디안)
     * * `style_json` - 스타일 JSON (파싱 실패 시 기본 스타일 사용)
     *
     * # Returns
     * * Ok(name) - 성공 시 name 반환
     *
     * # Errors
     * * name 중복 시 에러
     * * NaN 또는 Infinity 입력 시 에러
     * @param {string} name
     * @param {number} cx
     * @param {number} cy
     * @param {number} radius
     * @param {number} start_angle
     * @param {number} end_angle
     * @param {string} style_json
     * @returns {string}
     */
    draw_arc(name, cx, cy, radius, start_angle, end_angle, style_json) {
        let deferred4_0;
        let deferred4_1;
        try {
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(style_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            const ret = wasm.scene_draw_arc(this.__wbg_ptr, ptr0, len0, cx, cy, radius, start_angle, end_angle, ptr1, len1);
            var ptr3 = ret[0];
            var len3 = ret[1];
            if (ret[3]) {
                ptr3 = 0; len3 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred4_0 = ptr3;
            deferred4_1 = len3;
            return getStringFromWasm0(ptr3, len3);
        } finally {
            wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * 스타일이 적용된 원(Circle)을 생성합니다.
     *
     * # Arguments
     * * `name` - Entity 이름 (예: "head") - Scene 내 unique
     * * `x` - 중심점 x 좌표
     * * `y` - 중심점 y 좌표
     * * `radius` - 반지름 (음수/0 → abs().max(0.001)로 보정)
     * * `style_json` - 스타일 JSON (파싱 실패 시 기본 스타일 사용)
     *
     * # Returns
     * * Ok(name) - 성공 시 name 반환
     *
     * # Errors
     * * name 중복 시 에러
     * * NaN 또는 Infinity 입력 시 에러
     * @param {string} name
     * @param {number} x
     * @param {number} y
     * @param {number} radius
     * @param {string} style_json
     * @returns {string}
     */
    draw_circle(name, x, y, radius, style_json) {
        let deferred4_0;
        let deferred4_1;
        try {
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(style_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            const ret = wasm.scene_draw_circle(this.__wbg_ptr, ptr0, len0, x, y, radius, ptr1, len1);
            var ptr3 = ret[0];
            var len3 = ret[1];
            if (ret[3]) {
                ptr3 = 0; len3 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred4_0 = ptr3;
            deferred4_1 = len3;
            return getStringFromWasm0(ptr3, len3);
        } finally {
            wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * 스타일이 적용된 선분(Line)을 생성합니다.
     *
     * # Arguments
     * * `name` - Entity 이름 (예: "spine") - Scene 내 unique
     * * `points` - [x1, y1, x2, y2, ...] 형태의 Float64Array
     * * `style_json` - 스타일 JSON (파싱 실패 시 기본 스타일 사용)
     *
     * # Returns
     * * Ok(name) - 성공 시 name 반환
     *
     * # Errors
     * * name 중복 시 에러
     * * 좌표에 NaN/Infinity 포함 시 에러
     * * 최소 2점 미만 시 에러
     * @param {string} name
     * @param {Float64Array} points
     * @param {string} style_json
     * @returns {string}
     */
    draw_line(name, points, style_json) {
        let deferred4_0;
        let deferred4_1;
        try {
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(style_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            const ret = wasm.scene_draw_line(this.__wbg_ptr, ptr0, len0, points, ptr1, len1);
            var ptr3 = ret[0];
            var len3 = ret[1];
            if (ret[3]) {
                ptr3 = 0; len3 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred4_0 = ptr3;
            deferred4_1 = len3;
            return getStringFromWasm0(ptr3, len3);
        } finally {
            wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * 닫힌 다각형(Polygon)을 생성합니다. fill 지원.
     *
     * # Arguments
     * * `name` - Entity 이름 (예: "mountain") - Scene 내 unique
     * * `points` - Float64Array [x1, y1, x2, y2, ...] (최소 3점, 6개 값)
     * * `style_json` - 스타일 JSON (파싱 실패 시 기본 스타일 사용)
     *
     * # Returns
     * * Ok(name) - 성공 시 name 반환
     *
     * # Errors
     * * name 중복 시 에러
     * * 3점 미만 시 에러
     * @param {string} name
     * @param {Float64Array} points
     * @param {string} style_json
     * @returns {string}
     */
    draw_polygon(name, points, style_json) {
        let deferred4_0;
        let deferred4_1;
        try {
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(style_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            const ret = wasm.scene_draw_polygon(this.__wbg_ptr, ptr0, len0, points, ptr1, len1);
            var ptr3 = ret[0];
            var len3 = ret[1];
            if (ret[3]) {
                ptr3 = 0; len3 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred4_0 = ptr3;
            deferred4_1 = len3;
            return getStringFromWasm0(ptr3, len3);
        } finally {
            wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * 스타일이 적용된 베지어 커브를 생성합니다.
     *
     * # Arguments
     * * `name` - Entity 이름 (예: "curve1") - Scene 내 unique
     * * `points` - 좌표 배열 [start_x, start_y, cp1_x, cp1_y, cp2_x, cp2_y, end_x, end_y, ...]
     *              첫 8개는 첫 세그먼트 (시작점, 제어점1, 제어점2, 끝점)
     *              이후 6개씩 추가 세그먼트 (제어점1, 제어점2, 끝점)
     * * `closed` - true면 닫힌 경로 (fill 적용 가능)
     * * `style_json` - 스타일 JSON
     *
     * # Returns
     * * Ok(name) - 성공 시 name 반환
     *
     * # Errors
     * * name 중복 시 에러
     * * 최소 8개 좌표 (4점) 필요
     * @param {string} name
     * @param {Float64Array} points
     * @param {boolean} closed
     * @param {string} style_json
     * @returns {string}
     */
    draw_bezier(name, points, closed, style_json) {
        let deferred4_0;
        let deferred4_1;
        try {
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(style_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            const ret = wasm.scene_draw_bezier(this.__wbg_ptr, ptr0, len0, points, closed, ptr1, len1);
            var ptr3 = ret[0];
            var len3 = ret[1];
            if (ret[3]) {
                ptr3 = 0; len3 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred4_0 = ptr3;
            deferred4_1 = len3;
            return getStringFromWasm0(ptr3, len3);
        } finally {
            wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * 스타일이 적용된 사각형(Rect)을 생성합니다.
     *
     * # Arguments
     * * `name` - Entity 이름 (예: "torso") - Scene 내 unique
     * * `x` - 중심 x 좌표
     * * `y` - 중심 y 좌표
     * * `width` - 너비 (음수/0 → abs().max(0.001)로 보정)
     * * `height` - 높이 (음수/0 → abs().max(0.001)로 보정)
     * * `style_json` - 스타일 JSON (파싱 실패 시 기본 스타일 사용)
     *
     * # Returns
     * * Ok(name) - 성공 시 name 반환
     *
     * # Errors
     * * name 중복 시 에러
     * * NaN 또는 Infinity 입력 시 에러
     * @param {string} name
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {string} style_json
     * @returns {string}
     */
    draw_rect(name, x, y, width, height, style_json) {
        let deferred4_0;
        let deferred4_1;
        try {
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(style_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            const ret = wasm.scene_draw_rect(this.__wbg_ptr, ptr0, len0, x, y, width, height, ptr1, len1);
            var ptr3 = ret[0];
            var len3 = ret[1];
            if (ret[3]) {
                ptr3 = 0; len3 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred4_0 = ptr3;
            deferred4_1 = len3;
            return getStringFromWasm0(ptr3, len3);
        } finally {
            wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * 기존 도형의 stroke 스타일을 변경합니다.
     *
     * # Arguments
     * * `name` - Entity 이름 (예: "head", "left_arm")
     * * `stroke_json` - StrokeStyle JSON (부분 업데이트 지원)
     *
     * # Returns
     * * Ok(true) - 성공
     * * Ok(false) - name 미발견
     *
     * # Partial Update (AC6)
     * 기존 stroke가 있는 경우, JSON에 명시된 필드만 업데이트됩니다.
     * 예: { "color": [1,0,0,1] } → color만 변경, 나머지 유지
     * @param {string} name
     * @param {string} stroke_json
     * @returns {boolean}
     */
    set_stroke(name, stroke_json) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(stroke_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.scene_set_stroke(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * 기존 도형의 fill 스타일을 변경합니다.
     *
     * # Arguments
     * * `name` - Entity 이름
     * * `fill_json` - FillStyle JSON
     *
     * # Returns
     * * Ok(true) - 성공
     * * Ok(false) - name 미발견
     * @param {string} name
     * @param {string} fill_json
     * @returns {boolean}
     */
    set_fill(name, fill_json) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(fill_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.scene_set_fill(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * stroke를 제거합니다 (선 없음).
     *
     * # Arguments
     * * `name` - Entity 이름
     *
     * # Returns
     * * Ok(true) - 성공
     * * Ok(false) - name 미발견
     * @param {string} name
     * @returns {boolean}
     */
    remove_stroke(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_remove_stroke(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * fill을 제거합니다 (채움 없음).
     *
     * # Arguments
     * * `name` - Entity 이름
     *
     * # Returns
     * * Ok(true) - 성공
     * * Ok(false) - name 미발견
     * @param {string} name
     * @returns {boolean}
     */
    remove_fill(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_remove_fill(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Entity를 지정된 거리만큼 이동합니다.
     *
     * # Arguments
     * * `name` - 대상 Entity의 이름 (예: "left_arm")
     * * `dx` - x축 이동 거리
     * * `dy` - y축 이동 거리
     *
     * # Returns
     * * Ok(true) - 성공
     * * Ok(false) - name 미발견 (no-op)
     * @param {string} name
     * @param {number} dx
     * @param {number} dy
     * @returns {boolean}
     */
    translate(name, dx, dy) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_translate(this.__wbg_ptr, ptr0, len0, dx, dy);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Entity를 지정된 각도만큼 회전합니다.
     *
     * # Arguments
     * * `name` - 대상 Entity의 이름 (예: "left_arm")
     * * `angle` - 회전 각도 (라디안, 양수 = 반시계방향)
     *
     * # Returns
     * * Ok(true) - 성공
     * * Ok(false) - name 미발견 (no-op)
     * @param {string} name
     * @param {number} angle
     * @returns {boolean}
     */
    rotate(name, angle) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_rotate(this.__wbg_ptr, ptr0, len0, angle);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Entity를 지정된 배율로 크기를 변경합니다.
     *
     * # Arguments
     * * `name` - 대상 Entity의 이름 (예: "left_arm")
     * * `sx` - x축 스케일 배율
     * * `sy` - y축 스케일 배율
     *
     * # Returns
     * * Ok(true) - 성공
     * * Ok(false) - name 미발견 (no-op)
     * @param {string} name
     * @param {number} sx
     * @param {number} sy
     * @returns {boolean}
     */
    scale(name, sx, sy) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_scale(this.__wbg_ptr, ptr0, len0, sx, sy);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Entity를 월드 좌표 기준으로 이동합니다.
     *
     * 부모 그룹의 scale을 역산하여 로컬 delta로 변환 후 적용합니다.
     *
     * # Arguments
     * * `name` - 대상 Entity의 이름
     * * `dx` - 월드 좌표 x축 이동 거리
     * * `dy` - 월드 좌표 y축 이동 거리
     *
     * # Returns
     * * Ok(true) - 성공
     * * Ok(false) - name 미발견 (no-op)
     * @param {string} name
     * @param {number} dx
     * @param {number} dy
     * @returns {boolean}
     */
    translate_world(name, dx, dy) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_translate_world(this.__wbg_ptr, ptr0, len0, dx, dy);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Entity를 월드 좌표 기준으로 스케일합니다.
     *
     * 부모 그룹의 scale을 역산하여 로컬 scale로 변환 후 적용합니다.
     *
     * # Arguments
     * * `name` - 대상 Entity의 이름
     * * `sx` - 월드 좌표 x축 스케일 배율
     * * `sy` - 월드 좌표 y축 스케일 배율
     *
     * # Returns
     * * Ok(true) - 성공
     * * Ok(false) - name 미발견 (no-op)
     * @param {string} name
     * @param {number} sx
     * @param {number} sy
     * @returns {boolean}
     */
    scale_world(name, sx, sy) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_scale_world(this.__wbg_ptr, ptr0, len0, sx, sy);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Entity를 삭제합니다.
     *
     * # Arguments
     * * `name` - 삭제할 Entity의 이름
     *
     * # Returns
     * * Ok(true) - 삭제 성공
     * * Ok(false) - name 미발견 (no-op)
     * @param {string} name
     * @returns {boolean}
     */
    delete(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_delete(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Entity의 회전/스케일 중심점(pivot)을 설정합니다.
     *
     * # Arguments
     * * `name` - Entity 이름
     * * `px` - pivot x 좌표 (로컬 좌표계)
     * * `py` - pivot y 좌표 (로컬 좌표계)
     *
     * # Returns
     * * Ok(true) - 성공
     * * Ok(false) - name 미발견 (no-op)
     *
     * # Notes
     * pivot은 rotate/scale 변환의 중심점입니다.
     * 기본값 [0, 0]은 엔티티의 로컬 원점입니다.
     * @param {string} name
     * @param {number} px
     * @param {number} py
     * @returns {boolean}
     */
    set_pivot(name, px, py) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_set_pivot(this.__wbg_ptr, ptr0, len0, px, py);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Entity의 z-order(렌더링 순서)를 설정합니다.
     *
     * # Arguments
     * * `name` - Entity 이름
     * * `z_index` - z-order 값 (높을수록 앞에 렌더링)
     *
     * # Returns
     * * Ok(true) - 성공
     * * Ok(false) - name 미발견 (no-op)
     *
     * # Notes
     * z_index가 같으면 생성 순서대로 렌더링됩니다.
     * 음수 값도 허용됩니다.
     * @param {string} name
     * @param {number} z_index
     * @returns {boolean}
     */
    set_z_order(name, z_index) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_set_z_order(this.__wbg_ptr, ptr0, len0, z_index);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Entity의 z_index를 조회합니다.
     *
     * # Arguments
     * * `name` - Entity 이름
     *
     * # Returns
     * * Some(z_index) - Entity의 z_index
     * * None - name 미발견
     * @param {string} name
     * @returns {number | undefined}
     */
    get_z_order(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_get_z_order(this.__wbg_ptr, ptr0, len0);
        return ret === 0x100000001 ? undefined : ret;
    }
    /**
     * 여러 Entity를 그룹으로 묶습니다. (WASM 바인딩)
     *
     * # Arguments
     * * `name` - 그룹 이름 (예: "left_arm") - Scene 내 unique
     * * `children_json` - 자식 Entity 이름들의 JSON 배열 (예: '["upper_arm", "lower_arm"]')
     *
     * # Returns
     * * Ok(name) - 성공 시 그룹 name 반환
     *
     * # Errors
     * * name 중복 시 에러
     *
     * # 입력 보정 (AC2)
     * 존재하지 않는 자식 이름은 무시하고 정상 생성
     * @param {string} name
     * @param {string} children_json
     * @returns {string}
     */
    create_group(name, children_json) {
        let deferred4_0;
        let deferred4_1;
        try {
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(children_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            const ret = wasm.scene_create_group(this.__wbg_ptr, ptr0, len0, ptr1, len1);
            var ptr3 = ret[0];
            var len3 = ret[1];
            if (ret[3]) {
                ptr3 = 0; len3 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred4_0 = ptr3;
            deferred4_1 = len3;
            return getStringFromWasm0(ptr3, len3);
        } finally {
            wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * 그룹을 해제하여 자식들을 독립 엔티티로 만듭니다. (WASM 바인딩)
     *
     * # Arguments
     * * `name` - 해제할 그룹 이름
     *
     * # Returns
     * * Ok(true) - 그룹 해제 성공
     * * Ok(false) - name이 존재하지 않음
     *
     * # Errors
     * * name이 Group 타입이 아니면 에러
     * @param {string} name
     * @returns {boolean}
     */
    ungroup(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_ungroup(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * 그룹에 Entity를 추가합니다. (WASM 바인딩)
     *
     * # Arguments
     * * `group_name` - 그룹 이름
     * * `entity_name` - 추가할 Entity 이름
     *
     * # Returns
     * * Ok(true) - 추가 성공
     * * Ok(false) - group_name 또는 entity_name이 존재하지 않음
     *
     * # Errors
     * * group_name이 Group 타입이 아니면 에러
     *
     * # Notes
     * 이미 다른 그룹에 속한 Entity는 기존 그룹에서 제거 후 추가됩니다.
     * @param {string} group_name
     * @param {string} entity_name
     * @returns {boolean}
     */
    add_to_group(group_name, entity_name) {
        const ptr0 = passStringToWasm0(group_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(entity_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.scene_add_to_group(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * 그룹에서 Entity를 제거합니다. (WASM 바인딩)
     *
     * # Arguments
     * * `group_name` - 그룹 이름
     * * `entity_name` - 제거할 Entity 이름
     *
     * # Returns
     * * Ok(true) - 제거 성공
     * * Ok(false) - group_name 또는 entity_name이 존재하지 않음, 또는 해당 그룹의 자식이 아님
     *
     * # Errors
     * * group_name이 Group 타입이 아니면 에러
     * @param {string} group_name
     * @param {string} entity_name
     * @returns {boolean}
     */
    remove_from_group(group_name, entity_name) {
        const ptr0 = passStringToWasm0(group_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(entity_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.scene_remove_from_group(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Scene 내 모든 Entity의 이름과 타입을 반환합니다.
     *
     * # Returns
     * JSON 배열: [{"name": "head", "type": "Circle"}, ...]
     *
     * # Examples
     * ```ignore
     * let list = scene.list_entities();
     * // [{"name":"wall","type":"Rect"},{"name":"door","type":"Arc"}]
     * ```
     * @returns {string}
     */
    list_entities() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.scene_list_entities(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * 이름으로 Entity를 조회하여 전체 JSON을 반환합니다.
     *
     * # Arguments
     * * `name` - Entity 이름
     *
     * # Returns
     * * Some(JSON) - Entity가 존재하면 전체 JSON 반환
     * * None - Entity가 없으면 None
     *
     * # Examples
     * ```ignore
     * if let Some(json) = scene.get_entity("head") {
     *     // {"id":"...","entity_type":"Circle",...}
     * }
     * ```
     * @param {string} name
     * @returns {string | undefined}
     */
    get_entity(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_get_entity(this.__wbg_ptr, ptr0, len0);
        let v2;
        if (ret[0] !== 0) {
            v2 = getStringFromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v2;
    }
    /**
     * Entity의 상세 정보를 local/world 좌표 포함하여 반환합니다 (FR42).
     *
     * # Arguments
     * * `name` - Entity 이름
     *
     * # Returns
     * * Some(JSON) - local/world 좌표 포함 상세 정보
     * * None - Entity가 없으면 None
     *
     * # JSON Format
     * ```json
     * {
     *   "name": "house1_wall",
     *   "type": "Rect",
     *   "parent": "house1",
     *   "local": {
     *     "geometry": {...},
     *     "transform": {...},
     *     "bounds": {"min": [x, y], "max": [x, y]}
     *   },
     *   "world": {
     *     "bounds": {"min_x": ..., "min_y": ..., "max_x": ..., "max_y": ...},
     *     "center": [x, y]
     *   }
     * }
     * ```
     * @param {string} name
     * @returns {string | undefined}
     */
    get_entity_detailed(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_get_entity_detailed(this.__wbg_ptr, ptr0, len0);
        let v2;
        if (ret[0] !== 0) {
            v2 = getStringFromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v2;
    }
    /**
     * Scene의 전체 정보를 반환합니다.
     *
     * # Returns
     * JSON 객체: {"name": "scene-name", "entity_count": 5, "bounds": {"min": [x,y], "max": [x,y]}}
     * bounds가 null이면 Scene이 비어있음
     *
     * # Examples
     * ```ignore
     * let info = scene.get_scene_info();
     * // {"name":"my-scene","entity_count":2,"bounds":{"min":[0,0],"max":[100,100]}}
     * ```
     * @returns {string}
     */
    get_scene_info() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.scene_get_scene_info(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Entity의 월드 변환 행렬을 반환합니다.
     *
     * # Arguments
     * * `name` - Entity 이름
     *
     * # Returns
     * * Some(JSON) - 3x3 행렬 JSON: [[a, b, tx], [c, d, ty], [0, 0, 1]]
     * * None - Entity가 없으면 None
     *
     * # 변환 상속
     * 부모 그룹의 변환이 자식에게 상속됩니다.
     * 반환되는 행렬은 모든 조상의 변환이 결합된 최종 월드 변환입니다.
     * @param {string} name
     * @returns {string | undefined}
     */
    get_world_transform(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_get_world_transform(this.__wbg_ptr, ptr0, len0);
        let v2;
        if (ret[0] !== 0) {
            v2 = getStringFromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v2;
    }
    /**
     * 로컬 좌표를 월드 좌표로 변환합니다.
     *
     * # Arguments
     * * `name` - Entity 이름 (이 엔티티의 좌표계 기준)
     * * `x` - 로컬 x 좌표
     * * `y` - 로컬 y 좌표
     *
     * # Returns
     * * Some(JSON) - 월드 좌표: {"x": ..., "y": ...}
     * * None - Entity가 없으면 None
     * @param {string} name
     * @param {number} x
     * @param {number} y
     * @returns {string | undefined}
     */
    get_world_point(name, x, y) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_get_world_point(this.__wbg_ptr, ptr0, len0, x, y);
        let v2;
        if (ret[0] !== 0) {
            v2 = getStringFromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v2;
    }
    /**
     * Entity의 월드 좌표 바운딩 박스를 반환합니다.
     *
     * # Arguments
     * * `name` - Entity 이름
     *
     * # Returns
     * * Some(JSON) - {"min": [x, y], "max": [x, y]}
     * * None - Entity가 없거나 빈 그룹이면 None
     *
     * # Notes
     * 변환(translate, rotate, scale)이 적용된 최종 월드 좌표 바운드입니다.
     * 그룹의 경우 모든 자식의 바운드를 포함합니다.
     * @param {string} name
     * @returns {string | undefined}
     */
    get_world_bounds(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_get_world_bounds(this.__wbg_ptr, ptr0, len0);
        let v2;
        if (ret[0] !== 0) {
            v2 = getStringFromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v2;
    }
    /**
     * Entity가 존재하는지 확인합니다.
     *
     * # Arguments
     * * `name` - Entity 이름
     *
     * # Returns
     * * true - Entity 존재
     * * false - Entity 없음
     * @param {string} name
     * @returns {boolean}
     */
    exists(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scene_exists(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
}
if (Symbol.dispose) Scene.prototype[Symbol.dispose] = Scene.prototype.free;

/**
 * 테스트용 인사 함수
 *
 * # Arguments
 * * `name` - 인사할 대상 이름
 *
 * # Returns
 * "Hello, {name}!" 형태의 문자열
 * @param {string} name
 * @returns {string}
 */
export function greet(name) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.greet(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * WASM 모듈 초기화 함수
 * Node.js에서 모듈 로드 시 자동 실행
 * - dev feature 활성화 시 패닉 훅 설정 (디버깅 개선)
 */
export function init() {
    wasm.init();
}

export function __wbg___wbindgen_throw_dd24417ed36fc46e(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
};

export function __wbg_getRandomValues_9b655bdd369112f2() { return handleError(function (arg0, arg1) {
    globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
}, arguments) };

export function __wbg_length_406f6daaaa453057(arg0) {
    const ret = arg0.length;
    return ret;
};

export function __wbg_prototypesetcall_d3c4edbb4ef96ca1(arg0, arg1, arg2) {
    Float64Array.prototype.set.call(getArrayF64FromWasm0(arg0, arg1), arg2);
};

export function __wbindgen_cast_2241b6af4c4b2941(arg0, arg1) {
    // Cast intrinsic for `Ref(String) -> Externref`.
    const ret = getStringFromWasm0(arg0, arg1);
    return ret;
};

export function __wbindgen_init_externref_table() {
    const table = wasm.__wbindgen_externrefs;
    const offset = table.grow(4);
    table.set(0, undefined);
    table.set(offset + 0, undefined);
    table.set(offset + 1, null);
    table.set(offset + 2, true);
    table.set(offset + 3, false);
};
