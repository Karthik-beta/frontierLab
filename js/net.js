/* net.js — peer-to-peer transports for multiplayer.
 * PeerJS (WebRTC over the free public broker; loaded lazily from a pinned CDN build) for the internet,
 * BroadcastChannel for tabs in the same browser (testing / couch play). Same interface for both. */
(function (FL) {
  'use strict';
  const N = {};
  /** Host a room; returns {code, send(to|null, msg), onMessage(fn), onPeer(fn), close()}. TODO: implement. */
  N.host = async function (kind) { throw new Error('NotImplemented: host'); };
  /** Join a room by code; same interface. TODO: implement. */
  N.join = async function (kind, code) { throw new Error('NotImplemented: join'); };
  FL.Net = N;
})(globalThis.FL = globalThis.FL || {});
