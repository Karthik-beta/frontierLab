/* marketing.js — campaigns (one-off, results revealed at quarter end), launch strategy for each
 * new model, PR damping of bad press, and the Brand stat's extra inputs. */
(function (FL) {
  'use strict';
  const M = {};
  /** Init marketing state. TODO: implement. */
  M.init = function (state) { throw new Error('NotImplemented: init'); };
  /** Campaigns available now (cooldowns, requirements). TODO: implement. Depends on: FL.CAMPAIGNS. */
  M.available = function (state) { throw new Error('NotImplemented: available'); };
  /** Book a campaign for this quarter (cash + bandwidth now, results at quarter end). TODO: implement. */
  M.book = function (state, id) { throw new Error('NotImplemented: book'); };
  /** Resolve booked campaigns with variance; returns results for the report. TODO: implement. */
  M.update = function (state, report) { throw new Error('NotImplemented: update'); };
  /** Queue the launch-strategy decision when a model generation ships. TODO: implement. */
  M.onModelShipped = function (state, report, model) { throw new Error('NotImplemented: onModelShipped'); };
  FL.Marketing = M;
})(globalThis.FL = globalThis.FL || {});
