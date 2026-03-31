/**
 * keep-alive.js
 * Standalone watchdog — use this ONLY if you are NOT using PM2.
 * It spawns server.js and automatically restarts it if it crashes.
 *
 * Usage:  node keep-alive.js
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs   = require('fs');

const SERVER  = path.join(__dirname, 'server.js');
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const logFile = fs.createWriteStream(path.join(LOG_DIR, 'watchdog.log'), { flags: 'a' });

function ts() { return new Date().toISOString(); }
function log(msg) {
  const line = `[${ts()}] ${msg}`;
  console.log(line);
  logFile.write(line + '\n');
}

let restarts = 0;
let lastStart = 0;

function startServer() {
  const now = Date.now();
  // If it crashed within 2 seconds, back off to avoid tight loop
  const delay = (now - lastStart < 2000) ? 3000 : 0;
  lastStart = now;

  setTimeout(() => {
    restarts++;
    log(`▶  Starting server.js (attempt #${restarts})`);

    const child = spawn(process.execPath, [SERVER], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: process.env.PORT || '3000' },
    });

    child.stdout.on('data', d => process.stdout.write(d));
    child.stderr.on('data', d => {
      process.stderr.write(d);
      logFile.write(`[${ts()}] [STDERR] ${d}`);
    });

    child.on('exit', (code, signal) => {
      log(`⚠  server.js exited (code=${code}, signal=${signal}) — restarting in ${delay || 0}ms…`);
      startServer();
    });

    child.on('error', (err) => {
      log(`✖  Failed to spawn server.js: ${err.message}`);
      startServer();
    });

    log(`✅ server.js running (PID ${child.pid})`);
  }, delay);
}

log('🚀 Watchdog started');
startServer();

// Keep the watchdog itself alive
process.on('uncaughtException', err => log(`Watchdog uncaughtException: ${err.message}`));
process.on('SIGINT', () => { log('Watchdog stopping (SIGINT)'); process.exit(0); });
process.on('SIGTERM', () => { log('Watchdog stopping (SIGTERM)'); process.exit(0); });
