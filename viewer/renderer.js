const POLL_INTERVAL_MS = 500;
const urlParams = new URLSearchParams(window.location.search);
const sourceOverride = urlParams.get('scene');
const SOURCE_FILE = sourceOverride || 'scene.json';
const SELECTION_FILE = 'selection.json';
const LINE_HIT_TOLERANCE = 5; // pixels tolerance for line hit testing
const DEBUG = false; // Set to true for debug logging

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const entityCount = document.getElementById('entity-count');
const lastUpdated = document.getElementById('last-updated');
const lastError = document.getElementById('last-error');
const lastOperation = document.getElementById('last-operation');
const overlay = document.getElementById('canvas-overlay');
const sceneBounds = document.getElementById('scene-bounds');
const entityList = document.getElementById('entity-list');
const operationLog = document.getElementById('operation-log');
const selectionInfo = document.getElementById('selection-info');
const selectionDetails = document.getElementById('selection-details');

// Operation history (limited to prevent memory growth)
const MAX_OPERATION_HISTORY = 100;
const operationHistory = [];

const state = {
  lastSignature: null,
  lastScene: null,
  lastError: null,
  viewport: { width: 0, height: 0 },
  pixelRatio: window.devicePixelRatio || 1,
  // Selection state
  selectedIds: [],
  lastSelected: null,
  selectionTimestamp: null,
  // Entity lookup map (for groups)
  entitiesByName: {},
};

let pollTimer = null;

