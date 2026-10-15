/* ui.js — DOM + SVG rendering. */
(function (FL) {
  'use strict';
  const UI = {};

  /** Boot the UI: start screen or continue saved game. TODO: implement. Depends on: FL.Engine. */
  UI.init = function () { throw new Error('NotImplemented: init'); };

  /** Compute board coordinates for every node. TODO: implement. Acceptance: policies on outer
   * ring grouped by category, stats on middle ring, active situations around centre. */
  UI.layout = function (state) { throw new Error('NotImplemented: layout'); };

  /** Render the SVG board. TODO: implement. */
  UI.renderBoard = function () { throw new Error('NotImplemented: renderBoard'); };

  /** Top bar, stakeholder list, race panel. TODO: implement. */
  UI.renderTopbar = function () { throw new Error('NotImplemented: renderTopbar'); };
  UI.renderLeft = function () { throw new Error('NotImplemented: renderLeft'); };

  /** Inspector for a node id (policy/stat/situation/stakeholder) or finances. TODO: implement. */
  UI.inspect = function (id) { throw new Error('NotImplemented: inspect'); };

  /** Draw/clear hover connection lines. TODO: implement. */
  UI.highlight = function (id) { throw new Error('NotImplemented: highlight'); };

  /** Modals: report, dilemma, ending, start. TODO: implement. */
  UI.showReport = function (report) { throw new Error('NotImplemented: showReport'); };
  UI.showDilemma = function () { throw new Error('NotImplemented: showDilemma'); };
  UI.showEnding = function (ending) { throw new Error('NotImplemented: showEnding'); };
  UI.showStart = function () { throw new Error('NotImplemented: showStart'); };

  FL.UI = UI;
})(globalThis.FL = globalThis.FL || {});
