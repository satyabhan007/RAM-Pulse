const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');
const { performance } = require('perf_hooks');

const ITERATIONS = 100;
const SEEDS = 10;
const OUTPUT_FILE = '1-Check/results.csv';

// Method A: Node.js OS Module
function testOsModule() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  return { totalBytes, freeBytes };
}

// Method B: /proc/meminfo
function testProcMeminfo() {
  try {
    const txt = fs.readFileSync('/proc/meminfo', 'utf8');
    const get = (k) => {
      const m = txt.match(new RegExp('^' + k + ':\\s+(\\d+)', 'm'));
      return m ? parseInt(m[1], 10) : 0;
    };
    return {
      memTotalKB: get('MemTotal'),
      memAvailableKB: get('MemAvailable')
    };
  } catch (e) {
    return null;
  }
}

// Method C: Shell Process (ps)
function testShellProcess() {
  return new Promise((resolve) => {
    exec('ps -eo comm=,pid=,rss= --sort=-rss 2>/dev/null | head -n 6', (err, stdout) => {
      resolve(stdout);
    });
  });
}

async function runExperiments() {
  let csvContent = 'Method,Seed,Iteration,Latency_ms\n';

  console.log('Starting experiments...');

  for (let seed = 1; seed <= SEEDS; seed++) {
    console.log(`Running seed ${seed}/${SEEDS}...`);

    // A: OS Module
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      testOsModule();
      const end = performance.now();
      csvContent += `OS_Module,${seed},${i},${end - start}\n`;
    }

    // B: /proc/meminfo
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      testProcMeminfo();
      const end = performance.now();
      csvContent += `Proc_Meminfo,${seed},${i},${end - start}\n`;
    }

    // C: Shell Process
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      await testShellProcess();
      const end = performance.now();
      csvContent += `Shell_Process,${seed},${i},${end - start}\n`;
    }
  }

  fs.writeFileSync(OUTPUT_FILE, csvContent);
  console.log(`Results written to ${OUTPUT_FILE}`);
}

runExperiments();
