/**
 * Simple Node.js server for AI-Native CAD Viewer
 * Serves static files and accepts POST to save selection.json
 *
 * Usage: node server.js [port]
 * Default port: 8000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2] || '8000', 10);
const VIEWER_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function sendResponse(res, statusCode, contentType, body) {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function handleStaticFile(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  // Remove query strings
  filePath = filePath.split('?')[0];
  // Remove leading slash to prevent path.join ignoring VIEWER_DIR
  filePath = filePath.replace(/^\/+/, '');

  const fullPath = path.join(VIEWER_DIR, filePath);

  // Security: prevent directory traversal
  const normalizedPath = path.normalize(fullPath);
  if (!normalizedPath.startsWith(VIEWER_DIR)) {
    sendResponse(res, 403, 'text/plain', 'Forbidden');
    return;
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        sendResponse(res, 404, 'text/plain', 'Not Found');
      } else {
        sendResponse(res, 500, 'text/plain', 'Internal Server Error');
      }
      return;
    }
    sendResponse(res, 200, getMimeType(fullPath), data);
  });
}

const MAX_BODY_SIZE = 10 * 1024; // 10KB limit for selection data

function handleSelectionPost(req, res) {
  let body = '';
  let totalSize = 0;
  req.on('data', chunk => {
    totalSize += chunk.length;
    if (totalSize > MAX_BODY_SIZE) {
      req.destroy();
      sendResponse(res, 413, 'application/json', JSON.stringify({ error: 'Request body too large' }));
      return;
    }
    body += chunk.toString();
  });
  req.on('end', () => {
    try {
      // Validate JSON
      const selection = JSON.parse(body);

      // Write to selection.json
      const selectionPath = path.join(VIEWER_DIR, 'selection.json');
      fs.writeFileSync(selectionPath, JSON.stringify(selection, null, 2));

      console.log(`[Selection] Saved: ${JSON.stringify(selection.selected_ids)}`);
      sendResponse(res, 200, 'application/json', JSON.stringify({ success: true }));
    } catch (err) {
      console.error('[Selection] Error:', err.message);
      sendResponse(res, 400, 'application/json', JSON.stringify({ error: err.message }));
    }
  });
}

const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    sendResponse(res, 200, 'text/plain', '');
    return;
  }

  // POST /selection.json - save selection
  if (req.method === 'POST' && req.url === '/selection.json') {
    handleSelectionPost(req, res);
    return;
  }

  // GET - serve static files
  if (req.method === 'GET') {
    handleStaticFile(req, res);
    return;
  }

  sendResponse(res, 405, 'text/plain', 'Method Not Allowed');
});

server.listen(PORT, () => {
  console.log(`\n  AI-Native CAD Viewer Server`);
  console.log(`  ----------------------------`);
  console.log(`  Local:   http://localhost:${PORT}/`);
  console.log(`  Viewer:  http://localhost:${PORT}/index.html`);
  console.log(`\n  Features:`);
  console.log(`  - Static file serving`);
  console.log(`  - POST /selection.json (selection persistence)`);
  console.log(`\n  Press Ctrl+C to stop\n`);
});
