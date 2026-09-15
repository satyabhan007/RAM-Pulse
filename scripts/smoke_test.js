// scripts/smoke_test.js — verifies telemetry + web endpoints on any OS.
// Usage: node scripts/smoke_test.js [baseUrl]
const { collectMemory } = require('./collect_memory');

const base = process.argv[2] || 'http://localhost:3888';

async function main() {
  const failures = [];
  const check = (name, cond, detail = '') => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
    if (!cond) failures.push(name);
  };

  // 1. Direct telemetry (process list is async — retry after pre-fetch lands)
  let mem = await collectMemory();
  if (!mem.topProcesses || mem.topProcesses.length === 0) {
    await new Promise((r) => setTimeout(r, 2500));
    mem = await collectMemory();
  }
  check('collectMemory returns numbers',
    typeof mem.totalRamGB === 'number' && mem.totalRamGB > 0 &&
    typeof mem.percentUsed === 'number' && mem.percentUsed >= 0 && mem.percentUsed <= 100,
    `total=${mem.totalRamGB}GB used=${mem.percentUsed}% status=${mem.status} platform=${mem.platform || process.platform}`);
  check('cached/commit fields present',
    typeof mem.cachedGB === 'number' && typeof mem.commitTotalGB === 'number' && typeof mem.commitUsedGB === 'number',
    `cached=${mem.cachedGB} commit=${mem.commitUsedGB}/${mem.commitTotalGB}`);
  check('topProcesses populated', Array.isArray(mem.topProcesses) && mem.topProcesses.length > 0,
    `${mem.topProcesses.length} procs: ${(mem.topProcesses.slice(0, 3).map((p) => p.name + ':' + p.workingSetMB + 'MB').join(', ')) || 'none'}`);

  // 2. HTTP endpoints (server must be running)
  try {
    const t = await (await fetch(`${base}/api/telemetry`)).json();
    check('GET /api/telemetry', typeof t.percentUsed === 'number', `used=${t.percentUsed}% procs=${(t.topProcesses || []).length}`);
  } catch (e) {
    check('GET /api/telemetry', false, 'server not reachable at ' + base + ' (' + e.message + ')');
  }
  try {
    const html = await (await fetch(`${base}/`)).text();
    check('GET / serves widget', html.includes('RAM PULSE') && html.includes('telemetryChart'), html.length + ' bytes');
  } catch (e) {
    check('GET / serves widget', false, e.message);
  }
  try {
    const r = await (await fetch(`${base}/api/optimize`, { method: 'POST' })).json();
    check('POST /api/optimize', typeof r.freedMB === 'number' && !r.error,
      `freed=${r.freedMB}MB trimmed=${r.processesTrimmed}${r.note ? ' (' + r.note.slice(0, 60) + '…)' : ''}`);
  } catch (e) {
    check('POST /api/optimize', false, e.message);
  }

  console.log(failures.length === 0 ? '\nALL SMOKE TESTS PASSED' : `\n${failures.length} FAILURES: ${failures.join(', ')}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error('SMOKE ERROR', e); process.exit(1); });
