const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const WebSocket = require('ws');
const { collectMemory } = require('./scripts/collect_memory');

const PORT = 3888;
const TELEMETRY_INTERVAL_MS = process.env.TELEMETRY_INTERVAL_MS ? parseInt(process.env.TELEMETRY_INTERVAL_MS) : 2000;

function runScript(scriptRelativePath) {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(__dirname, scriptRelativePath);
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${fullPath}"`;
    exec(cmd, { windowsHide: true }, (err, stdout) => {
      if (err) return reject(err);
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (e) {
        reject(e);
      }
    });
  });
}

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  // Serve static files
  if (req.method === 'GET' && (req.url === '/' || req.url.endsWith('.html') || req.url.endsWith('.js') || req.url.endsWith('.css') || req.url.endsWith('.png') || req.url.endsWith('.svg'))) {
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
    return;
  }

  // REST endpoint for telemetry (GET /api/telemetry)
  if (req.method === 'GET' && req.url === '/api/telemetry') {
    try {
      const stats = await collectMemory();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(stats));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Handle optimization request (POST /api/optimize)
  if (req.method === 'POST' && req.url === '/api/optimize') {
    try {
      const result = await runScript('scripts/optimize_memory.ps1');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// Attach WebSocket server to the same HTTP server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  const sendTelemetry = async () => {
    try {
      const data = await collectMemory();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    } catch (err) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ error: err.message }));
      }
    }
  };

  sendTelemetry();
  const intervalId = setInterval(sendTelemetry, TELEMETRY_INTERVAL_MS);

  ws.on('close', () => {
    clearInterval(intervalId);
    console.log('WebSocket client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`RAM PULSE Desktop Server listening on http://localhost:${PORT}`);
});
