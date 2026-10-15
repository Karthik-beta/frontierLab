/* bridge.js — lets the `frontier` CLI (and Claude Code) drive the browser game.
 * Active only when the page is served by tools/serve.js (http://localhost:4747).
 * Every command returns { ok, text, data }: text for humans, data for --json. */
(function (FL) {
  'use strict';
  const B = {};
  const E = FL.Engine, Sys = FL.Systems, HW = FL.Hardware, HR = FL.Hiring;
  const pct = (v) => Math.round(v * 100) + '%';
  const spct = (v) => (v >= 0 ? '+' : '') + Math.round(v * 100) + '%';
  const money = (m) => E.fmtMoney(m);
  const S = () => FL.UI.state();
  const nameOf = (id) => (E.node(id) ? E.node(id).def.name : id);

  /** Resolve a user-typed id or name fragment to a node id of the given type(s). */
  function resolve(q, types) {
    if (q == null) return null;
    const all = Object.entries(E.nodes()).filter(([, n]) => !types || types.includes(n.type));
    const ql = String(q).toLowerCase().replace(/[-_\s]/g, '');
    const norm = (x) => x.toLowerCase().replace(/[-_\s]/g, '');
    const exact = all.find(([id]) => norm(id) === ql);
    if (exact) return exact[0];
    const byName = all.filter(([, n]) => norm(n.def.name).includes(ql));
    return byName.length ? byName[0][0] : null;
  }
  const levelArg = (x, dflt) => {
    if (x == null) return dflt;
    const n = parseFloat(String(x).replace('%', ''));
    if (!Number.isFinite(n)) return dflt;
    return n > 1 ? n / 100 : n;
  };
  const fail = (text) => ({ ok: false, text });
  const needGame = () => (S() ? null : fail('No game in progress. Start one: frontier new <idealists|defectors|spinout|upstarts> [easy|normal|realistic] [Company Name]'));

  /** Compact state snapshot for `frontier status`. */
  B.snapshot = function () {
    const s = S();
    const v = s.values;
    const runway = s.finance.net >= 0 ? null : s.cash / -s.finance.net;
    const d = {
      company: s.company, quarter: E.quarterLabel(s.turn), turn: s.turn, maxTurns: E.MAX_TURNS, difficulty: s.difficulty, era: Sys.eraOf(s).name,
      cash: s.cash, net: s.finance.net, revenue: s.finance.revenue, runwayQuarters: runway, valuation: s.valuation, nextRoundIn: s.nextRound - s.turn,
      bandwidth: s.bandwidth, bandwidthIncome: E.bandwidthIncome(s), ownership: s.ownership,
      capability: s.cap, rivals: s.rivals.map((r) => ({ name: r.name, capability: r.cap })),
      stats: Object.fromEntries(FL.STATS.concat(FL.INDICATORS).map((x) => [x.id, +v[x.id].toFixed(3)])),
      stakeholders: Object.fromEntries(FL.STAKEHOLDERS.map((x) => [x.id, +s.happiness[x.id].toFixed(3)])),
      approval: E.approval(s), investorConfidence: E.investorConfidence(s),
      situations: FL.SITUATIONS.filter((x) => s.active[x.id]).map((x) => ({ id: x.id, name: x.name, good: x.good, quarters: s.active[x.id] })),
      objectives: s.objectives.map((o) => ({ text: o.text, owner: o.owner, quartersLeft: o.deadline - s.turn, progress: +Sys.objectiveProgress(s, o).toFixed(2), kind: o.kind })),
      risks: Sys.risks(s).map((r) => ({ id: r.id, name: r.name, horizon: r.horizon, meter: +r.meter.toFixed(2), warning: r.warn })),
      hiddenRisks: Sys.hiddenRiskCount(s), rumors: Sys.rumors(s).map((r) => r.name),
      policies: Object.entries(s.policies).map(([id, p]) => ({ id, name: nameOf(id), level: p.level, costPerQuarter: E.policyCost(s, id) })),
      pendingDecision: s.pendingDilemma || null, offers: s.hw ? s.hw.offers.length : 0, candidates: s.people ? s.people.feed.length : 0,
      team: s.people ? s.people.roster.length : 0, toxicity: s.people ? s.people.toxicity : 0, ended: s.ended || null,
    };
    return d;
  };

  function statusText(d) {
    const L = [];
    L.push(`${d.company} — ${d.quarter} (turn ${d.turn}/${d.maxTurns}) · ${d.difficulty} · ${d.era}`);
    if (d.ended) L.push(`GAME OVER: ${d.ended.title}. ${d.ended.text}`);
    L.push(`Cash ${money(d.cash)} · Net ${money(d.net)}/q · Runway ${d.runwayQuarters == null ? 'profitable' : d.runwayQuarters.toFixed(1) + 'q'} · Valuation ${money(d.valuation)} · Next round in ${d.nextRoundIn}q · You own ${d.ownership.toFixed(1)}%`);
    L.push(`Bandwidth ${d.bandwidth} (+${d.bandwidthIncome}/q) · Approval ${spct(d.approval)} · Investor confidence ${spct(d.investorConfidence)}`);
    L.push(`Capability ${d.capability.toFixed(1)} vs ${d.rivals.map((r) => `${r.name} ${r.capability.toFixed(1)}`).join(', ')}`);
    const st = d.stats;
    L.push('Stats: ' + ['compute', 'talent', 'morale', 'velocity', 'safety', 'quality', 'adoption', 'monetization', 'hype', 'trust', 'regHeat', 'legal', 'security', 'data', 'openness'].map((k) => `${nameOf(k)} ${Math.round(st[k] * 100)}`).join(' · '));
    L.push('Stakeholders: ' + Object.entries(d.stakeholders).map(([k, h]) => `${nameOf(k)} ${spct(h)}`).join(' · '));
    if (d.situations.length) L.push('Situations: ' + d.situations.map((x) => `${x.name}${x.good ? ' (good)' : ''} ${x.quarters}q`).join(', '));
    if (d.rumors.length) L.push('Rumors: ' + d.rumors.join(', '));
    d.objectives.forEach((o) => L.push(`Objective (${nameOf(o.owner)}, ${o.quartersLeft}q left, ${pct(o.progress)}): ${o.text}`));
    d.risks.forEach((r) => L.push(`Risk [${r.horizon}] ${r.name} ${pct(r.meter)}: ${r.warning}`));
    if (d.hiddenRisks) L.push(`${d.hiddenRisks} more risk(s) building out of sight.`);
    L.push(`Team ${d.team} · Culture toxicity ${pct(d.toxicity)} · Candidates ${d.candidates} · Compute deals ${d.offers}`);
    if (d.pendingDecision) L.push(`DECISION WAITING: run "frontier dilemma".`);
    return L.join('\n');
  }

  function inspectText(id) {
    const s = S(), n = E.node(id), d = n.def;
    const L = [`${d.name} [${id}] — ${n.type}`];
    if (d.desc) L.push(d.desc);
    if (n.type === 'policy') {
      const p = s.policies[id];
      L.push(p ? `Active at ${pct(p.level)} · costs ${money(E.policyCost(s, id))}/q` : `Not enacted · enact costs ${d.intro} bandwidth · ${money(E.policyCost(s, id, 0.5))}/q at 50%`);
      L.push(`Slider: ${d.lo} (0) → ${d.hi} (100)`);
      L.push('Effects at current/50% level:');
      const src = 0.2 + 0.8 * (p ? p.level : 0.5);
      E.effectsFrom(id).forEach((e) => L.push(`  ${nameOf(e.to)} ${e.k * E.curve(e.curve, src) >= 0 ? '+' : ''}${(e.k * E.curve(e.curve, src) * 100).toFixed(1)}${e.lag >= 4 ? ' (slow)' : ''}`));
      return L.join('\n');
    }
    const val = n.type === 'stakeholder' ? spct(s.happiness[id]) : n.type === 'situation' ? (s.active[id] ? 'ACTIVE' : 'dormant') + `, pressure ${Math.round(s.pressure[id] * 100)} (starts ${Math.round(d.on * 100)})` : id === 'capability' ? s.cap.toFixed(1) : pct(s.values[id]);
    L.push('Value: ' + val);
    const extras = Object.entries(s.extra || {}).map(([k, m]) => [k, m[id]]).filter(([, x]) => x && Math.abs(x) > 0.002);
    const live = E.effectsInto(id).map((e) => [e, E.contribution(s, e)]).filter(([, c]) => Math.abs(c) > 0.002).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    if (extras.length || live.length) L.push('Driven by:');
    extras.forEach(([k, x]) => L.push(`  ${(E.extraInputs.find((i) => i.id === k) || {}).label || k} ${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}`));
    live.forEach(([e, c]) => L.push(`  ${nameOf(e.from)} ${c >= 0 ? '+' : ''}${(c * 100).toFixed(1)}`));
    const levers = E.effectsInto(id).filter((e) => E.nodeType(e.from) === 'policy' && !s.policies[e.from]);
    if (levers.length) L.push('Policies you could enact: ' + levers.map((e) => `${nameOf(e.from)} (${e.k > 0 ? '+' : '-'})`).join(', '));
    const outs = E.effectsFrom(id).filter((e) => Math.abs(E.contribution(s, e)) > 0.002);
    if (outs.length) L.push('Affects: ' + outs.map((e) => `${nameOf(e.to)} ${E.contribution(s, e) >= 0 ? '+' : ''}${(E.contribution(s, e) * 100).toFixed(1)}`).join(', '));
    return L.join('\n');
  }

  function reportText(r) {
    if (!r) return 'No report yet.';
    const L = [`${r.label} in review`];
    if (r.headline) L.push(`${r.headline.paper}: "${r.headline.head}" — ${r.headline.sub}`);
    const f = r.finance;
    L.push(`Revenue ${money(f.revenue)} · Costs ${money(f.costs)} · Net ${money(f.net)} · Capability +${r.capGain.toFixed(1)}`);
    if (r.funding) L.push(`Funding: ${r.funding.text}`);
    if (r.bridge) L.push(r.bridge);
    (r.started || []).forEach((id) => L.push(`Situation started: ${nameOf(id)}`));
    (r.ended || []).forEach((id) => L.push(`Situation ended: ${nameOf(id)}`));
    (r.warnings || []).forEach((w) => L.push('Warning: ' + w));
    (r.pitfallWarnings || []).forEach((w) => L.push(`Warning sign (${w.horizon}): ${w.text}`));
    (r.milestones || []).forEach((m) => L.push(`Milestone: ${m.name} — ${m.blurb}`));
    if (r.era) L.push(`New era: ${r.era.name}`);
    const ob = r.objectives || { done: [], failed: [] };
    ob.done.forEach((o) => L.push(`Objective complete: ${o.text}`));
    ob.failed.forEach((o) => L.push(`Objective missed: ${o.text}`));
    (r.news || []).forEach((n) => L.push('Rival news: ' + n));
    if (r.hardware && r.hardware.newGen) L.push(`${r.hardware.newGen} chips are now shipping.`);
    if (r.people && r.people.left.length) L.push('Departures: ' + r.people.left.join(', '));
    (r.deltas || []).slice(0, 6).forEach((d) => L.push(`  ${d.name}: ${Math.round(d.from * 100)} → ${Math.round(d.to * 100)}`));
    if (r.ending) L.push(`GAME OVER — ${r.ending.title}: ${r.ending.text}`);
    if (S().pendingDilemma) L.push('A decision is waiting: run "frontier dilemma".');
    return L.join('\n');
  }

  function dilemmaText() {
    const s = S();
    const d = FL.DILEMMAS.find((x) => x.id === s.pendingDilemma);
    if (!d) return 'No decision is waiting.';
    const pit = d.pitfall && FL.PITFALLS.find((p) => p.id === d.pitfall);
    return [`${pit ? `[Pitfall · ${pit.horizon}-term] ` : ''}${d.title}`, d.text, ...d.options.map((o, i) => `  ${i + 1}. ${o.label} — ${o.desc}`), 'Choose with: frontier choose <number>'].join('\n');
  }

  const HELP = `frontier — drive the Frontier browser game from the terminal.
  status                      Company overview (add --json for machine-readable)
  report                      Last quarter's report
  inspect <id|name>           Any stat, policy, stakeholder or situation, with what drives it
  policies [category]         All policies with status and costs
  enact <policy> [0-100]      Enact a policy (default 50)
  set <policy> <0-100>        Change an active policy's slider
  cancel <policy>             Cancel a policy
  end                         End the quarter
  dilemma | choose <n>        Show / answer the pending decision
  continue                    Dismiss whatever modal is open in the browser
  objectives | risks          Objectives and the risk radar
  candidates | offer <id> | pass <id> | team
  appoint <personId> [role]   Make someone a hiring manager
  practice <id> on|off        Toggle a hiring practice
  values <id,id,...>          Set company values (max 4)
  fleet | deals | accept <dealId> | sell <clusterId>
  archive                     Your collection
  say <message>               Show an advisor note in the browser
  new <origin> [difficulty] [name]   Start a new game`;

  /** Execute one CLI command against the live game. */
  B.exec = async function (cmd, args) {
    cmd = (cmd || 'help').toLowerCase();
    args = args || [];
    const U = FL.UI;
    if (cmd === 'help') return { ok: true, text: HELP };
    if (cmd === 'new') {
      const arch = FL.ARCHETYPES.find((a) => a.id.startsWith((args[0] || 'idealists').toLowerCase()));
      if (!arch) return fail('Origins: ' + FL.ARCHETYPES.map((a) => a.id).join(', '));
      const diff = FL.DIFFICULTIES.find((x) => x.id === (args[1] || 'normal').toLowerCase()) ? args[1].toLowerCase() : 'normal';
      const name = args.slice(FL.DIFFICULTIES.some((x) => x.id === (args[1] || '').toLowerCase()) ? 2 : 1).join(' ') || 'Frontier Labs';
      U.startNew(arch.id, name, diff);
      return { ok: true, text: `Founded ${name} as ${arch.name} on ${diff}.\n\n` + statusText(B.snapshot()), data: B.snapshot() };
    }
    const g = needGame();
    if (g) return g;
    const s = S();
    switch (cmd) {
      case 'status': case 'state': { const d = B.snapshot(); return { ok: true, text: statusText(d), data: d }; }
      case 'report': return { ok: true, text: reportText(U.lastReport()), data: U.lastReport() };
      case 'inspect': {
        const id = args[0] === 'capability' ? 'capability' : resolve(args.join(' '));
        if (!id) return fail(`Nothing matches "${args.join(' ')}".`);
        return { ok: true, text: inspectText(id), data: { id } };
      }
      case 'policies': {
        const cat = args[0] && FL.CATEGORIES.find((c) => c.id.startsWith(args[0].toLowerCase()) || c.name.toLowerCase().startsWith(args[0].toLowerCase()));
        const list = FL.POLICIES.filter((p) => !cat || p.cat === cat.id).map((p) => ({ id: p.id, name: p.name, cat: p.cat, active: !!s.policies[p.id], level: s.policies[p.id] ? s.policies[p.id].level : null, intro: p.intro, costPerQuarter: E.policyCost(s, p.id, s.policies[p.id] ? s.policies[p.id].level : 0.5) }));
        return { ok: true, data: list, text: list.map((p) => `${p.active ? '[x]' : '[ ]'} ${p.id.padEnd(14)} ${p.name.padEnd(32)} ${p.active ? pct(p.level).padStart(5) : ('bw ' + p.intro).padStart(5)}  ${money(p.costPerQuarter)}/q`).join('\n') };
      }
      case 'enact': case 'set': case 'adjust': case 'cancel': {
        const id = resolve(cmd === 'cancel' ? args.join(' ') : args.slice(0, -1).join(' ') || args[0], ['policy']) || resolve(args[0], ['policy']);
        if (!id) return fail(`No policy matches "${args.join(' ')}". Try: frontier policies`);
        const lvl = cmd === 'cancel' ? null : levelArg(cmd === 'enact' && args.length === 1 ? null : args[args.length - 1], 0.5);
        if (cmd === 'enact' && s.policies[id]) return fail(`${nameOf(id)} is already active. Use: frontier set ${id} <0-100>`);
        if (cmd !== 'enact' && !s.policies[id]) return fail(`${nameOf(id)} is not active. Use: frontier enact ${id} <0-100>`);
        const r = U.policyChange(id, lvl);
        return r.ok ? { ok: true, text: `${cmd === 'cancel' ? 'Cancelled' : cmd === 'enact' ? 'Enacted' : 'Set'} ${nameOf(id)}${lvl != null ? ' at ' + pct(lvl) : ''}. Bandwidth left: ${S().bandwidth}. Net now ${money(S().finance.net)}/q.` } : fail(r.reason);
      }
      case 'end': case 'next': {
        if (s.ended) return fail('The game is over. Start a new one with: frontier new');
        if (s.pendingDilemma) return fail('Resolve the waiting decision first: frontier dilemma');
        const r = await U.endQuarter();
        return { ok: true, text: reportText(r), data: r };
      }
      case 'dilemma': case 'decision': return { ok: true, text: dilemmaText(), data: { id: s.pendingDilemma } };
      case 'choose': {
        if (!s.pendingDilemma) return fail('No decision is waiting.');
        const d = FL.DILEMMAS.find((x) => x.id === s.pendingDilemma);
        const i = parseInt(args[0], 10) - 1;
        if (!(i >= 0 && i < d.options.length)) return fail(`Choose 1-${d.options.length}.`);
        const res = U.choose(i);
        const pit = d.pitfall && FL.PITFALLS.find((p) => p.id === d.pitfall);
        return { ok: true, text: [`${d.options[i].label}: ${res.text}`, pit ? `History: ${pit.history}\nLesson: ${pit.lesson}` : '', res.ending ? `GAME OVER — ${res.ending.title}: ${res.ending.text}` : '', S().pendingDilemma ? 'Another decision is waiting: frontier dilemma' : ''].filter(Boolean).join('\n'), data: res };
      }
      case 'continue': U.dismiss(); return { ok: true, text: 'Dismissed.' };
      case 'objectives': { const d = B.snapshot().objectives; return { ok: true, data: d, text: d.map((o) => `${o.text} — ${nameOf(o.owner)}, ${o.quartersLeft}q left, ${pct(o.progress)} done${o.kind === 'hold' ? ' (checked at deadline)' : ''}`).join('\n') || 'No objectives right now.' }; }
      case 'risks': { const d = B.snapshot(); return { ok: true, data: d.risks, text: (d.risks.map((r) => `[${r.horizon}] ${r.name} ${pct(r.meter)} — ${r.warning}`).join('\n') || 'No visible warning signs.') + (d.hiddenRisks ? `\n${d.hiddenRisks} more building out of sight.` : '') + (d.rumors.length ? `\nRumors: ${d.rumors.join(', ')}` : '') }; }
      case 'candidates': {
        const list = s.people.feed.map((c) => ({ id: c.id, name: c.name, headline: HR.headline(c), skill: c.skill, salary: c.salary, traits: c.revealed, hiddenTraits: c.traits.length - c.revealed.length, acceptChance: HR.acceptChance(s, c), decidingSoon: c.expires - s.turn <= 1 }));
        return { ok: true, data: list, text: list.map((c) => `#${c.id} ${c.name} — ${c.headline} · skill ${c.skill} · asks ${c.salary < 1 ? '$' + Math.round(c.salary * 1000) + 'K' : money(c.salary)}/yr · ${pct(c.acceptChance)} likely · ${c.traits.join(', ') || 'no visible traits'}${c.hiddenTraits ? ' · ?' : ''}${c.decidingSoon ? ' · deciding soon' : ''}`).join('\n') || 'No candidates this quarter.' };
      }
      case 'offer': case 'hire': { const r = U.act('offer', args[0]); return r && r.ok === false ? fail(r.reason) : { ok: true, text: r && r.accepted ? `${r.person.name} accepted.` : (r && r.text) || 'Offer made.' }; }
      case 'pass': U.act('passCand', args[0]); return { ok: true, text: 'Passed.' };
      case 'team': {
        const list = s.people.roster.map((p) => ({ id: p.id, name: p.name, headline: HR.headline(p), skill: p.skill, traits: p.revealed, manager: !!s.people.managers.find((m) => m.id === p.id) }));
        return { ok: true, data: { roster: list, practices: s.people.practices, values: s.people.values, toxicity: s.people.toxicity }, text: list.map((p) => `#${p.id} ${p.name} — ${p.headline} · skill ${p.skill}${p.manager ? ' · HIRING MANAGER' : ''} · ${p.traits.join(', ')}`).join('\n') + `\nPractices: ${Object.keys(s.people.practices).filter((k) => s.people.practices[k]).join(', ') || 'none'}\nValues: ${s.people.values.join(', ') || 'none'}\nToxicity: ${pct(s.people.toxicity)}` };
      }
      case 'appoint': { const r = HR.appointManager(s, args[0], args[1]); U.refresh(r); return r.ok ? { ok: true, text: 'Appointed.' } : fail(r.reason); }
      case 'practice': {
        const p = FL.PRACTICES.find((x) => x.id.toLowerCase() === (args[0] || '').toLowerCase()) || FL.PRACTICES.find((x) => x.name.toLowerCase().includes((args[0] || '').toLowerCase()));
        if (!p) return fail('Practices: ' + FL.PRACTICES.map((x) => x.id).join(', '));
        const r = HR.setPractice(s, p.id, (args[1] || 'on').toLowerCase() !== 'off');
        U.refresh(r);
        return r.ok ? { ok: true, text: `${p.name}: ${s.people.practices[p.id] ? 'on' : 'off'}` } : fail(r.reason);
      }
      case 'values': {
        const ids = args.join(' ').split(',').map((x) => x.trim()).filter(Boolean).map((q) => (FL.CULTURE_VALUES.find((v) => v.id.toLowerCase() === q.toLowerCase()) || FL.CULTURE_VALUES.find((v) => v.name.toLowerCase().includes(q.toLowerCase())) || {}).id).filter(Boolean);
        if (!args.length) return { ok: true, text: FL.CULTURE_VALUES.map((v) => `${s.people.values.includes(v.id) ? '[x]' : '[ ]'} ${v.id} — ${v.name}${v.uber ? ' (Uber 2015)' : ''}`).join('\n') };
        const r = HR.setValues(s, ids);
        U.refresh(r);
        return r.ok ? { ok: true, text: 'Values: ' + s.people.values.map((v) => FL.CULTURE_VALUES.find((x) => x.id === v).name).join(', ') } : fail(r.reason);
      }
      case 'fleet': {
        const sm = HW.summary(s);
        const rows = s.hw.fleet.map((c) => `#${c.id} ${HW.genById(c.gen).name} ${c.pods.toFixed(1)} pods · age ${s.turn - c.acquired}q · health ${pct(c.health)} · book ${money(c.book)} · resale ${money(HW.salePrice(s, c))}`);
        return { ok: true, data: { summary: sm, fleet: s.hw.fleet, pipeline: s.hw.pipeline, leases: s.hw.leases }, text: [`Compute ${Math.round(sm.eff)} vs frontier need ${Math.round(sm.need)} (${pct(sm.ratio)}) · owned ${Math.round(sm.owned)}, leased ${Math.round(sm.leased)}, cloud ${Math.round(sm.cloud)}, spot ${Math.round(sm.spot)}`,
          `Power ${Math.round(sm.demand)}/${Math.round(sm.power)} MW · current gen ${sm.gen.name}`, ...rows, ...s.hw.pipeline.map((p) => `building: ${p.pods.toFixed(1)} ${HW.genById(p.gen).name} pods, online ${E.quarterLabel(p.ready)}`), ...s.hw.leases.map((l) => `lease: ${l.name} until ${E.quarterLabel(l.until)}`)].join('\n') };
      }
      case 'deals': return { ok: true, data: s.hw.offers, text: s.hw.offers.map((o) => `${o.id} — ${o.provider}: ${o.kind}. ${o.summary}. ${o.text}`).join('\n') || 'No deals on the table.' };
      case 'accept': { const r = HW.acceptOffer(s, args[0]); U.refresh(r); return r.ok ? { ok: true, text: 'Deal signed.' } : fail(r.reason); }
      case 'sell': { const r = HW.sellCluster(s, args[0]); U.refresh(r); return r.ok ? { ok: true, text: `Sold for ${money(r.price)}.` } : fail(r.reason); }
      case 'archive': { const m = U.meta(); return { ok: true, data: m, text: `${m.artifacts.length}/${FL.ARCHIVE.length} artifacts, ${m.achievements.length}/${FL.ACHIEVEMENTS.length} achievements.` }; }
      case 'say': case 'advise': U.advisor(args.join(' ')); return { ok: true, text: 'Shown in the browser.' };
      default: return fail(`Unknown command "${cmd}". Try: frontier help`);
    }
  };

  /** Connect to the local bridge via Server-Sent Events. */
  B.connect = function () {
    if (!/^https?:/.test(location.protocol) || !window.EventSource) return;
    const es = new EventSource('/bridge/events');
    const pill = document.getElementById('bridgePill');
    es.addEventListener('hello', () => { if (pill) { pill.classList.remove('hidden'); pill.textContent = 'CLI connected'; } });
    es.onerror = () => { if (pill) pill.textContent = 'CLI reconnecting…'; };
    es.addEventListener('cmd', async (ev) => {
      const { id, cmd, args } = JSON.parse(ev.data);
      let result;
      try { result = await B.exec(cmd, args); } catch (e) { result = { ok: false, text: 'Error: ' + (e && e.message || e) }; }
      if (pill) { pill.textContent = `CLI: ${cmd}`; setTimeout(() => (pill.textContent = 'CLI connected'), 1500); }
      fetch('/bridge/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, result }) });
    });
  };

  FL.Bridge = B;
})(globalThis.FL = globalThis.FL || {});
