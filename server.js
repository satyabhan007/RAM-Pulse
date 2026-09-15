const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const WebSocket = require('ws');
const { collectMemory } = require('./scripts/collect_memory');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3888;
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

// Linux "Boost": drop pagecache/dentries/inodes (needs sudo or vm.drop_caches
// writable) + advise kernel via sync. Never kills processes — safe to run.
// Falls back to GC + sync when no privileges.
function optimizeLinux() {
  return new Promise((resolve) => {
    const before = getFreeMB();
    const stamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const tryDrop = (level, cb) => {
      // Prefer pkexec/sudo-less write; try direct write first (may work if
      // sysctl vm.drop_caches is writable or running as root), else sudo -n.
      exec(`sync; (echo ${level} > /proc/sys/vm/drop_caches 2>/dev/null || sudo -n sh -c 'echo ${level} > /proc/sys/vm/drop_caches' 2>/dev/null); echo done`, (err) => cb(!err));
    };
    tryDrop(3, () => {
      setTimeout(() => {
        const after = getFreeMB();
        let freedMB = Math.round((after - before) * 10) / 10;
        if (!(freedMB > 0)) freedMB = 0;
        if (global.gc) { try { global.gc(); } catch (e) {} }
        resolve({
          freedMB,
          freedGB: Math.round((freedMB / 1024) * 100) / 100,
          processesTrimmed: 0,
          note: 'Linux: dropped pagecache/dentries/inodes (or sync only if unprivileged). No processes killed.',
          timestamp: stamp,
        });
      }, 800);
    });
  });
}

function getFreeMB() {
  try {
    const txt = fs.readFileSync('/proc/meminfo', 'utf8');
    const m = txt.match(/^MemAvailable:\s+(\d+)/m);
    if (m) return parseInt(m[1], 10) / 1024;
  } catch (e) {}
  return 0;
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
      let result;
      if (process.platform === 'win32') {
        result = await runScript('scripts/optimize_memory.ps1');
      } else {
        result = await optimizeLinux();
      }
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
