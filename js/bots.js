/* bots.js — AI strategies that play a company: used by the balance simulator (tools/simulate.js)
 * and by multiplayer bot seats. Each bot mutates state through the normal engine API. */
(function (FL) {
  'use strict';
  const E = FL.Engine;
  // Bot strategies: return nothing, mutate state via E.changePolicy.
  const BOTS = {
    idle: () => {},
    random: (s) => {
      const ids = FL.POLICIES.map((p) => p.id);
      for (let i = 0; i < 3; i++) {
        const id = ids[Math.floor(E.rand(s) * ids.length)];
        if (s.policies[id]) E.adjustPolicy(s, id, E.rand(s));
        else E.implementPolicy(s, id, E.rand(s));
      }
    },
    // A plausible human plan: build compute + talent, ship products, keep safety up, watch the board.
    sensible: (s) => {
      const want = [
        ['comp', 0.6], ['pretrain', 0.5], ['consumerApp', 0.6], ['api', 0.6], ['alignment', 0.6],
        ['execTeam', 0.5], ['gpuSpot', 0.3], ['entSales', 0.6], ['redteam', 0.5], ['culture', 0.5],
        ['coding', 0.6], ['secProgram', 0.5], ['datacenters', 0.4], ['licensing', 0.3], ['reasoning', 0.6],
        ['interp', 0.4], ['pricing', 0.5], ['audits', 0.4], ['energy', 0.4], ['synthData', 0.5],
      ];
      const runwayQ = s.finance.net >= 0 ? 99 : s.cash / -s.finance.net;
      const toRound = s.nextRound - s.turn;
      for (const [id, lvl] of want) {
        if (s.policies[id]) continue;
        const added = E.policyCost(s, id, lvl);
        const newRunway = s.finance.net - added >= 0 ? 99 : s.cash / -(s.finance.net - added);
        if (newRunway < Math.max(3, toRound + 1)) continue;
        E.implementPolicy(s, id, lvl);
      }
      if (runwayQ < toRound + 0.5) {
        for (const id of ['datacenters', 'gpuSpot', 'pretrain', 'reasoning', 'freeTier']) if (s.policies[id] && s.policies[id].level > 0) E.adjustPolicy(s, id, Math.max(0, s.policies[id].level - 0.3));
      }
    },
  };

  BOTS.safetyFirst = (s) => {
    for (const [id, lvl] of [['alignment', 0.9], ['interp', 0.7], ['redteam', 0.7], ['secProgram', 0.6], ['rsp', 0.3], ['culture', 0.6]]) {
      if (!s.policies[id]) E.implementPolicy(s, id, lvl);
    }
    BOTS.sensible(s);
  };

  // Adaptive: spend to runway, keep safety ahead of capability, cool off regulators.
  BOTS.adaptive = (s) => {
    const base = [['comp', 0.5], ['consumerApp', 0.5], ['api', 0.5], ['execTeam', 0.6], ['alignment', 0.6], ['culture', 0.5],
      ['pretrain', 0.4], ['entSales', 0.5], ['coding', 0.5], ['redteam', 0.5], ['secProgram', 0.5], ['pricing', 0.5],
      ['datacenters', 0.3], ['interp', 0.5], ['reasoning', 0.5], ['audits', 0.4], ['licensing', 0.3], ['energy', 0.3], ['synthData', 0.4]];
    const runwayQ = s.finance.net >= 0 ? 99 : s.cash / -s.finance.net;
    const need = s.nextRound - s.turn + 1.5;
    let net = s.finance.net;
    for (const [id, l] of base) {
      if (s.policies[id] || s.bandwidth < E.node(id).def.intro + 2) continue;
      const after = net - E.policyCost(s, id, l);
      if (after < 0 && s.cash / -after < need) continue;
      if (E.implementPolicy(s, id, l).ok) net = after;
    }
    const knobs = ['datacenters', 'pretrain', 'gpuSpot', 'reasoning', 'comp'];
    for (const id of knobs) {
      if (runwayQ > need + 2) { if (!s.policies[id]) E.implementPolicy(s, id, 0.3); else E.adjustPolicy(s, id, s.policies[id].level + 0.1); }
      else if (runwayQ < need && s.policies[id]) E.adjustPolicy(s, id, s.policies[id].level - 0.2);
    }
    if (s.values.safety < 0.55) for (const id of ['alignment', 'interp', 'redteam']) if (s.policies[id]) E.adjustPolicy(s, id, s.policies[id].level + 0.1);
    if (s.values.regHeat > 0.45 && !s.policies.lobbying) E.implementPolicy(s, 'lobbying', 0.5);
  };


  /** Resolve a pending decision the way a bot would (first option, unless it ends the company). */
  BOTS.decide = (s) => {
    const d = FL.DILEMMAS.find((x) => x.id === s.pendingDilemma);
    if (!d) return;
    const i = d.options.findIndex((o) => !['oust', 'acquihire'].includes(o.special));
    E.resolveDilemma(s, Math.max(0, i));
  };

  FL.Bots = BOTS;
})(globalThis.FL = globalThis.FL || {});
