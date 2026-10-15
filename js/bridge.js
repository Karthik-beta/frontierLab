/* bridge.js — lets the `frontier` CLI (and Claude Code) drive the browser game.
 * Active only when the page is served by tools/serve.js (http://localhost). */
(function (FL) {
  'use strict';
  const B = {};
  /** Connect to the local bridge via Server-Sent Events. TODO: implement. */
  B.connect = function () { throw new Error('NotImplemented: connect'); };
  /** Execute one CLI command against the live game; return a JSON-able result. TODO: implement. */
  B.exec = function (cmd, args) { throw new Error('NotImplemented: exec'); };
  /** Compact state snapshot for `frontier status --json`. TODO: implement. */
  B.snapshot = function () { throw new Error('NotImplemented: snapshot'); };
  FL.Bridge = B;
})(globalThis.FL = globalThis.FL || {});
