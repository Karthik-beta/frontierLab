/* legacy.js — prestige (Cookie Clicker's ascension): finishing a run earns Legacy points to spend
 * on small permanent perks for future single-player runs. */
(function (FL) {
  'use strict';
  const L = {};
  /** Legacy points earned by a finished run. TODO: implement. */
  L.earned = function (state) { throw new Error('NotImplemented: earned'); };
  /** Apply purchased perks to a new single-player game. TODO: implement. */
  L.apply = function (state, perks) { throw new Error('NotImplemented: apply'); };
  FL.Legacy = L;
})(globalThis.FL = globalThis.FL || {});