/**
 * HTML 특수문자 이스케이프 (XSS 방지)
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

function computeBounds(entities) {
  if (!Array.isArray(entities) || entities.length === 0) {
    return null;
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const entity of entities) {
    const geo = entity.geometry;
    if (!geo) continue;

    if (geo.Circle) {
      const { center, radius } = geo.Circle;
      minX = Math.min(minX, center[0] - radius);
      minY = Math.min(minY, center[1] - radius);
      maxX = Math.max(maxX, center[0] + radius);
      maxY = Math.max(maxY, center[1] + radius);
    } else if (geo.Rect) {
      const { origin, width, height } = geo.Rect;
      minX = Math.min(minX, origin[0]);
      minY = Math.min(minY, origin[1]);
      maxX = Math.max(maxX, origin[0] + width);
      maxY = Math.max(maxY, origin[1] + height);
    } else if (geo.Line) {
      for (const pt of geo.Line.points) {
        minX = Math.min(minX, pt[0]);
        minY = Math.min(minY, pt[1]);
        maxX = Math.max(maxX, pt[0]);
        maxY = Math.max(maxY, pt[1]);
      }
    } else if (geo.Arc) {
      const { center, radius } = geo.Arc;
      minX = Math.min(minX, center[0] - radius);
      minY = Math.min(minY, center[1] - radius);
      maxX = Math.max(maxX, center[0] + radius);
      maxY = Math.max(maxY, center[1] + radius);
    } else if (geo.Polygon) {
      for (const pt of geo.Polygon.points) {
        minX = Math.min(minX, pt[0]);
        minY = Math.min(minY, pt[1]);
        maxX = Math.max(maxX, pt[0]);
        maxY = Math.max(maxY, pt[1]);
      }
    } else if (geo.Bezier) {
      const { start, segments } = geo.Bezier;
      minX = Math.min(minX, start[0]);
      minY = Math.min(minY, start[1]);
      maxX = Math.max(maxX, start[0]);
      maxY = Math.max(maxY, start[1]);
      for (const seg of segments) {
        for (const pt of seg) {
          minX = Math.min(minX, pt[0]);
          minY = Math.min(minY, pt[1]);
          maxX = Math.max(maxX, pt[0]);
          maxY = Math.max(maxY, pt[1]);
        }
      }
    }
  }

  if (!Number.isFinite(minX)) return null;

  return { min: [minX, minY], max: [maxX, maxY] };
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

function renderPolygon(geometry, style) {
  const points = geometry?.Polygon?.points;
  if (!Array.isArray(points) || points.length < 3) {
    return;
  }
  const validPoints = points.filter(
    (point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]),
  );
  if (validPoints.length < 3) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(validPoints[0][0], validPoints[0][1]);
  for (let i = 1; i < validPoints.length; i += 1) {
    ctx.lineTo(validPoints[i][0], validPoints[i][1]);
  }
  ctx.closePath();
  applyFill(style?.fill);
  const stroke = resolveStroke(style);
  if (stroke) {
    applyStroke(stroke);
  }
}

function renderBezier(geometry, style) {
  const bezier = geometry?.Bezier;
  if (!bezier) {
    return;
  }
  const { start, segments, closed } = bezier;
  if (!Array.isArray(start) || start.length < 2 || !Array.isArray(segments) || segments.length === 0) {
    return;
  }
  const [sx, sy] = start;
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(sx, sy);

  for (const seg of segments) {
    if (!Array.isArray(seg) || seg.length < 3) continue;
    const [cp1, cp2, end] = seg;
    if (!Array.isArray(cp1) || !Array.isArray(cp2) || !Array.isArray(end)) continue;
    if (cp1.length < 2 || cp2.length < 2 || end.length < 2) continue;
    if (!Number.isFinite(cp1[0]) || !Number.isFinite(cp1[1]) ||
        !Number.isFinite(cp2[0]) || !Number.isFinite(cp2[1]) ||
        !Number.isFinite(end[0]) || !Number.isFinite(end[1])) continue;
    ctx.bezierCurveTo(cp1[0], cp1[1], cp2[0], cp2[1], end[0], end[1]);
  }

  if (closed) {
    ctx.closePath();
  }

  applyFill(style?.fill);
  const stroke = resolveStroke(style);
  if (stroke) {
    applyStroke(stroke);
  }
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

  // Transform with pivot support
  // Order: translate -> (translate to pivot -> rotate -> scale -> translate back from pivot)
  const { translate, rotate, scale, pivot } = transform;

  // 1. Apply translation
  if (Array.isArray(translate) && translate.length >= 2) {
    const [dx, dy] = translate;
    if (Number.isFinite(dx) && Number.isFinite(dy)) {
      ctx.translate(dx, dy);
    }
  }

  // 2. Get pivot point (default [0, 0])
  const px = Array.isArray(pivot) && Number.isFinite(pivot[0]) ? pivot[0] : 0;
  const py = Array.isArray(pivot) && Number.isFinite(pivot[1]) ? pivot[1] : 0;
  const hasPivot = px !== 0 || py !== 0;

  // 3. Translate to pivot for rotation/scale
  if (hasPivot) {
    ctx.translate(px, py);
  }

  // 4. Apply rotation
  if (Number.isFinite(rotate) && rotate !== 0) {
    ctx.rotate(rotate);
  }

  // 5. Apply scale
  if (Array.isArray(scale) && scale.length >= 2) {
    const [sx, sy] = scale;
    if (Number.isFinite(sx) && Number.isFinite(sy)) {
      ctx.scale(sx, sy);
    }
  }

  // 6. Translate back from pivot
  if (hasPivot) {
    ctx.translate(-px, -py);
  }
}

/**
 * Entity를 렌더링합니다.
 * @param {Object} entity - 렌더링할 Entity
 * @param {Object} entitiesByName - name으로 Entity를 조회하기 위한 맵
 */
