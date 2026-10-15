#!/usr/bin/env node
// frontier — command-line remote control for the running browser game.
//
//   frontier serve              start the local server (http://localhost:4747)
//   frontier open               open the game in your browser
//   frontier <command> [args]   send a command to the open game tab (see: frontier help)
//   add --json for machine-readable output (handy for Claude Code).
'use strict';
const path = require('path');
const { execFile } = require('child_process');

const PORT = +(process.env.FRONTIER_PORT || process.env.PORT || 4747);
const BASE = `http://localhost:${PORT}`;

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const [cmd = 'help', ...args] = argv.filter((a) => a !== '--json');

  if (cmd === 'serve') { require(path.join(__dirname, '..', 'tools', 'serve.js')); return; }
  if (cmd === 'open') { execFile('open', [BASE]); console.log(`Opening ${BASE}`); return; }

  let res;
  try {
    res = await fetch(`${BASE}/bridge/cmd`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cmd, args }) });
  } catch (e) {
    console.error(`Can't reach the game server at ${BASE}. Start it with:  ./frontier serve   (then open ${BASE})`);
    process.exit(2);
  }
  const out = await res.json().catch(() => ({ ok: false, text: `Bad response (${res.status}).` }));
  if (asJson) console.log(JSON.stringify(out.data !== undefined ? { ok: out.ok, data: out.data, text: out.text } : out, null, 2));
  else console.log(out.text || out.error || JSON.stringify(out));
  process.exit(out.ok === false || out.error ? 1 : 0);
}

main();
