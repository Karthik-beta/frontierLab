/* playbook.js — the Growth Playbook: commit to up to three stances from Blitzscaling's
 * counterintuitive rules and YC's maxims. Each changes stats and multipliers, with real tradeoffs. */
(function (FL) {
  'use strict';
  const E = FL.Engine;
  const P = {};
  const play = (id) => FL.PLAYS.find((x) => x.id === id);
  P.COST = 3;

  P.active = (state) => (state.plays || []).map(play).filter(Boolean);
  const stageIdx = (state) => (FL.Growth && state.growth ? FL.BLITZ_STAGES.findIndex((s) => s.id === FL.Growth.stage(state).id) : 0);
  const appliesNow = (state, p) => (!p.lateOnly || stageIdx(state) >= 3) && (!p.earlyOnly || true);

  P.set = function (state, ids) {
    ids = [...new Set(ids)].filter(play).slice(0, FL.MAX_PLAYS);
    const cur = state.plays || [];
    if (ids.length === cur.length && ids.every((x) => cur.includes(x))) return { ok: true };
    if (state.bandwidth < P.COST) return { ok: false, reason: `Needs ${P.COST} bandwidth.` };
    state.bandwidth -= P.COST;
    state.plays = ids;
    E.emit(state, { type: 'policy', text: `Growth playbook: ${ids.map((x) => play(x).name).join(', ') || 'none'}` });
    const res = { ok: true, artifacts: [], achievements: [] };
    if (FL.Systems) ids.forEach((x) => FL.Systems.fireTrigger(state, 'play:' + x, res));
    return res;
  };

  /** Engine hooks. Multiplicative for raise/costs, additive otherwise. */
  P.mod = function (state, key, dflt) {
    let v = dflt;
    const late = stageIdx(state) >= 2; // Village and up
    for (const p of P.active(state)) {
      if (!appliesNow(state, p)) continue;
      const m = p.mods || {};
      if (key === 'raise' || key === 'costs') { if (m[key]) v *= m[key]; continue; }
      if (key === 'bandwidth') {
        v += m.bandwidth || 0;
        if (m.lateBandwidth && late) v += m.lateBandwidth;
        if (m.lateBandwidthBonus) v += m.lateBandwidthBonus;
        continue;
      }
      if (key === 'stageBandwidth') { if (m.stageBandwidth) v = true; continue; }
      if (m[key] != null) v += m[key];
    }
    return v;
  };

  E.registerInput('playbook', 'Growth playbook', (state) => {
    const out = {};
    const small = stageIdx(state) <= 1; // Family or Tribe
    for (const p of P.active(state)) {
      if (!appliesNow(state, p)) continue;
      const scale = p.earlyOnly && !small ? 0.3 : 1;
      for (const [k, v] of Object.entries(p.fx)) out[k] = (out[k] || 0) + v * scale;
    }
    return out;
  });

  FL.Playbook = P;
})(globalThis.FL = globalThis.FL || {});