function renderEntity(entity, entitiesByName) {
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
    case 'Polygon':
      renderPolygon(entity.geometry, entity.style);
      break;
    case 'Bezier':
      renderBezier(entity.geometry, entity.style);
      break;
    case 'Group':
      // Group의 변환이 적용된 상태에서 자식들을 z-order 순으로 렌더링 (계층적 변환)
      if (Array.isArray(entity.children) && entitiesByName) {
        // children을 z-order로 정렬 (낮은 값이 먼저 = 뒤에 렌더링)
        const sortedChildren = entity.children
          .map(childName => entitiesByName[childName])
          .filter(child => child != null)
          .sort((a, b) => (a.metadata?.z_index || 0) - (b.metadata?.z_index || 0));

        for (const child of sortedChildren) {
          renderEntity(child, entitiesByName);
        }
      }
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

  // Build name -> entity map for hierarchical rendering
  const entitiesByName = {};
  for (const entity of scene.entities) {
    const name = entity.metadata?.name;
    if (name) {
      entitiesByName[name] = entity;
    }
  }
  // Store in state for selection highlight access
  state.entitiesByName = entitiesByName;

  ctx.save();
  ctx.translate(state.viewport.width / 2, state.viewport.height / 2);
  ctx.scale(1, -1);

  // Only render root-level entities (those without parent_id)
  // Children are rendered by their parent Group
  // Sort by z_index (lower z_index renders first = behind)
  const rootEntities = scene.entities
    .filter(e => !e.parent_id)
    .sort((a, b) => (a.metadata?.z_index || 0) - (b.metadata?.z_index || 0));

  for (const entity of rootEntities) {
    renderEntity(entity, entitiesByName);
  }

  // Render selection highlight for selected entities
  if (state.selectedIds.length > 0) {
    for (const selectedId of state.selectedIds) {
      const selectedEntity = entitiesByName[selectedId];
      if (selectedEntity) {
        renderSelectionHighlight(selectedEntity);
      }
    }
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
      // LLM 작업 상태 표시
      if (scene.last_operation) {
        lastOperation.textContent = `🤖 ${scene.last_operation}`;

        // Add to history if new (with size limit to prevent memory growth)
        const lastInHistory = operationHistory[operationHistory.length - 1];
        if (lastInHistory !== scene.last_operation) {
          const timestamp = formatTime(new Date());
          operationHistory.push(scene.last_operation);

          // Limit history size
          if (operationHistory.length > MAX_OPERATION_HISTORY) {
            operationHistory.shift();
            // Remove oldest entry from DOM
            if (operationLog && operationLog.firstChild) {
              operationLog.removeChild(operationLog.firstChild);
            }
          }

          // Update log display (escaped to prevent XSS)
          if (operationLog) {
            const logEntry = document.createElement('div');
            logEntry.style.marginBottom = '4px';
            logEntry.innerHTML = `<span style="color: var(--bg-muted);">${escapeHtml(timestamp)}</span> ${escapeHtml(scene.last_operation)}`;
            operationLog.appendChild(logEntry);
            operationLog.scrollTop = operationLog.scrollHeight;
          }
        }
      } else {
        lastOperation.textContent = '-';
      }

      // Bounds 표시
      if (sceneBounds) {
        const bounds = computeBounds(scene.entities);
        if (bounds) {
          sceneBounds.textContent = `[${bounds.min[0].toFixed(0)}, ${bounds.min[1].toFixed(0)}] → [${bounds.max[0].toFixed(0)}, ${bounds.max[1].toFixed(0)}]`;
        } else {
          sceneBounds.textContent = '-';
        }
      }

      // Entity 목록 표시 (escaped to prevent XSS)
      if (entityList && Array.isArray(scene.entities)) {
        const names = scene.entities
          .map(e => {
            const name = escapeHtml(e.metadata?.name || e.id?.slice(0, 8) || '?');
            const type = escapeHtml(e.entity_type || '?');
            return `<div><strong>${name}</strong> (${type})</div>`;
          })
          .join('');
        entityList.innerHTML = names || '-';
      }

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

// ============================================
// Selection / Hit Testing (Story 5-1)
// ============================================

/**
 * Get entity bounding box (in local coordinates, before transform)
 */
function getEntityBounds(entity, entitiesByName) {
  const geo = entity.geometry;

  // Handle Group entities - compute combined bounds of children
  if (entity.entity_type === 'Group' && Array.isArray(entity.children)) {
    const lookup = entitiesByName || state.entitiesByName;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasValidBounds = false;

    for (const childName of entity.children) {
      const child = lookup[childName];
      if (!child) continue;

      const childBounds = getEntityBounds(child, lookup);
      if (!childBounds) continue;

      // Apply child's transform to its bounds corners
      const childTransform = child.transform;
      const corners = [
        [childBounds.minX, childBounds.minY],
        [childBounds.maxX, childBounds.minY],
        [childBounds.minX, childBounds.maxY],
        [childBounds.maxX, childBounds.maxY],
      ];

      for (const [cx, cy] of corners) {
        const transformed = applyTransformToPoint(cx, cy, childTransform);
        minX = Math.min(minX, transformed.x);
        minY = Math.min(minY, transformed.y);
        maxX = Math.max(maxX, transformed.x);
        maxY = Math.max(maxY, transformed.y);
        hasValidBounds = true;
      }
    }

    if (!hasValidBounds) return null;
    return { minX, minY, maxX, maxY };
  }

  if (!geo) return null;

  if (geo.Circle) {
    const { center, radius } = geo.Circle;
    return {
      minX: center[0] - radius,
      minY: center[1] - radius,
      maxX: center[0] + radius,
      maxY: center[1] + radius,
    };
  }
  if (geo.Rect) {
    const { origin, width, height } = geo.Rect;
    return {
      minX: origin[0],
      minY: origin[1],
      maxX: origin[0] + width,
      maxY: origin[1] + height,
    };
  }
  if (geo.Line) {
    const points = geo.Line.points;
    if (!points || points.length < 2) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of points) {
      minX = Math.min(minX, pt[0]);
      minY = Math.min(minY, pt[1]);
      maxX = Math.max(maxX, pt[0]);
      maxY = Math.max(maxY, pt[1]);
    }
    // Add tolerance for thin lines
    const tolerance = LINE_HIT_TOLERANCE;
    return { minX: minX - tolerance, minY: minY - tolerance, maxX: maxX + tolerance, maxY: maxY + tolerance };
  }
  if (geo.Arc) {
    const { center, radius } = geo.Arc;
    return {
      minX: center[0] - radius,
      minY: center[1] - radius,
      maxX: center[0] + radius,
      maxY: center[1] + radius,
    };
  }
  if (geo.Polygon) {
    const points = geo.Polygon.points;
    if (!points || points.length < 3) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of points) {
      minX = Math.min(minX, pt[0]);
      minY = Math.min(minY, pt[1]);
      maxX = Math.max(maxX, pt[0]);
      maxY = Math.max(maxY, pt[1]);
    }
    return { minX, minY, maxX, maxY };
  }
  if (geo.Bezier) {
    const { start, segments } = geo.Bezier;
    if (!start || !segments || segments.length === 0) return null;
    let minX = start[0], minY = start[1], maxX = start[0], maxY = start[1];
    // Include all control points and end points for accurate bounds
    for (const seg of segments) {
      // seg = [cp1, cp2, end] where each is [x, y]
      for (const pt of seg) {
        minX = Math.min(minX, pt[0]);
        minY = Math.min(minY, pt[1]);
        maxX = Math.max(maxX, pt[0]);
        maxY = Math.max(maxY, pt[1]);
      }
    }
    return { minX, minY, maxX, maxY };
  }
  return null;
}

