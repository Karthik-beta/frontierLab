/* world.js — each run's hidden world: randomized effect strengths and 2-3 secret world traits
 * (e.g. alignment is harder than anyone thinks, a compute glut is coming, regulators are hawkish).
 * The player never sees these directly; hints surface over time, some of them misleading. */
(function (FL) {
  'use strict';
  const W = {};
  /** Sample edge multipliers and traits for a new run. TODO: implement.
   * Acceptance: deterministic per seed; multipliers in [0.6, 1.4]; 2-3 traits from FL.WORLD_TRAITS. */
  W.init = function (state) { throw new Error('NotImplemented: World.init'); };
  /** Multiplier applied to an effect edge's k. TODO: implement. */
  W.edgeMult = function (state, e) { throw new Error('NotImplemented: edgeMult'); };
  /** Trait hooks the engine queries (e.g. 'alignmentDrag'). TODO: implement. */
  W.mod = function (state, key, dflt) { throw new Error('NotImplemented: mod'); };
  /** Per-tick hint generation: true and false "analyst notes". TODO: implement. */
  W.tick = function (state, qr, dt) { throw new Error('NotImplemented: World.tick'); };
  FL.World = W;
})(globalThis.FL = globalThis.FL || {});
