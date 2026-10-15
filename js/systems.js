/* systems.js — long-arc systems layered on the core engine:
 * pitfalls (short/medium/long-term traps with warning signs), the historical archive,
 * milestones (model generations, valuation tiers), objectives, eras and headlines. */
(function (FL) {
  'use strict';
  const E = FL.Engine;
  const S = {};

  /** Advance every pitfall meter and fire any that cross 1.0.
   * TODO: implement.
   * What's missing: meter integration, warning-sign reporting at 0.35/0.7, firing into the dilemma queue.
   * Acceptance: meters stay in [0, 1.2]; at most one pitfall fires per quarter; fired pitfalls report history + lesson.
   * Depends on: FL.PITFALLS, E.queueDilemma. */
  S.updatePitfalls = function (state, report) { throw new Error('NotImplemented: updatePitfalls'); };

  /** Unlock every archive artifact whose trigger matches `key` (e.g. 'policy:nonprofit').
   * TODO: implement. Acceptance: idempotent per run; pushes {id} to report.artifacts. Depends on: FL.ARCHIVE. */
  S.fireTrigger = function (state, key, report) { throw new Error('NotImplemented: fireTrigger'); };

  /** Emit triggers implied by the quarter's state changes (policies, situations, milestones, rounds).
   * TODO: implement. Depends on: S.fireTrigger. */
  S.scanTriggers = function (state, report, before) { throw new Error('NotImplemented: scanTriggers'); };

  /** Model-generation releases and valuation tiers crossed this quarter.
   * TODO: implement. Acceptance: each milestone fires once per run; pushes to report.milestones. Depends on: FL.MODEL_GENS, FL.VALUATION_TIERS. */
  S.checkMilestones = function (state, report, before) { throw new Error('NotImplemented: checkMilestones'); };

  /** Resolve due objectives and deal new ones. TODO: implement. Depends on: FL.OBJECTIVES. */
  S.updateObjectives = function (state, report) { throw new Error('NotImplemented: updateObjectives'); };

  /** Current era {id,name,tension} by capability. TODO: implement. Depends on: FL.ERAS. */
  S.eraOf = function (state) { throw new Error('NotImplemented: eraOf'); };

  /** Newspaper headline + subhead for the quarter. TODO: implement. */
  S.headline = function (state, report) { throw new Error('NotImplemented: headline'); };

  /** Hook called by E.endTurn after the core update. TODO: implement. */
  S.run = function (state, report, before) { throw new Error('NotImplemented: run'); };

  FL.Systems = S;
})(globalThis.FL = globalThis.FL || {});