/**
 * Apply transform to a point (forward transform, not inverse)
 * Canvas2D order: translate -> pivot -> rotate -> scale -> unpivot
 * Actual application: unpivot -> scale -> rotate -> pivot -> translate
 */
function applyTransformToPoint(x, y, transform) {
  if (!transform) return { x, y };

  const { translate, rotate, scale, pivot } = transform;
  const tx = translate?.[0] || 0;
  const ty = translate?.[1] || 0;
  const r = rotate || 0;
  const sx = scale?.[0] || 1;
  const sy = scale?.[1] || 1;
  const px = pivot?.[0] || 0;
  const py = pivot?.[1] || 0;

  // Apply transform matching Canvas2D reverse order:
  // Canvas: translate -> pivot -> rotate -> scale -> unpivot
  // Actual: unpivot -> scale -> rotate -> pivot -> translate

  // 1. Translate to pivot (unpivot in canvas terms)
  let ox = x - px;
  let oy = y - py;

  // 2. Scale (applied before rotate in actual order)
  ox *= sx;
  oy *= sy;

  // 3. Rotate
  if (r !== 0) {
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const rx = ox * cos - oy * sin;
    const ry = ox * sin + oy * cos;
    ox = rx;
    oy = ry;
  }

  // 4. Translate back from pivot and apply translation
  ox += px + tx;
  oy += py + ty;

  return { x: ox, y: oy };
}

