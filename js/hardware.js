/* hardware.js — the GPU fleet: chip generations, purchases, leases, failures, depreciation,
 * power limits and compute deals offered by providers. Feeds the Compute Capacity stat. */
(function (FL) {
  'use strict';
  const H = {};

  /** Chip generation available to buy this quarter. TODO: implement. Depends on: FL.CHIP_GENS. */
  H.currentGen = function (state) { throw new Error('NotImplemented: currentGen'); };

  /** Effective compute (perf-weighted, health- and power-limited units). TODO: implement.
   * Acceptance: monotone in units; old gens count less after new ones ship (relative to frontier need). */
  H.effectiveCompute = function (state) { throw new Error('NotImplemented: effectiveCompute'); };

  /** Frontier compute requirement that grows over time. TODO: implement. */
  H.frontierNeed = function (state) { throw new Error('NotImplemented: frontierNeed'); };

  /** Map effective/need ratio to the 0..1 contribution into Compute Capacity. TODO: implement. */
  H.computeBonus = function (state) { throw new Error('NotImplemented: computeBonus'); };

  /** One quarter: deliveries, spot rentals, lease expiry, failures (bathtub curve), depreciation, opex.
   * TODO: implement. Acceptance: returns {failed, delivered, expired, opex, depreciation}. */
  H.update = function (state, report) { throw new Error('NotImplemented: update'); };

  /** Deal offers from providers; accept/decline. TODO: implement. Depends on: FL.COMPUTE_OFFERS. */
  H.rollOffers = function (state, report) { throw new Error('NotImplemented: rollOffers'); };
  H.acceptOffer = function (state, offerId) { throw new Error('NotImplemented: acceptOffer'); };

  /** Sell or retire an owned cluster. TODO: implement. */
  H.sellCluster = function (state, clusterId) { throw new Error('NotImplemented: sellCluster'); };

  FL.Hardware = H;
})(globalThis.FL = globalThis.FL || {});
