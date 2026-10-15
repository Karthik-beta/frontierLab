/* fog.js — the observation layer. The UI and the CLI only ever see what this returns:
 * rival capabilities as estimates from public releases and intel, your own safety as an eval
 * estimate, public trust as a poll, and policy effects as qualitative, uncertain labels. */
(function (FL) {
  'use strict';
  const F = {};
  /** Init intel records for every rival. TODO: implement. */
  F.init = function (state) { throw new Error('NotImplemented: Fog.init'); };
  /** Record a public observation of a rival (release, leak, ex-employee). TODO: implement. */
  F.observeRival = function (state, rivalId, value, sd, source) { throw new Error('NotImplemented: observeRival'); };
  /** Current estimate {est, sd, lastSeen, source} for a rival. TODO: implement. */
  F.rivalEstimate = function (state, rival) { throw new Error('NotImplemented: rivalEstimate'); };
  /** Your measured safety / polled trust {est, sd}. TODO: implement. */
  F.measured = function (state, statId) { throw new Error('NotImplemented: measured'); };
  /** Qualitative label for an effect edge, with confidence. TODO: implement. */
  F.effectLabel = function (state, edge, strength) { throw new Error('NotImplemented: effectLabel'); };
  /** Per-tick intel: leaks, resampled polls/evals at quarter boundaries. TODO: implement. */
  F.tick = function (state, qr, dt) { throw new Error('NotImplemented: Fog.tick'); };
  /** Everything the player may see, for UI and CLI. TODO: implement. */
  F.view = function (state) { throw new Error('NotImplemented: Fog.view'); };
  FL.Fog = F;
})(globalThis.FL = globalThis.FL || {});