/**
 * Apply transform to a point (for hit testing)
 */
function transformPoint(x, y, transform) {
  if (!transform) return { x, y };

  const { translate, rotate, scale, pivot } = transform;
  const tx = translate?.[0] || 0;
  const ty = translate?.[1] || 0;
  const r = rotate || 0;
  const sx = scale?.[0] || 1;
  const sy = scale?.[1] || 1;
  const px = pivot?.[0] || 0;
  const py = pivot?.[1] || 0;

  // Inverse transform: first undo translate, then undo pivot-based rotate/scale
  let ix = x - tx;
  let iy = y - ty;

  // Undo pivot translation
  ix -= px;
  iy -= py;

  // Undo scale
  if (sx !== 0) ix /= sx;
  if (sy !== 0) iy /= sy;

  // Undo rotation
  if (r !== 0) {
    const cos = Math.cos(-r);
    const sin = Math.sin(-r);
    const rx = ix * cos - iy * sin;
    const ry = ix * sin + iy * cos;
    ix = rx;
    iy = ry;
  }

  // Undo pivot translation back
  ix += px;
  iy += py;

  return { x: ix, y: iy };
}

/**
 * Point-in-polygon test using ray casting algorithm
 * @param {number} x - Test point x
 * @param {number} y - Test point y
 * @param {Array<[number, number]>} points - Polygon vertices
 * @returns {boolean} True if point is inside polygon
 */
function pointInPolygon(x, y, points) {
  if (!points || points.length < 3) return false;

  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0], yi = points[i][1];
    const xj = points[j][0], yj = points[j][1];

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Hit test for a single entity
 */
function hitTestEntity(entity, worldX, worldY, entitiesByName, _parentTransform) {
  if (!entity) return null;

  // Combine parent transform with entity transform (simplified - just applies in sequence)
  const transform = entity.transform;

  // Transform the test point into local coordinates
  const local = transformPoint(worldX, worldY, transform);

  // For groups, test children sorted by z_index (highest first for top-most)
  if (entity.entity_type === 'Group' && Array.isArray(entity.children)) {
    const childEntities = entity.children
      .map(name => entitiesByName?.[name])
      .filter(Boolean)
      .sort((a, b) => (b.metadata?.z_index || 0) - (a.metadata?.z_index || 0));

    for (const child of childEntities) {
      const hit = hitTestEntity(child, local.x, local.y, entitiesByName, transform);
      if (hit) {
        // Return the group if any child is hit (group selection mode)
        return entity;
      }
    }
    return null;
  }

  // Get bounds first for quick rejection
  const bounds = getEntityBounds(entity);
  if (!bounds) return null;

  if (local.x < bounds.minX || local.x > bounds.maxX ||
      local.y < bounds.minY || local.y > bounds.maxY) {
    return null;
  }

  // For Polygon, use precise point-in-polygon test
  const geo = entity.geometry;
  if (geo?.Polygon?.points) {
    if (pointInPolygon(local.x, local.y, geo.Polygon.points)) {
      return entity;
    }
    return null;
  }

  // For other shapes, bounding box is sufficient
  return entity;
}

/**
 * Hit test all entities at a world position
 */
function hitTestScene(scene, worldX, worldY) {
  if (!scene || !Array.isArray(scene.entities)) return null;

  // Build name -> entity map
  const entitiesByName = {};
  for (const entity of scene.entities) {
    const name = entity.metadata?.name;
    if (name) {
      entitiesByName[name] = entity;
    }
  }

  // Sort root entities by z_index descending (highest z-order = visually on top = test first)
  const rootEntities = scene.entities
    .filter(e => !e.parent_id)
    .sort((a, b) => (b.metadata?.z_index || 0) - (a.metadata?.z_index || 0));
  for (const entity of rootEntities) {
    const hit = hitTestEntity(entity, worldX, worldY, entitiesByName, null);
    if (hit) return hit;
  }

  return null;
}

/**
 * Convert canvas click coordinates to world coordinates
 */
