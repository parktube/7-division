const POLL_INTERVAL_MS = 500;
const SOURCE_FILE = 'scene.json';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const entityCount = document.getElementById('entity-count');
const lastUpdated = document.getElementById('last-updated');
const lastError = document.getElementById('last-error');
const overlay = document.getElementById('canvas-overlay');

const state = {
  lastSignature: null,
  lastScene: null,
  lastError: null,
  viewport: { width: 0, height: 0 },
  pixelRatio: window.devicePixelRatio || 1,
};

let pollTimer = null;

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function setOverlay(visible, message) {
  if (message) {
    overlay.textContent = message;
  }
  overlay.classList.toggle('is-visible', visible);
}

function setStatus({ mode, message, count }) {
  statusText.textContent = message;
  if (typeof count === 'number') {
    entityCount.textContent = `${count} entities`;
  }

  statusDot.classList.remove('is-live', 'is-error');
  if (mode === 'live') {
    statusDot.classList.add('is-live');
  } else if (mode === 'error') {
    statusDot.classList.add('is-error');
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;

  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  state.viewport = { width: rect.width, height: rect.height };
  state.pixelRatio = ratio;

  if (state.lastScene) {
    renderScene(state.lastScene);
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toCssColor(color, fallback) {
  if (!Array.isArray(color) || color.length < 4) {
    return fallback;
  }
  const [r, g, b, a] = color.map((value, index) => {
    if (!Number.isFinite(value)) {
      return index === 3 ? 1 : 0;
    }
    return clamp(value, 0, 1);
  });
  const alpha = Math.round(a * 1000) / 1000;
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(
    b * 255,
  )}, ${alpha})`;
}

function mapLineCap(cap) {
  switch (cap) {
    case 'Round':
      return 'round';
    case 'Square':
      return 'square';
    default:
      return 'butt';
  }
}

function mapLineJoin(join) {
  switch (join) {
    case 'Round':
      return 'round';
    case 'Bevel':
      return 'bevel';
    default:
      return 'miter';
  }
}

function sanitizeDash(dash) {
  if (!Array.isArray(dash)) {
    return [];
  }
  return dash.filter((value) => Number.isFinite(value) && value >= 0);
}

function resolveStroke(style) {
  if (!style) {
    return {
      width: 1,
      color: [0, 0, 0, 1],
      dash: null,
      cap: 'Butt',
      join: 'Miter',
    };
  }
  return style.stroke ?? null;
}

function applyStroke(stroke) {
  if (!stroke) {
    return false;
  }
  ctx.lineWidth = Number.isFinite(stroke.width) ? stroke.width : 1;
  ctx.strokeStyle = toCssColor(stroke.color, 'rgba(0, 0, 0, 1)');
  ctx.setLineDash(sanitizeDash(stroke.dash));
  ctx.lineCap = mapLineCap(stroke.cap);
  ctx.lineJoin = mapLineJoin(stroke.join);
  ctx.stroke();
  return true;
}

function applyFill(fill) {
  if (!fill) {
    return false;
  }
  ctx.fillStyle = toCssColor(fill.color, 'rgba(0, 0, 0, 1)');
  ctx.fill();
  return true;
}

function renderLine(geometry, style) {
  const points = geometry?.Line?.points;
  if (!Array.isArray(points) || points.length < 2) {
    return;
  }
  const validPoints = points.filter(
    (point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]),
  );
  if (validPoints.length < 2) {
    return;
  }
  const stroke = resolveStroke(style);
  if (!stroke) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(validPoints[0][0], validPoints[0][1]);
  for (let i = 1; i < validPoints.length; i += 1) {
    ctx.lineTo(validPoints[i][0], validPoints[i][1]);
  }
  applyStroke(stroke);
}

function renderCircle(geometry, style) {
  const circle = geometry?.Circle;
  if (!circle) {
    return;
  }
  const { center, radius } = circle;
  if (!Array.isArray(center) || center.length < 2) {
    return;
  }
  const [x, y] = center;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(radius) ||
    radius < 0
  ) {
    return;
  }
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  applyFill(style?.fill);
  applyStroke(resolveStroke(style));
}

function renderRect(geometry, style) {
  const rect = geometry?.Rect;
  if (!rect) {
    return;
  }
  const { origin, width, height } = rect;
  if (!Array.isArray(origin) || origin.length < 2) {
    return;
  }
  const [x, y] = origin;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return;
  }
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  applyFill(style?.fill);
  applyStroke(resolveStroke(style));
}

function renderArc(geometry, style) {
  const arc = geometry?.Arc;
  if (!arc) {
    return;
  }
  const { center, radius, start_angle, end_angle } = arc;
  if (!Array.isArray(center) || center.length < 2) {
    return;
  }
  const [x, y] = center;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(radius) ||
    !Number.isFinite(start_angle) ||
    !Number.isFinite(end_angle) ||
    radius < 0
  ) {
    return;
  }
  ctx.beginPath();
  // Arc uses counterclockwise direction for positive angles
  ctx.arc(x, y, radius, start_angle, end_angle, false);
  applyFill(style?.fill);
  applyStroke(resolveStroke(style));
}

function applyTransform(transform) {
  if (!transform) {
    return;
  }

  // Canvas transforms are applied in reverse order
  // We want: scale -> rotate -> translate
  // So we call: translate, rotate, scale
  const { translate, rotate, scale } = transform;

  if (Array.isArray(translate) && translate.length >= 2) {
    const [dx, dy] = translate;
    if (Number.isFinite(dx) && Number.isFinite(dy)) {
      ctx.translate(dx, dy);
    }
  }

  if (Number.isFinite(rotate) && rotate !== 0) {
    ctx.rotate(rotate);
  }

  if (Array.isArray(scale) && scale.length >= 2) {
    const [sx, sy] = scale;
    if (Number.isFinite(sx) && Number.isFinite(sy)) {
      ctx.scale(sx, sy);
    }
  }
}

function renderEntity(entity) {
  if (!entity || !entity.entity_type) {
    return;
  }
  ctx.save();

  // Apply entity transform
  applyTransform(entity.transform);

  switch (entity.entity_type) {
    case 'Line':
      renderLine(entity.geometry, entity.style);
      break;
    case 'Circle':
      renderCircle(entity.geometry, entity.style);
      break;
    case 'Rect':
      renderRect(entity.geometry, entity.style);
      break;
    case 'Arc':
      renderArc(entity.geometry, entity.style);
      break;
    default:
      console.warn('Unknown entity type:', entity.entity_type);
  }

  ctx.restore();
}

function renderScene(scene) {
  ctx.clearRect(0, 0, state.viewport.width, state.viewport.height);
  if (!scene || !Array.isArray(scene.entities)) {
    return;
  }

  ctx.save();
  ctx.translate(state.viewport.width / 2, state.viewport.height / 2);
  ctx.scale(1, -1);

  for (const entity of scene.entities) {
    renderEntity(entity);
  }

  ctx.restore();
}

async function fetchScene() {
  try {
    const response = await fetch(SOURCE_FILE, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const scene = await response.json();
    const signature = JSON.stringify(scene);

    if (signature !== state.lastSignature) {
      state.lastSignature = signature;
      state.lastScene = scene;

      try {
        renderScene(scene);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.warn('Failed to render scene:', message);
        state.lastError = message;
        lastError.textContent = message;
        setStatus({ mode: 'error', message: `Render failed: ${message}` });
        return;
      }

      const count = Array.isArray(scene.entities) ? scene.entities.length : 0;
      setStatus({
        mode: 'live',
        message: `Loaded ${SOURCE_FILE}`,
        count,
      });
      lastUpdated.textContent = formatTime(new Date());
      lastError.textContent = 'None';
      setOverlay(false);
    }
  } catch (error) {
    console.warn('Failed to fetch scene.json:', error.message);
    state.lastError = error.message;
    lastError.textContent = error.message;
    setStatus({ mode: 'error', message: `Fetch failed: ${error.message}` });

    if (!state.lastScene) {
      setOverlay(true, 'Waiting for scene.json...');
    }
  }
}

window.addEventListener('resize', () => {
  resizeCanvas();
});

function startPolling() {
  if (pollTimer) {
    return;
  }
  pollTimer = setInterval(fetchScene, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (!pollTimer) {
    return;
  }
  clearInterval(pollTimer);
  pollTimer = null;
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    stopPolling();
    return;
  }
  fetchScene();
  startPolling();
}

document.addEventListener('visibilitychange', handleVisibilityChange);

resizeCanvas();
handleVisibilityChange();
