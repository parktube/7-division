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

function renderScene(scene) {
  ctx.clearRect(0, 0, state.viewport.width, state.viewport.height);
  // Shape rendering is added in Story 2.3.
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

      renderScene(scene);
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

resizeCanvas();
fetchScene();
setInterval(fetchScene, POLL_INTERVAL_MS);
