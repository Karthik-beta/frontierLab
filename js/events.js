/* events.js — chance in real time:
 *  - World events that help or hurt everyone, labs matching a condition, or a random subset.
 *  - Golden opportunities (Cookie Clicker's golden cookies / Plague Inc's bubbles): short-lived,
 *    clickable bonuses — and risky "wrath" ones.
 *  - Timed buffs those produce (Frenzy-style multipliers). */
(function (FL) {
  'use strict';
  const V = {};
  /** Roll world events (Poisson). Returns the event applied, or null. TODO: implement. */
  V.rollWorldEvent = function (state, qr, dt) { throw new Error('NotImplemented: rollWorldEvent'); };
  /** Apply a world event to this state (player + AI rivals), honoring its scope. TODO: implement. */
  V.applyWorldEvent = function (state, eventId, salt) { throw new Error('NotImplemented: applyWorldEvent'); };
  /** Spawn/expire golden opportunities. TODO: implement. */
  V.tickOpportunities = function (state, qr, dt) { throw new Error('NotImplemented: tickOpportunities'); };
  /** Claim an opportunity by uid. TODO: implement. */
  V.claim = function (state, uid) { throw new Error('NotImplemented: claim'); };
  /** Active buff multiplier / additive inputs. TODO: implement. */
  V.mult = function (state, key) { throw new Error('NotImplemented: mult'); };
  FL.Events = V;
})(globalThis.FL = globalThis.FL || {});
