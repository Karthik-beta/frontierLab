/* hiring.js — LinkedIn-style recruiting: individual hires early, hiring managers later,
 * hiring practices and culture values with long-term consequences. */
(function (FL) {
  'use strict';
  const R = {};

  /** Generate a candidate profile (name, role, seniority, ex-employer, skill, traits, ask). TODO: implement. */
  R.makeCandidate = function (state, opts) { throw new Error('NotImplemented: makeCandidate'); };

  /** Refresh the candidate feed each quarter. TODO: implement. */
  R.refreshFeed = function (state) { throw new Error('NotImplemented: refreshFeed'); };

  /** Make an offer; acceptance depends on comp, mission, race position, culture. TODO: implement. */
  R.makeOffer = function (state, candidateId) { throw new Error('NotImplemented: makeOffer'); };

  /** Appoint a hire as a hiring manager (unlocks automatic hiring). TODO: implement. */
  R.appointManager = function (state, personId) { throw new Error('NotImplemented: appointManager'); };

  /** Toggle a hiring practice / set culture values (cost bandwidth, lagged effect). TODO: implement. */
  R.setPractice = function (state, practiceId, on) { throw new Error('NotImplemented: setPractice'); };
  R.setValues = function (state, valueIds) { throw new Error('NotImplemented: setValues'); };

  /** Per-quarter: auto-hires, attrition, trait events, culture toxicity. TODO: implement. */
  R.update = function (state, report) { throw new Error('NotImplemented: update'); };

  /** Team contribution to stats {statId: delta}. TODO: implement. */
  R.teamBonus = function (state) { throw new Error('NotImplemented: teamBonus'); };

  FL.Hiring = R;
})(globalThis.FL = globalThis.FL || {});
