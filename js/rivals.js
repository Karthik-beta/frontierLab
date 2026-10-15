/* rivals.js — interacting with opponents, for better or worse. Hostile moves (poach, price war,
 * antitrust complaint, espionage, smear, compute lockout, lawsuit) and cooperative ones (safety research,
 * pause pact, compute sales, licensing, coalition, acquisition). Rivals have hidden personalities and act
 * on you too. Works against AI rivals locally and against human players via the multiplayer relay. */
(function (FL) {
  'use strict';
  const R = {};
  /** Init relations and personas for every rival. TODO: implement. */
  R.init = function (state) { throw new Error('NotImplemented: Rivals.init'); };
  /** Can the player do this to that rival now? Returns null or a reason. TODO: implement. */
  R.blocker = function (state, actionId, rivalId) { throw new Error('NotImplemented: blocker'); };
  /** Perform an action against/with a rival. TODO: implement. Acceptance: costs paid, outcome rolled, relation updated, journaled. */
  R.act = function (state, actionId, rivalId) { throw new Error('NotImplemented: act'); };
  /** Apply an impact payload from another lab to this state (multiplayer or AI). TODO: implement. */
  R.receive = function (state, impact, meta) { throw new Error('NotImplemented: receive'); };
  /** AI rivals take actions toward the player (per tick, Poisson by persona). TODO: implement. */
  R.tick = function (state, qr, dt) { throw new Error('NotImplemented: Rivals.tick'); };
  FL.Rivals = R;
})(globalThis.FL = globalThis.FL || {});