function canvasToWorld(canvasX, canvasY) {
  const centerX = state.viewport.width / 2;
  const centerY = state.viewport.height / 2;

  // Undo the viewport transform (translate to center, flip Y)
  const worldX = canvasX - centerX;
  const worldY = -(canvasY - centerY); // Flip Y back

  return { x: worldX, y: worldY };
}

/**
 * Render selection highlight (bounding box)
 */
function renderSelectionHighlight(entity) {
  if (!entity) return;

  const bounds = getEntityBounds(entity);
  if (!bounds) return;

  ctx.save();

  // Apply entity transform
  applyTransform(entity.transform);

  // Draw selection bounding box
  ctx.strokeStyle = '#2a7f7a';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(
    bounds.minX - 3,
    bounds.minY - 3,
    (bounds.maxX - bounds.minX) + 6,
    (bounds.maxY - bounds.minY) + 6
  );

  // Draw corner handles
  ctx.fillStyle = '#2a7f7a';
  const handleSize = 6;
  const corners = [
    [bounds.minX - 3, bounds.minY - 3],
    [bounds.maxX + 3, bounds.minY - 3],
    [bounds.minX - 3, bounds.maxY + 3],
    [bounds.maxX + 3, bounds.maxY + 3],
  ];
  for (const [cx, cy] of corners) {
    ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
  }

  ctx.restore();
}

/**
 * Update selection UI display
 */
function updateSelectionUI(entity) {
  if (!entity) {
    selectionInfo.textContent = 'None (click on canvas)';
    selectionInfo.style.color = 'var(--bg-muted)';
    selectionDetails.textContent = '-';
    return;
  }

  const name = entity.metadata?.name || entity.id?.slice(0, 8) || '?';
  const type = entity.entity_type || '?';

  selectionInfo.textContent = `${name} (${type})`;
  selectionInfo.style.color = 'var(--accent)';

  // Format details as JSON-like info
  const details = {
    name,
    type,
    geometry: entity.geometry,
    transform: entity.transform,
  };
  selectionDetails.textContent = JSON.stringify(details, null, 2);
}

/**
 * Save selection to localStorage and POST to server for selection.json
 */
async function saveSelection() {
  const selection = {
    selected_ids: state.selectedIds,
    last_selected: state.lastSelected,
    timestamp: state.selectionTimestamp,
  };

  // Save to localStorage for persistence
  try {
    localStorage.setItem('cad-selection', JSON.stringify(selection));
  } catch (e) {
    if (DEBUG) console.warn('Failed to save selection to localStorage:', e);
  }

  // POST to server to save selection.json (for AI to read)
  try {
    const response = await fetch(SELECTION_FILE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selection),
    });
    if (!response.ok && response.status !== 501 && DEBUG) {
      console.warn('[Selection] Failed to save:', response.status);
    }
  } catch (e) {
    // Server doesn't support POST (python -m http.server)
    // Selection still works via localStorage + UI display
    // Use: node server.js for full selection.json support
  }

  // Log to console for debugging (only in debug mode)
  if (DEBUG) console.log('[Selection]', selection);
}

/**
 * Handle canvas click for selection
 */
function handleCanvasClick(event) {
  const rect = canvas.getBoundingClientRect();
  const canvasX = event.clientX - rect.left;
  const canvasY = event.clientY - rect.top;

  const world = canvasToWorld(canvasX, canvasY);
  const hitEntity = hitTestScene(state.lastScene, world.x, world.y);

  if (hitEntity) {
    const name = hitEntity.metadata?.name || hitEntity.id;
    state.selectedIds = [name];
    state.lastSelected = name;
    state.selectionTimestamp = new Date().toISOString();
  } else {
    // Click on empty space - clear selection
    state.selectedIds = [];
    state.lastSelected = null;
    state.selectionTimestamp = new Date().toISOString();
  }

  // Update UI immediately (< 100ms requirement - NFR15)
  updateSelectionUI(hitEntity);
  saveSelection();

  // Re-render scene with selection highlight
  if (state.lastScene) {
    renderScene(state.lastScene);
  }
}

// Add click event listener
canvas.addEventListener('click', handleCanvasClick);

resizeCanvas();
handleVisibilityChange();
