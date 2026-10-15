#!/usr/bin/env node
// serve.js — static server + CLI bridge for the browser game. No dependencies.
//
//   node tools/serve.js            # serves http://localhost:4747
//
// The game tab subscribes to GET /bridge/events (Server-Sent Events). The `frontier` CLI
// POSTs commands to /bridge/cmd; the server relays them to the tab and waits for the tab
// to POST the result to /bridge/result.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = +(process.env.PORT || 4747);
const TIMEOUT_MS = 20000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const tabs = new Set();
const pending = new Map();
let nextId = 1;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function serveStatic(req, res) {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.normalize(path.join(ROOT, url === '/' ? 'index.html' : url));
  if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT, 'index.html')) return json(res, 403, { error: 'forbidden' });
  fs.readFile(file, (err, buf) => {
    if (err) return json(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/bridge/events' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('event: hello\ndata: {}\n\n');
      tabs.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 15000);
      req.on('close', () => { clearInterval(ping); tabs.delete(res); });
      return;
    }
    if (req.url === '/bridge/health') return json(res, 200, { ok: true, tabs: tabs.size });
    if (req.url === '/bridge/cmd' && req.method === 'POST') {
      const body = await readBody(req);
      const tab = [...tabs].pop();
      if (!tab) return json(res, 503, { ok: false, error: `No game tab is connected. Open http://localhost:${PORT} in your browser.` });
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        json(res, 504, { ok: false, error: 'The game tab did not answer in time. Is a modal waiting on you in the browser?' });
      }, TIMEOUT_MS);
      pending.set(id, (result) => { clearTimeout(timer); json(res, 200, result); });
      tab.write(`event: cmd\ndata: ${JSON.stringify({ id, cmd: body.cmd, args: body.args || [] })}\n\n`);
      return;
    }
    if (req.url === '/bridge/result' && req.method === 'POST') {
      const body = await readBody(req);
      const cb = pending.get(body.id);
      if (cb) { pending.delete(body.id); cb(body.result); }
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET') return serveStatic(req, res);
    json(res, 405, { error: 'method not allowed' });
  } catch (e) {
    json(res, 500, { ok: false, error: String(e && e.message || e) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Frontier is running at http://localhost:${PORT}`);
  console.log('Drive it from a terminal with:  ./frontier help');
});
