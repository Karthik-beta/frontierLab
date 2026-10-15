/* hiring.js — LinkedIn-style recruiting: individual hires early, hiring managers later,
 * hiring practices and culture values with long-term consequences.
 *
 * state.people = { roster, feed, managers, practices, values, toxicity, nextId, events }
 * Every person on the roster contributes to stats through E.registerInput('team', ...). */
(function (FL) {
  'use strict';
  const E = FL.Engine;
  const R = {};
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const rnd = (s) => E.rand(s);
  const pick = (s, arr) => arr[Math.floor(rnd(s) * arr.length)];
  const traitOf = (id) => FL.TRAITS.find((t) => t.id === id);
  const roleOf = (id) => FL.ROLES.find((r) => r.id === id);
  const practiceOf = (id) => FL.PRACTICES.find((p) => p.id === id);
  const valueOf = (id) => FL.CULTURE_VALUES.find((v) => v.id === id);
  const activePractices = (s) => Object.keys(s.people.practices).filter((k) => s.people.practices[k]).map(practiceOf).filter(Boolean);
  const activeValues = (s) => s.people.values.map(valueOf).filter(Boolean);
  const has = (p, t) => p.traits.includes(t);

  R.MANAGER_UNLOCK = 5;
  R.costs = { offer: 1, manager: 3, practice: 2, values: 4 };

  R.init = function (state, arch) {
    state.people = { roster: [], feed: [], managers: [], practices: {}, values: [], toxicity: 0.05, nextId: 1, hiredTotal: 0, departed: 0 };
    // Co-founders.
    R.add(state, R.makeCandidate(state, { role: 'research', seniority: 3, traits: ['mission'], name: null }), true);
    R.add(state, R.makeCandidate(state, { role: 'infra', seniority: 2, traits: ['builder'] }), true);
    if (arch && arch.id === 'defectors') R.add(state, R.makeCandidate(state, { role: 'safety', seniority: 3, traits: ['safetyMinded', 'mission'] }), true);
    if (arch && arch.id === 'spinout') R.add(state, R.makeCandidate(state, { role: 'gtm', seniority: 2, traits: ['politician'] }), true);
    R.refreshFeed(state);
  };

  const payScale = (state) => Math.pow(1.04, state.turn - 1);

  /** Generate a candidate profile. Hidden traits are only shown once revealed. */
  R.makeCandidate = function (state, opts) {
    opts = opts || {};
    const P = state.people;
    const roleW = FL.ROLES.reduce((a, r) => a + r.weight, 0);
    let role = opts.role;
    if (!role) { let x = rnd(state) * roleW; for (const r of FL.ROLES) { x -= r.weight; if (x <= 0) { role = r.id; break; } } role = role || 'research'; }
    let sen = opts.seniority;
    if (sen == null) { const x = rnd(state); sen = x < 0.3 ? 0 : x < 0.62 ? 1 : x < 0.85 ? 2 : x < 0.97 ? 3 : 4; }
    let traits = opts.traits;
    if (!traits) {
      traits = [];
      const n = rnd(state) < 0.6 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const t = pick(state, FL.TRAITS);
        if (!traits.includes(t.id)) traits.push(t.id);
      }
    }
    let skill = 35 + sen * 12 + rnd(state) * 18 + (opts.quality || 0);
    for (const t of traits) skill += traitOf(t).skill || 0;
    const rival = pick(state, state.rivals || FL.RIVALS);
    const from = rnd(state) < 0.35 ? `ex-${rival.name.replace(/ \(.*\)/, '')}` : pick(state, FL.BACKGROUNDS);
    return {
      id: P ? P.nextId++ : 0,
      name: opts.name || `${pick(state, FL.NAMES_FIRST)} ${pick(state, FL.NAMES_LAST)}`,
      role, seniority: sen, skill: clamp(Math.round(skill), 10, 100), traits,
      revealed: traits.filter((t) => !traitOf(t).hidden),
      from, salary: FL.SENIORITY_PAY[sen] * payScale(state) * (0.85 + rnd(state) * 0.3),
      connections: 200 + Math.floor(rnd(state) * 1800), expires: state.turn + 2,
    };
  };

  R.headline = (p) => `${FL.SENIORITY[p.seniority]} ${roleOf(p.role).name} · ${p.from}`;

  R.add = function (state, p, founder) {
    p.hired = state.turn;
    p.founder = !!founder;
    if (founder) p.revealed = p.traits.slice();
    state.people.roster.push(p);
    state.people.hiredTotal++;
  };

  /** Keep 4-6 candidates in the feed. Some take other offers if you wait. */
  R.refreshFeed = function (state) {
    const P = state.people;
    P.feed = P.feed.filter((c) => c.expires > state.turn);
    const target = 4 + Math.min(2, Math.floor(state.turn / 8));
    while (P.feed.length < target) P.feed.push(R.makeCandidate(state));
  };

  /** Chance a candidate accepts: pay, mission, winning, morale, culture reputation. */
  R.acceptChance = function (state, c) {
    const v = state.values;
    const comp = state.policies.comp ? 0.2 + 0.8 * state.policies.comp.level : 0;
    let p = 0.45 + comp * 0.3 + (v.lead - 0.5) * 0.5 + (v.morale - 0.5) * 0.3 - state.people.toxicity * 0.3;
    if (has(c, 'mission')) p += (state.policies.nonprofit ? 0.1 : 0) + (v.safety - 0.3) * 0.2;
    if (has(c, 'mercenary')) p += comp * 0.2 - 0.1;
    if (has(c, 'safetyMinded')) p += (v.safety - 0.4) * 0.5;
    p -= c.seniority >= 4 ? 0.25 : c.seniority >= 3 ? 0.1 : 0;
    return clamp(p, 0.05, 0.95);
  };

  R.makeOffer = function (state, candidateId) {
    const P = state.people;
    const c = P.feed.find((x) => x.id === +candidateId);
    if (!c) return { ok: false, reason: 'They are no longer available.' };
    if (state.bandwidth < R.costs.offer) return { ok: false, reason: `Needs ${R.costs.offer} bandwidth.` };
    state.bandwidth -= R.costs.offer;
    P.feed = P.feed.filter((x) => x !== c);
    if (rnd(state) < R.acceptChance(state, c)) {
      R.reveal(state, c);
      R.add(state, c);
      state.log.push({ turn: state.turn, text: `Hired ${c.name}, ${R.headline(c)}` });
      const res = { ok: true, accepted: true, person: c, artifacts: [], achievements: [] };
      if (FL.Systems) {
        FL.Systems.fireTrigger(state, 'hire:' + c.role, res);
        if (c.seniority >= 4) FL.Systems.fireTrigger(state, 'hire:legend', res);
        if (has(c, 'jerk')) FL.Systems.fireTrigger(state, 'hire:jerk', res);
      }
      return res;
    }
    const rival = pick(state, state.rivals);
    rival.cap += 0.15 + c.seniority * 0.1;
    return { ok: true, accepted: false, text: `${c.name} took an offer from ${rival.name}.` };
  };

  /** Hiring practices may reveal hidden traits on new hires. */
  R.reveal = function (state, p) {
    const chance = Math.max(0, ...activePractices(state).map((x) => x.reveal || 0));
    for (const t of p.traits) if (!p.revealed.includes(t) && rnd(state) < chance) p.revealed.push(t);
  };

  R.canAppoint = (state) => state.people.roster.length >= R.MANAGER_UNLOCK;
  R.appointManager = function (state, personId, focus) {
    const P = state.people;
    const p = P.roster.find((x) => x.id === +personId);
    if (!p) return { ok: false, reason: 'No such person.' };
    if (!R.canAppoint(state)) return { ok: false, reason: `Hire at least ${R.MANAGER_UNLOCK} people first.` };
    if (P.managers.some((m) => m.id === p.id)) return { ok: false, reason: 'Already a hiring manager.' };
    if (P.managers.length >= 4) return { ok: false, reason: 'Four hiring managers is the most you can coordinate.' };
    if (state.bandwidth < R.costs.manager) return { ok: false, reason: `Needs ${R.costs.manager} bandwidth.` };
    state.bandwidth -= R.costs.manager;
    P.managers.push({ id: p.id, focus: focus || p.role });
    if (FL.Systems) FL.Systems.fireTrigger(state, 'manager:first', null);
    state.log.push({ turn: state.turn, text: `${p.name} now runs hiring for ${roleOf(focus || p.role).name}s` });
    return { ok: true };
  };
  R.removeManager = function (state, personId) {
    state.people.managers = state.people.managers.filter((m) => m.id !== +personId);
    return { ok: true };
  };

  R.setPractice = function (state, practiceId, on) {
    const P = state.people;
    if (!practiceOf(practiceId)) return { ok: false, reason: 'Unknown practice.' };
    if (!!P.practices[practiceId] === !!on) return { ok: true };
    if (state.bandwidth < R.costs.practice) return { ok: false, reason: `Needs ${R.costs.practice} bandwidth.` };
    state.bandwidth -= R.costs.practice;
    P.practices[practiceId] = !!on;
    if (on && FL.Systems) FL.Systems.fireTrigger(state, 'practice:' + practiceId, null);
    state.log.push({ turn: state.turn, text: `${on ? 'Adopted' : 'Dropped'} hiring practice: ${practiceOf(practiceId).name}` });
    return { ok: true };
  };

  R.setValues = function (state, valueIds) {
    const P = state.people;
    valueIds = [...new Set(valueIds)].filter(valueOf).slice(0, FL.MAX_VALUES);
    const same = valueIds.length === P.values.length && valueIds.every((v) => P.values.includes(v));
    if (same) return { ok: true };
    if (state.bandwidth < R.costs.values) return { ok: false, reason: `Needs ${R.costs.values} bandwidth.` };
    state.bandwidth -= R.costs.values;
    P.values = valueIds;
    state.log.push({ turn: state.turn, text: `New company values: ${valueIds.map((v) => valueOf(v).name).join(', ') || 'none'}` });
    const res = { ok: true, artifacts: [], achievements: [] };
    if (FL.Systems && valueIds.filter((v) => valueOf(v).uber).length >= 3) FL.Systems.fireTrigger(state, 'culture:superpumped', res);
    return res;
  };

  /** Per-quarter toxicity inflow from people, practices and values. */
  R.toxicityFlow = function (state) {
    const P = state.people;
    let t = -0.045;
    // People: sub-linear in headcount (one jerk in a team of ten is worse than ten jerks in a thousand).
    let people = 0;
    for (const p of P.roster) for (const tr of p.traits) people += traitOf(tr).toxicity || 0;
    t += people / Math.sqrt(Math.max(1, P.roster.length / 6));
    for (const x of activePractices(state)) t += x.toxicity || 0;
    for (const v of activeValues(state)) t += v.toxicity || 0;
    if (activeValues(state).filter((v) => v.uber).length >= 3) t += 0.01; // a full "Superpumped" culture compounds
    const mult = activePractices(state).reduce((m, x) => m * (x.toxicityMult || 1), 1);
    return t > 0 ? t * mult : t;
  };

  R.reliabilityBonus = function (state) {
    if (!state.people) return 0;
    const infra = state.people.roster.filter((p) => p.role === 'infra').reduce((a, p) => a + p.skill / 100, 0);
    return clamp(0.5 * (1 - Math.exp(-infra / 3)), 0, 0.5);
  };

  /** Team contribution to stats: diminishing returns per role, plus traits, practices, values, toxicity. */
  R.teamBonus = function (state) {
    const P = state.people;
    if (!P) return {};
    const out = {};
    const add = (k, v) => { if (v) out[k] = (out[k] || 0) + v; };
    for (const role of FL.ROLES) {
      const raw = P.roster.filter((p) => p.role === role.id).reduce((a, p) => a + Math.pow(p.skill / 100, 1.2) * (1 + p.seniority * 0.35), 0);
      const sat = 1 - Math.exp(-raw / 6);
      for (const [k, v] of Object.entries(role.stats)) add(k, v * sat);
    }
    for (const p of P.roster) for (const tr of p.traits) {
      const t = traitOf(tr);
      ['morale', 'velocity', 'quality', 'safety'].forEach((k) => add(k, t[k] || 0));
    }
    for (const x of activePractices(state)) { add('velocity', x.velocity || 0); add('morale', x.morale || 0); }
    for (const v of activeValues(state)) for (const [k, d] of Object.entries(v.fx)) add(k, d);
    add('morale', -0.3 * P.toxicity);
    add('talent', -0.1 * P.toxicity);
    for (const k of Object.keys(out)) out[k] = clamp(out[k], -0.4, 0.4);
    return out;
  };

  R.payroll = (state) => (state.people ? state.people.roster.reduce((a, p) => a + p.salary, 0) / 4 : 0);
  R.costItems = function (state) {
    if (!state.people) return [];
    const items = [{ label: 'Named hires payroll', amount: R.payroll(state), color: '#34d399' }];
    const hr = activePractices(state).reduce((a, x) => a + (x.cost || 0), 0);
    if (hr) items.push({ label: 'HR & investigations', amount: hr, color: '#10b981' });
    return items;
  };

  /** Chance a person leaves this quarter. */
  R.leaveChance = function (state, p) {
    const v = state.values;
    let c = 0.015 + (1 - v.morale) * 0.04 - (state.policies.tenders ? 0.01 : 0);
    for (const tr of p.traits) c -= (traitOf(tr).loyalty || 0) * 0.04;
    if (has(p, 'mercenary') && v.lead < 0.5) c += 0.06;
    if (has(p, 'safetyMinded') && v.safety < v.capability - 0.1) c += 0.08;
    if (has(p, 'burnout') && (state.policies.crunch || state.people.practices.hardcore)) c += 0.15;
    if (has(p, 'founder')) c += 0.02;
    c += activePractices(state).reduce((a, x) => a + (x.attrition || 0), 0);
    if (p.founder) c *= 0.3;
    return clamp(c, 0.003, 0.5);
  };

  /** Per-quarter: auto-hires via managers, culling, attrition, leaks, toxicity. */
  R.update = function (state, report) {
    const P = state.people;
    if (!P) return null;
    const res = { hired: [], left: [], leaks: [], culled: [], toxicity: 0 };
    const prs = activePractices(state);
    const blocked = prs.map((x) => x.blocks).filter(Boolean);

    // Hiring managers recruit automatically.
    for (const m of P.managers) {
      const mp = P.roster.find((x) => x.id === m.id);
      if (!mp) continue;
      let vol = 1 + Math.floor(mp.skill / 45) + prs.reduce((a, x) => a + (x.volume || 0), 0);
      let quality = (mp.skill - 50) * 0.3 + prs.reduce((a, x) => a + (x.quality || 0), 0);
      for (const tr of mp.traits) { vol += traitOf(tr).managerVolume || 0; quality += traitOf(tr).managerQuality || 0; }
      vol = Math.max(0, Math.round(vol + (rnd(state) - 0.5)));
      for (let i = 0; i < vol; i++) {
        const c = R.makeCandidate(state, { role: m.focus, quality, seniority: rnd(state) < 0.75 ? Math.floor(rnd(state) * 2) : 2 });
        if (blocked.some((b) => c.traits.includes(b))) continue;
        if (rnd(state) > R.acceptChance(state, c) + 0.15) continue;
        R.reveal(state, c);
        R.add(state, c);
        res.hired.push(c.name);
        if (has(c, 'jerk') && FL.Systems && report) FL.Systems.fireTrigger(state, 'hire:jerk', report);
        const ptq = prs.find((x) => x.id === 'payToQuit');
        if (ptq) state.cash -= ptq.costPerHire * 100;
      }
    }

    // Keeper test: let go of the weakest.
    const keeper = prs.find((x) => x.id === 'keeperTest');
    if (keeper && P.roster.length > 6) {
      const n = Math.floor(P.roster.length * keeper.cull);
      const sorted = P.roster.filter((p) => !p.founder).sort((a, b) => a.skill - b.skill).slice(0, n);
      for (const p of sorted) { res.culled.push(p.name); P.roster = P.roster.filter((x) => x !== p); }
    }

    // Attrition and leaks.
    P.roster = P.roster.filter((p) => {
      if (has(p, 'leaker') && rnd(state) < traitOf('leaker').leak) {
        res.leaks.push(p.name);
        state.shocks.push({ to: 'media', amt: -0.12, turns: 3, left: 3 });
        state.shocks.push({ to: 'legal', amt: 0.04, turns: 4, left: 4 });
      }
      if (rnd(state) < R.leaveChance(state, p)) {
        res.left.push(`${p.name} (${FL.SENIORITY[p.seniority]} ${roleOf(p.role).name})`);
        P.departed++;
        if (p.seniority >= 3) { E.bestRival(state).cap += 0.5 + p.seniority * 0.3; res.seniorLeft = true; }
        P.managers = P.managers.filter((m) => m.id !== p.id);
        return false;
      }
      return true;
    });

    P.toxicity = clamp(P.toxicity + R.toxicityFlow(state), 0, 1);
    res.toxicity = P.toxicity;
    if (FL.Systems && report) {
      if (res.seniorLeft) FL.Systems.fireTrigger(state, 'people:seniorLeft', report);
      if (P.roster.length >= 5) FL.Systems.fireTrigger(state, 'team:5', report);
      if (P.roster.length >= 25) FL.Systems.fireTrigger(state, 'team:25', report);
    }
    R.refreshFeed(state);
    if (report) report.people = res;
    return res;
  };

  /** After an independent investigation: drop the values, purge the jerks, drain toxicity. */
  R.cultureReset = function (state) {
    const P = state.people;
    P.values = P.values.filter((v) => !valueOf(v).uber);
    P.roster = P.roster.filter((p) => !(has(p, 'jerk') && p.revealed.includes('jerk')));
    P.toxicity = Math.max(0, P.toxicity - 0.35);
    P.practices.hrTeam = true;
  };

  R.summary = function (state) {
    const P = state.people;
    const byRole = {};
    for (const r of FL.ROLES) byRole[r.id] = P.roster.filter((p) => p.role === r.id).length;
    return { size: P.roster.length, byRole, toxicity: P.toxicity, managers: P.managers.length, values: P.values, practices: Object.keys(P.practices).filter((k) => P.practices[k]), payroll: R.payroll(state) };
  };

  E.registerInput('team', 'Your people, practices and culture', (state) => R.teamBonus(state));

  FL.Hiring = R;
})(globalThis.FL = globalThis.FL || {});
