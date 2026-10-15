/* multiplayer.js — lobbies and the shared race. Each player runs their own company sim; the host
 * runs a turn barrier (everyone ends the quarter, then all advance) and relays public snapshots,
 * which appear as rival labs. Bots can fill empty seats. */
(function (FL) {
  'use strict';
  const MP = {};
  /** Create a lobby as host. TODO: implement. Depends on: FL.Net. */
  MP.hostLobby = async function (opts) { throw new Error('NotImplemented: hostLobby'); };
  /** Join a lobby. TODO: implement. */
  MP.joinLobby = async function (code, opts) { throw new Error('NotImplemented: joinLobby'); };
  /** Host: add an AI bot seat. TODO: implement. */
  MP.addBot = function (name) { throw new Error('NotImplemented: addBot'); };
  /** Host: start the match (shared seed, difficulty). TODO: implement. */
  MP.start = function () { throw new Error('NotImplemented: start'); };
  /** Player ended their quarter; wait for the barrier. TODO: implement. */
  MP.ready = function () { throw new Error('NotImplemented: ready'); };
  /** Apply remote snapshots to this player's rival list. TODO: implement. */
  MP.applySnapshots = function (state) { throw new Error('NotImplemented: applySnapshots'); };
  FL.Multiplayer = MP;
})(globalThis.FL = globalThis.FL || {});
