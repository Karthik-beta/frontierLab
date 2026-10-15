/* playbook.js — the Growth Playbook: commit to up to three stances from Blitzscaling's
 * counterintuitive rules and YC's maxims. Each changes stats and multipliers, with real tradeoffs. */
(function (FL) {
  'use strict';
  const P = {};
  /** Set the active plays (max 3; costs bandwidth to change). TODO: implement. */
  P.set = function (state, ids) { throw new Error('NotImplemented: Playbook.set'); };
  /** Multiplier/additive hooks read by the engine: 'raise', 'costs', 'bandwidth', 'toxicity', 'managerVolume', 'viral'. TODO: implement. */
  P.mod = function (state, key, dflt) { throw new Error('NotImplemented: Playbook.mod'); };
  FL.Playbook = P;
})(globalThis.FL = globalThis.FL || {});
