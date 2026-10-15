/* engine.js — pure simulation (no DOM). Works in the browser and in node via vm. */
(function (FL) {
  'use strict';
  const E = {};

  /** Seeded RNG (mulberry32).
   * TODO: implement.
   * What's missing: the PRNG body.
   * Acceptance: same seed -> same sequence of floats in [0,1).
   * Depends on: nothing. */
  E.makeRng = function (seed) { throw new Error('NotImplemented: makeRng'); };

  /** Build a fresh game state for an archetype.
   * TODO: implement.
   * What's missing: state shape, archetype policies/baseMods, warm-started network.
   * Acceptance: returns serialisable state with turn=1, no NaNs anywhere.
   * Depends on: FL.ARCHETYPES, FL.POLICIES, E.updateNetwork. */
  E.newGame = function (archetypeId, companyName, seed) { throw new Error('NotImplemented: newGame'); };

  /** Map a raw value through an effect curve ('lin'|'sqrt'|'sq'|'ctr'|'inv').
   * TODO: implement. Acceptance: ctr maps [0,1] -> [-1,1]. Depends on: nothing. */
  E.curve = function (kind, x) { throw new Error('NotImplemented: curve'); };

  /** Current value of any node id as an effect source.
   * TODO: implement. Acceptance: inactive policy -> 0; active -> 0.2+0.8*level;
   * stats/indicators -> value; situations -> 0|1; stakeholders -> happiness. Depends on: E.nodeType. */
  E.sourceValue = function (state, id) { throw new Error('NotImplemented: sourceValue'); };

  /** Flattened list of every effect edge in the game graph.
   * TODO: implement. Acceptance: each edge {from,to,k,curve,lag,idx}. Depends on: all FL data. */
  E.allEffects = function () { throw new Error('NotImplemented: allEffects'); };

  /** Graph queries for the UI. TODO: implement. Depends on: E.allEffects. */
  E.effectsInto = function (id) { throw new Error('NotImplemented: effectsInto'); };
  E.effectsFrom = function (id) { throw new Error('NotImplemented: effectsFrom'); };

  /** Recompute derived indicators (capability %, race lead, runway, revenue momentum).
   * TODO: implement. Depends on: state.cap, state.rivals, state.finance. */
  E.updateIndicators = function (state) { throw new Error('NotImplemented: updateIndicators'); };

  /** One step of the lagged effect network: stats, stakeholders, situation pressures.
   * TODO: implement. Acceptance: values clamped; lag smooths contributions. Depends on: E.allEffects. */
  E.updateNetwork = function (state, instant) { throw new Error('NotImplemented: updateNetwork'); };

  /** Toggle situations with hysteresis. TODO: implement. Returns {started:[],ended:[]}. */
  E.updateSituations = function (state) { throw new Error('NotImplemented: updateSituations'); };

  /** Revenue and cost breakdown for the current quarter ($M). TODO: implement. */
  E.computeFinances = function (state) { throw new Error('NotImplemented: computeFinances'); };

  /** Advance our frontier capability (incl. RSP throttle). TODO: implement. */
  E.advanceCapability = function (state) { throw new Error('NotImplemented: advanceCapability'); };

  /** Advance rival labs; returns news strings. TODO: implement. */
  E.advanceRivals = function (state) { throw new Error('NotImplemented: advanceRivals'); };

  /** Bandwidth (political capital) gained per quarter. TODO: implement. */
  E.bandwidthIncome = function (state) { throw new Error('NotImplemented: bandwidthIncome'); };

  /** Weighted stakeholder approval in [-1,1]. TODO: implement. */
  E.approval = function (state) { throw new Error('NotImplemented: approval'); };

  /** Bandwidth cost to implement / adjust / cancel a policy. TODO: implement. */
  E.policyChangeCost = function (state, id, newLevel) { throw new Error('NotImplemented: policyChangeCost'); };
  E.implementPolicy = function (state, id, level) { throw new Error('NotImplemented: implementPolicy'); };
  E.adjustPolicy = function (state, id, level) { throw new Error('NotImplemented: adjustPolicy'); };
  E.cancelPolicy = function (state, id) { throw new Error('NotImplemented: cancelPolicy'); };

  /** Company valuation ($M). TODO: implement. */
  E.valuation = function (state) { throw new Error('NotImplemented: valuation'); };

  /** Run a scheduled funding round. TODO: implement. Returns {ok, raised, valuation, text}. */
  E.fundingRound = function (state) { throw new Error('NotImplemented: fundingRound'); };

  /** Pick a random eligible dilemma or null. TODO: implement. */
  E.rollDilemma = function (state) { throw new Error('NotImplemented: rollDilemma'); };

  /** Apply the chosen option of the pending dilemma. TODO: implement. */
  E.resolveDilemma = function (state, optionIndex) { throw new Error('NotImplemented: resolveDilemma'); };

  /** Detect game endings. TODO: implement. Returns {id,title,text,win} | null. */
  E.checkEnding = function (state) { throw new Error('NotImplemented: checkEnding'); };

  /** Advance one quarter; returns a report for the UI. TODO: implement. */
  E.endTurn = function (state) { throw new Error('NotImplemented: endTurn'); };

  FL.Engine = E;
})(globalThis.FL = globalThis.FL || {});
