/* net.js — peer-to-peer transports for multiplayer. Both expose the same interface:
 *   { code, myId, isHost, send(msg, to?), onMessage(fn(msg, from)), onPeer(fn(peerId, 'join'|'leave')), close() }
 * Host: send(msg) broadcasts to every guest; send(msg, id) targets one. Guest: send(msg) goes to the host.
 *
 * 'internet': WebRTC data channels via PeerJS. The free public PeerJS broker is used only to introduce
 *             peers; game traffic goes browser-to-browser. Loaded lazily from a pinned CDN build.
 * 'local':    BroadcastChannel between tabs of the same browser (couch play and testing). */
(function (FL) {
  'use strict';
  const N = {};
  const PEERJS_URL = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
  const ID_PREFIX = 'frontierlab-';
  const randomCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

  function emitter() {
    const msgFns = [], peerFns = [];
    return {
      onMessage: (fn) => msgFns.push(fn),
      onPeer: (fn) => peerFns.push(fn),
      _msg: (m, from) => msgFns.forEach((f) => { try { f(m, from); } catch (e) { console.error(e); } }),
      _peer: (id, ev) => peerFns.forEach((f) => { try { f(id, ev); } catch (e) { console.error(e); } }),
    };
  }

  // ── BroadcastChannel (same browser) ──────────────────────
  function local(code, isHost) {
    const ch = new BroadcastChannel(ID_PREFIX + code);
    const myId = isHost ? 'host' : 'p' + Math.random().toString(36).slice(2, 8);
    const em = emitter();
    const peers = new Set();
    ch.onmessage = (ev) => {
      const { from, to, msg } = ev.data || {};
      if (!msg || from === myId || (to && to !== myId)) return;
      if (!isHost && from !== 'host') return;
      if (isHost && !peers.has(from)) { peers.add(from); em._peer(from, 'join'); }
      if (msg.type === '_bye') { peers.delete(from); em._peer(from, 'leave'); return; }
      em._msg(msg, from);
    };
    const post = (msg, to) => ch.postMessage({ from: myId, to: to || null, msg });
    window.addEventListener('beforeunload', () => post({ type: '_bye' }));
    return Object.assign(em, {
      kind: 'local', code, myId, isHost,
      send: (msg, to) => post(msg, isHost ? to : 'host'),
      close: () => { post({ type: '_bye' }); ch.close(); },
    });
  }

  // ── PeerJS / WebRTC (internet) ───────────────────────────
  let peerjsLoading = null;
  function loadPeerJS() {
    if (window.Peer) return Promise.resolve();
    if (!peerjsLoading) {
      peerjsLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = PEERJS_URL;
        s.onload = resolve;
        s.onerror = () => reject(new Error('Could not load the networking library. Check your connection.'));
        document.head.appendChild(s);
      });
    }
    return peerjsLoading;
  }

  async function internet(code, isHost) {
    await loadPeerJS();
    const em = emitter();
    const conns = new Map();
    const peer = await new Promise((resolve, reject) => {
      const p = isHost ? new window.Peer(ID_PREFIX + code) : new window.Peer();
      p.on('open', () => resolve(p));
      p.on('error', (e) => reject(new Error(e.type === 'unavailable-id' ? 'That room code is taken. Try again.' : e.type === 'peer-unavailable' ? 'No lobby with that code is open.' : String(e.message || e))));
    });
    const wire = (c) => {
      c.on('data', (msg) => em._msg(msg, c.peer));
      c.on('close', () => { conns.delete(c.peer); em._peer(c.peer, 'leave'); });
    };
    if (isHost) {
      peer.on('connection', (c) => c.on('open', () => { conns.set(c.peer, c); wire(c); em._peer(c.peer, 'join'); }));
    } else {
      const c = peer.connect(ID_PREFIX + code, { reliable: true });
      await new Promise((resolve, reject) => {
        c.on('open', resolve);
        peer.on('error', (e) => reject(new Error(e.type === 'peer-unavailable' ? 'No lobby with that code is open.' : String(e.message || e))));
        setTimeout(() => reject(new Error('Timed out connecting to the host.')), 15000);
      });
      conns.set('host', c);
      wire(c);
    }
    return Object.assign(em, {
      kind: 'internet', code, myId: isHost ? 'host' : peer.id, isHost,
      send: (msg, to) => {
        if (!isHost) { const h = conns.get('host'); if (h) h.send(msg); return; }
        if (to) { const c = conns.get(to); if (c) c.send(msg); return; }
        conns.forEach((c) => c.send(msg));
      },
      close: () => peer.destroy(),
    });
  }

  N.host = async function (kind) {
    const code = randomCode();
    return kind === 'local' ? local(code, true) : internet(code, true);
  };
  N.join = async function (kind, code) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error('Room codes are six letters or digits.');
    return kind === 'local' ? local(code, false) : internet(code, false);
  };

  FL.Net = N;
})(globalThis.FL = globalThis.FL || {});
