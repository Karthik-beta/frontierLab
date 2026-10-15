/* fx.js — "juice": count-ups, floating deltas, particle bursts, shake, toasts. */
(function (FL) {
  'use strict';
  const FX = {};
  /** Tween a number inside an element. TODO: implement. */
  FX.countUp = function (el, from, to, ms, fmt) { throw new Error('NotImplemented: countUp'); };
  /** Floating "+4" text above an SVG node. TODO: implement. */
  FX.floatDelta = function (svg, x, y, text, color) { throw new Error('NotImplemented: floatDelta'); };
  /** Particle burst at screen coords. TODO: implement. */
  FX.burst = function (x, y, color, n) { throw new Error('NotImplemented: burst'); };
  /** Short screen shake of an element. TODO: implement. */
  FX.shake = function (el, px, ms) { throw new Error('NotImplemented: shake'); };
  /** Toast notification. TODO: implement. */
  FX.toast = function (html, kind, ms) { throw new Error('NotImplemented: toast'); };
  FL.FX = FX;
})(globalThis.FL = globalThis.FL || {});
