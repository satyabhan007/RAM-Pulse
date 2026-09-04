// scripts/collect_memory.js
const path = require('path');
const { exec } = require('child_process');

function collectMemory() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'get_memory.ps1');
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`;
    exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(err);
      try {
        const data = JSON.parse(stdout.trim());
        resolve(data);
      } catch (parseError) {
        reject(new Error(`Failed to parse telemetry: ${stdout}`));
      }
    });
  });
}

module.exports = { collectMemory };
