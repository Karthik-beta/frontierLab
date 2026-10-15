/* ui.js — DOM + SVG rendering for the radial policy board, side panels and modals. */
(function (FL) {
  'use strict';
  const E = FL.Engine;
  const UI = {};
  const SAVE_KEY = 'frontierlab.save.v1';
  const META_KEY = 'frontierlab.meta.v1';
  const Sys = FL.Systems, A = FL.Audio, FX = FL.FX;

  let S = null;           // game state
  let pos = {};           // node id -> {x, y, r}
  let sectors = [];       // policy category arcs
  let selected = null;    // inspected node id (pinned highlight)
  let hovered = null;
  let preview = {};       // policy id -> slider level not yet applied
  let pickedArch = FL.ARCHETYPES[0].id;
  let pickedDiff = 'normal';
  const HW = FL.Hardware, HR = FL.Hiring;
  let lastReport = null;
  let celebrations = [];
  let busy = false;
  let endingShown = false;

  const R_POLICY = 418, R_STAT = 290, R_SH = 200, R_SIT = 128, R_CORE = 72;

  /* Text monograms for board nodes (stats show their value instead). */
  const ABBR = {
    pretrain: 'PT', reasoning: 'RL', alignment: 'AL', interp: 'IN', publish: 'PB', openWeights: 'OW', synthData: 'SD', agents: 'AG',
    cloudDeal: 'CL', datacenters: 'DC', chips: 'SI', energy: 'EN', gpuSpot: 'GP',
    comp: 'PAY', tenders: 'TO', poach: 'PO', culture: 'MC', crunch: 'CR', hiring: 'HI',
    consumerApp: 'APP', freeTier: 'FT', api: 'API', pricing: 'PR', entSales: 'ENT', coding: 'COD', ads: 'ADS', moderation: 'CF',
    redteam: 'RT', rsp: 'RSP', audits: 'AU', secProgram: 'SEC', lobbying: 'LOB', defense: 'DEF', licensing: 'LIC', scraping: 'WS',
    marketing: 'BM', ceoTour: 'CEO', nonprofit: 'NP', benchmarks: 'BX', execTeam: 'EX',
    board: 'BD', investors: 'VC', researchers: 'RS', safetyCommunity: 'SC', enterprise: 'EC', consumers: 'CU', regulators: 'RG', openSource: 'OS', media: 'MD', partner: 'BT',
    talentExodus: 'TE', gpuCrunch: 'GS', probe: 'INV', injunction: 'INJ', lawsuit: 'LAW', jailbreak: 'JB', weightsLeak: 'WL', aiPanic: 'AP',
    misuse: 'MIS', bubble: 'BUB', viral: 'VIR', frontierLeader: '#1', missionCulture: 'MDC',
  };
  const STAT_ORDER = ['velocity', 'compute', 'talent', 'morale', 'data', 'openness', 'security', 'safety', 'trust', 'regHeat', 'legal',
    'hype', 'quality', 'adoption', 'monetization', 'revGrowth', 'runway', 'lead'];

  // ── helpers ──────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pct = (v) => Math.round(v * 100) + '%';
  const spct = (v) => (v >= 0 ? '+' : '') + Math.round(v * 100) + '%';
  const money = (m) => E.fmtMoney(m);
  const nameOf = (id) => (E.node(id) ? E.node(id).def.name : id);
  const catOf = (id) => FL.CATEGORIES.find((c) => c.id === E.node(id).def.cat);
  const isGood = (id) => {
    const n = E.node(id);
    if (!n) return true;
    if (n.type === 'situation') return n.def.good;
    if (n.type === 'stat' || n.type === 'indicator') return n.def.good !== false;
    return true;
  };
  /** Red→amber→green for a 0..1 "goodness". */
  const goodColor = (t) => `hsl(${Math.round(Math.max(0, Math.min(1, t)) * 125)}, 70%, 55%)`;
  const statColor = (id, v) => goodColor(isGood(id) ? v : 1 - v);
  const happyColor = (h) => goodColor((h + 1) / 2);
  const runwayQ = () => (S.finance.net >= 0 ? Infinity : S.cash / -S.finance.net);

  /** Cross-run collection: archive cards and achievements persist between games. */
  function loadMeta() {
    try { return Object.assign({ artifacts: [], achievements: [], runs: 0 }, JSON.parse(localStorage.getItem(META_KEY) || '{}')); } catch (e) { return { artifacts: [], achievements: [], runs: 0 }; }
  }
  let meta = loadMeta();
  function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* ignore */ } }
  const artifactOf = (id) => FL.ARCHIVE.find((a) => a.id === id);
  const achievementOf = (id) => FL.ACHIEVEMENTS.find((a) => a.id === id);

  /** Toast + sound for newly unlocked artifacts/achievements, and record them in the collection. */
  function recordUnlocks(res, delay) {
    if (!res) return;
    let d = delay || 0;
    for (const id of res.artifacts || []) {
      const a = artifactOf(id);
      if (!a) continue;
      const isNew = !meta.artifacts.includes(id);
      if (isNew) meta.artifacts.push(id);
      setTimeout(() => {
        A.play('artifact', { rarity: a.rarity });
        FX.toast(`<span class="tk">${isNew ? 'New ' : ''}${a.rarity} artifact · ${a.year}</span><b>${esc(a.title)}</b>${a.quote ? `<br><i>"${esc(a.quote)}"</i>` : ''}`, a.rarity === 'common' ? 'info' : a.rarity, a.rarity === 'legendary' ? 7000 : 5000);
      }, d);
      d += 700;
    }
    for (const id of res.achievements || []) {
      const a = achievementOf(id);
      if (!a || meta.achievements.includes(id)) continue;
      meta.achievements.push(id);
      setTimeout(() => { A.play('milestone'); FX.toast(`<span class="tk">Achievement unlocked</span><b>${esc(a.name)}</b><br>${esc(a.desc)}`, 'legendary', 6000); }, d);
      d += 900;
    }
    if (meta.artifacts.length >= 25 && !meta.achievements.includes('ach-archive25')) recordUnlocks({ achievements: ['ach-archive25'] }, d);
    saveMeta();
  }

  function save() {
    try { localStorage.setItem(SAVE_KEY, E.serialize(S)); } catch (e) { /* storage unavailable */ }
  }
  function loadSave() {
    try { const j = localStorage.getItem(SAVE_KEY); return j ? E.deserialize(j) : null; } catch (e) { return null; }
  }

  function spark(arr, w, h, opts) {
    opts = opts || {};
    if (!arr || arr.length < 2) return `<svg width="${w}" height="${h}"></svg>`;
    const lo = opts.min != null ? opts.min : Math.min(...arr), hi = opts.max != null ? opts.max : Math.max(...arr);
    const span = hi - lo || 1;
    const pts = arr.map((v, i) => `${(i / (arr.length - 1)) * w},${h - 2 - ((v - lo) / span) * (h - 4)}`).join(' ');
    const zero = opts.zero != null ? `<line x1="0" x2="${w}" y1="${h - 2 - ((opts.zero - lo) / span) * (h - 4)}" y2="${h - 2 - ((opts.zero - lo) / span) * (h - 4)}" stroke="#2a3549" stroke-dasharray="3 3"/>` : '';
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${zero}<polyline points="${pts}" fill="none" stroke="${opts.color || '#7dd3fc'}" stroke-width="2"/></svg>`;
  }

  // ── layout ───────────────────────────────────────────────
  UI.layout = function () {
    pos = {};
    sectors = [];
    const gap = 1.4;
    const total = FL.POLICIES.length + gap * FL.CATEGORIES.length;
    const step = (2 * Math.PI) / total;
    let a = -Math.PI / 2 + (gap * step) / 2;
    for (const c of FL.CATEGORIES) {
      const a0 = a;
      for (const p of FL.POLICIES.filter((x) => x.cat === c.id)) {
        const ang = a + step / 2;
        pos[p.id] = { x: R_POLICY * Math.cos(ang), y: R_POLICY * Math.sin(ang), r: 21 };
        a += step;
      }
      sectors.push({ cat: c, a0, a1: a });
      a += gap * step;
    }
    STAT_ORDER.forEach((id, i) => {
      const ang = -Math.PI / 2 + ((i + 0.5) / STAT_ORDER.length) * 2 * Math.PI;
      pos[id] = { x: R_STAT * Math.cos(ang), y: R_STAT * Math.sin(ang), r: 25 };
    });
    FL.STAKEHOLDERS.forEach((s, i) => {
      const ang = -Math.PI / 2 + ((i + 0.5) / FL.STAKEHOLDERS.length) * 2 * Math.PI;
      pos[s.id] = { x: R_SH * Math.cos(ang), y: R_SH * Math.sin(ang), r: 19 };
    });
    pos.capability = { x: 0, y: 0, r: R_CORE };
    const act = S ? FL.SITUATIONS.filter((s) => S.active[s.id]) : [];
    act.forEach((s, i) => {
      const ang = -Math.PI / 2 + ((i + 0.5) / Math.max(act.length, 1)) * 2 * Math.PI;
      pos[s.id] = { x: R_SIT * Math.cos(ang), y: R_SIT * Math.sin(ang), r: 20 };
    });
  };

  function arcPath(r, a0, a1, reverse) {
    const p = (a) => `${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return reverse ? `M ${p(a1)} A ${r} ${r} 0 ${large} 0 ${p(a0)}` : `M ${p(a0)} A ${r} ${r} 0 ${large} 1 ${p(a1)}`;
  }
  function ring(r, v, color, width) {
    const C = 2 * Math.PI * r;
    return `<circle r="${r}" fill="none" stroke="#1f2a3c" stroke-width="${width}"/>` +
      `<circle r="${r}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-dasharray="${(C * Math.max(0.001, v)).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90)"/>`;
  }

  // ── board ────────────────────────────────────────────────
  UI.renderBoard = function () {
    UI.layout();
    const out = [];
    out.push(`<circle r="${R_POLICY}" fill="none" stroke="#18212f" stroke-width="56"/>`);
    out.push(`<circle r="${R_STAT}" fill="none" stroke="#151d2a" stroke-width="2"/>`);
    out.push(`<circle r="${R_SH}" fill="none" stroke="#151d2a" stroke-width="2" stroke-dasharray="2 6"/>`);
    sectors.forEach((s, i) => {
      const mid = (s.a0 + s.a1) / 2;
      const bottom = Math.sin(mid) > 0.15;
      out.push(`<path d="${arcPath(R_POLICY + 34, s.a0 + 0.01, s.a1 - 0.01)}" stroke="${s.cat.color}" stroke-width="3" fill="none" opacity="0.8"/>`);
      out.push(`<path id="sec${i}" d="${arcPath(bottom ? R_POLICY + 52 : R_POLICY + 42, s.a0, s.a1, bottom)}" fill="none"/>`);
      out.push(`<text class="cat-label" fill="${s.cat.color}"><textPath href="#sec${i}" startOffset="50%" text-anchor="middle">${esc(s.cat.name)}</textPath></text>`);
    });
    out.push('<g id="wires"></g>');

    for (const p of FL.POLICIES) {
      const q = pos[p.id], st = S.policies[p.id], c = catOf(p.id).color;
      const lvl = st ? st.level : 0;
      out.push(`<g class="node policy ${st ? '' : 'inactive'}" data-id="${p.id}" transform="translate(${q.x.toFixed(1)},${q.y.toFixed(1)})">` +
        (st ? ring(q.r + 5, lvl, c, 3) : '') +
        `<circle class="body" r="${q.r}" fill="${st ? c + '33' : '#141b28'}" stroke="${st ? c : '#38445a'}" stroke-width="${st ? 2 : 1.5}" ${st ? '' : 'stroke-dasharray="3 3"'}/>` +
        (S.turnChanges[p.id] ? `<circle r="4" cx="${q.r - 3}" cy="${-q.r + 3}" fill="#fbbf24"/>` : '') +
        `<text class="abbr">${ABBR[p.id]}</text></g>`);
    }
    for (const id of STAT_ORDER) {
      const q = pos[id], v = S.values[id], col = statColor(id, v);
      out.push(`<g class="node stat" data-id="${id}" transform="translate(${q.x.toFixed(1)},${q.y.toFixed(1)})">` +
        ring(q.r + 4, v, col, 4) +
        `<circle class="body" r="${q.r}" fill="#101724" stroke="#2a3549" stroke-width="1"/>` +
        `<text class="val" fill="${col}">${Math.round(v * 100)}</text>` +
        `<text class="lbl" y="${q.r + 18}">${esc(nameOf(id))}</text></g>`);
    }
    for (const s of FL.STAKEHOLDERS) {
      const q = pos[s.id], h = S.happiness[s.id], col = happyColor(h);
      out.push(`<g class="node stakeholder" data-id="${s.id}" transform="translate(${q.x.toFixed(1)},${q.y.toFixed(1)})">` +
        `<circle class="body" r="${q.r}" fill="${col}22" stroke="${col}" stroke-width="2"/>` +
        `<text class="abbr" style="font-size:10.5px">${ABBR[s.id]}</text>` +
        `<text class="lbl" y="${q.r + 13}">${esc(s.name.replace('The ', ''))}</text></g>`);
    }
    for (const s of FL.SITUATIONS) {
      if (!S.active[s.id]) continue;
      const q = pos[s.id], col = s.good ? '#4ade80' : '#f87171';
      out.push(`<g class="node situation" data-id="${s.id}" transform="translate(${q.x.toFixed(1)},${q.y.toFixed(1)})">` +
        `<circle class="body ${s.good ? '' : 'sit-pulse'}" r="${q.r}" fill="${s.good ? '#14361f' : '#451a1a'}" stroke="${col}" stroke-width="2"/>` +
        `<text class="abbr" style="font-size:10px;fill:${col}">${ABBR[s.id]}</text></g>`);
    }
    // core gauge: our capability vs rivals
    const ticks = S.rivals.map((r) => {
      const ang = -Math.PI / 2 + Math.min(1, r.cap / E.AGI) * 2 * Math.PI;
      const c = Math.cos(ang), sn = Math.sin(ang);
      return `<line x1="${(52 * c).toFixed(1)}" y1="${(52 * sn).toFixed(1)}" x2="${(76 * c).toFixed(1)}" y2="${(76 * sn).toFixed(1)}" stroke="${r.color}" stroke-width="3"/>`;
    }).join('');
    out.push(`<g class="node core" data-id="capability">` +
      `<circle class="body" r="${R_CORE}" fill="#0d131e" stroke="#2a3549"/>` + ring(62, S.cap / E.AGI, '#7dd3fc', 9) + ticks +
      `<text class="val" y="-8" style="font-size:30px" fill="#e6ebf3">${Math.floor(S.cap)}</text>` +
      `<text class="lbl" y="16" style="font-size:9px;letter-spacing:.15em">CAPABILITY</text>` +
      `<text class="lbl" y="29" style="font-size:9px">AGI AT 100</text></g>`);

    $('board').innerHTML = out.join('');
    applyHighlight();
  };

  function wirePath(a, b) {
    const cx = (a.x + b.x) * 0.3, cy = (a.y + b.y) * 0.3;
    const off = (p, r) => { const dx = cx - p.x, dy = cy - p.y, d = Math.hypot(dx, dy) || 1; return { x: p.x + (dx / d) * (r + 3), y: p.y + (dy / d) * (r + 3) }; };
    const s = off(a, a.r), t = off(b, b.r);
    return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${t.x.toFixed(1)} ${t.y.toFixed(1)}`;
  }

  function applyHighlight() {
    const svg = $('board');
    const id = hovered || selected;
    const wires = $('wires');
    svg.querySelectorAll('.node.lit, .node.sel').forEach((n) => n.classList.remove('lit', 'sel'));
    if (selected) { const n = svg.querySelector(`.node[data-id="${selected}"]`); if (n) n.classList.add('sel'); }
    if (!id || !pos[id]) { svg.classList.remove('focus'); wires.innerHTML = ''; return; }
    svg.classList.add('focus');
    const edges = E.effectsInto(id).concat(E.effectsFrom(id)).filter((e) => pos[e.from] && pos[e.to]);
    const lit = new Set([id]);
    wires.innerHTML = edges.map((e) => {
      lit.add(e.from); lit.add(e.to);
      const c = E.contribution(S, e);
      const live = Math.abs(c) > 0.002;
      const sign = (live ? c : e.k) * (isGood(e.to) ? 1 : -1);
      const col = sign >= 0 ? '#4ade80' : '#f87171';
      const w = live ? Math.min(7, 1.5 + Math.abs(c) * 18) : 1.5;
      return `<path class="wire" d="${wirePath(pos[e.from], pos[e.to])}" stroke="${col}" stroke-width="${w.toFixed(1)}" opacity="${live ? 0.9 : 0.35}"/>`;
    }).join('');
    lit.forEach((n) => { const el = svg.querySelector(`.node[data-id="${n}"]`); if (el) el.classList.add('lit'); });
  }

  // ── top bar & left panel ─────────────────────────────────
  UI.renderTopbar = function () {
    const rq = runwayQ();
    const net = S.finance.net;
    const toRound = S.nextRound - S.turn;
    $('topbar').innerHTML = `
      <div class="brand">FRONTIER<small>${esc(S.company)}</small></div>
      <div class="kpi"><span class="k">Quarter</span><span class="v">${E.quarterLabel(S.turn)}</span></div>
      <div class="kpi"><span class="k">Cash</span><span class="v ${S.cash < 0 ? 'neg' : ''}">${money(S.cash)}</span></div>
      <div class="kpi"><span class="k">Net / quarter</span><span class="v ${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : ''}${money(net)}</span></div>
      <div class="kpi"><span class="k">Runway</span><span class="v ${rq < toRound + 1 ? 'neg' : rq < toRound + 3 ? 'warn' : ''}">${rq === Infinity ? 'Profitable' : rq.toFixed(1) + ' q'}</span></div>
      <div class="kpi"><span class="k">Valuation</span><span class="v">${money(S.valuation)}</span></div>
      <div class="kpi"><span class="k">Next round</span><span class="v">${toRound <= 0 ? 'This quarter' : 'in ' + toRound + ' q'}</span></div>
      <div class="kpi"><span class="k">Bandwidth</span><span class="v" style="color:#7dd3fc">${S.bandwidth} <small class="muted">+${E.bandwidthIncome(S)}/q</small></span></div>
      <div class="spacer"></div>
      <span class="era-chip" title="${esc(Sys.eraOf(S).blurb)}">${esc(Sys.eraOf(S).name)}</span>
      <button class="btn" data-action="hiring">Recruiting${S.people && S.people.feed.length ? ` <b>${S.people.feed.length}</b>` : ''}</button>
      <button class="btn" data-action="compute">Compute${S.hw && S.hw.offers.length ? ` <b class="pos">${S.hw.offers.length} deal${S.hw.offers.length > 1 ? 's' : ''}</b>` : ''}</button>
      <button class="btn" data-action="archive" title="The Archive">Archive <b>${meta.artifacts.length}</b>/${FL.ARCHIVE.length}</button>
      <button class="btn" data-action="mute" title="Sound (M)">${A.isMuted() ? 'Muted' : 'Sound'}</button>
      <button class="btn" data-action="briefing">Briefing</button>
      <button class="btn" data-action="gameMenu">Menu</button>
      <button class="btn primary big" data-action="endTurn" ${S.ended ? 'disabled' : ''}>End quarter</button>`;
  };

  UI.renderLeft = function () {
    const rows = FL.STAKEHOLDERS.slice().sort((a, b) => b.weight - a.weight).map((s) => {
      const h = S.happiness[s.id];
      const w = Math.abs(h) * 50;
      return `<div class="sh-row ${selected === s.id ? 'sel' : ''}" data-action="inspect" data-arg="${s.id}" title="${esc(s.desc)}">
        <span class="name">${esc(s.name)}</span>
        <div class="cbar"><span style="background:${happyColor(h)};${h >= 0 ? 'left:50%' : 'right:50%'};width:${w}%"></span></div>
        <span class="num" style="color:${happyColor(h)}">${spct(h)}</span></div>`;
    }).join('');
    const appr = E.approval(S);
    const conf = E.investorConfidence(S);
    const racers = [{ name: 'You', cap: S.cap, color: '#7dd3fc' }].concat(S.rivals).sort((a, b) => b.cap - a.cap);
    const race = racers.map((r) => `<div class="race-row"><div class="lbl"><span>${esc(r.name)}</span><b>${Math.floor(r.cap)}</b></div>
      <div class="rbar"><span style="width:${Math.min(100, r.cap)}%;background:${r.color}"></span></div></div>`).join('');
    const board = S.happiness.board;
    const objs = S.objectives.map((o) => {
      const p = Sys.objectiveProgress(S, o), left = o.deadline - S.turn;
      const slot = FL.OBJECTIVE_SLOTS.find((x) => x.id === o.slot);
      return `<div class="obj"><div class="who"><span>${esc(slot ? slot.name : o.slot)} · ${esc(nameOf(o.owner))}</span><span class="${left <= 1 ? 'neg' : ''}">${left <= 0 ? 'due now' : left + ' q left'}</span></div>
        <div class="txt">${esc(o.text)}${o.kind === 'hold' ? ' <span class="muted">(checked at deadline)</span>' : ''}</div>
        <div class="pbar"><span class="${p >= 0.75 ? 'near' : ''}" style="width:${Math.round(p * 100)}%"></span></div></div>`;
    }).join('');
    const risks = Sys.risks(S).map((r) => `<div class="risk" title="Builds over the ${r.horizon} term">
        <div class="top"><b>${esc(r.name)}</b><span class="hz ${r.horizon}">${r.horizon}</span></div>
        <div class="w">${esc(r.warn)}</div><div class="pbar" style="margin-top:5px"><span style="width:${Math.min(100, Math.round(r.meter * 100))}%"></span></div></div>`).join('');
    const hidden = Sys.hiddenRiskCount(S);
    const rumors = Sys.rumors(S).map((r) => `<div class="risk" style="background:#10161f;border-color:#243045"><div class="top"><b>${esc(r.name)}</b><span class="hz ${r.good ? 'long' : 'short'}">brewing</span></div></div>`).join('');
    $('left').innerHTML = `
      <h3>Objectives</h3>${objs || '<p class="note">New asks arrive next quarter.</p>'}
      <h3>Risk radar</h3>${risks}${rumors}
      ${!risks && !rumors ? '<p class="note">No warning signs yet.</p>' : ''}
      ${hidden ? `<p class="note">${hidden} other risk${hidden > 1 ? 's are' : ' is'} building where you can't see ${hidden > 1 ? 'them' : 'it'} yet.</p>` : ''}
      <h3>Stakeholders</h3>${rows}
      <div class="approval"><span>Overall approval</span><b style="color:${happyColor(appr)}">${spct(appr)}</b></div>
      <div class="approval" style="border-top:0;margin-top:0;padding-top:0"><span>Investor confidence</span><b style="color:${happyColor(conf)}">${spct(conf)}</b></div>
      ${board < -0.3 ? `<div class="callout bad">The board is at ${spct(board)}. Below -45% they may fire you.</div>` : ''}
      <h3>The race to AGI</h3>${race}
      <p class="note">First to 100 wins the race. What happens next depends on your safety maturity (${pct(S.values.safety)} now).</p>`;
  };

  // ── inspector ────────────────────────────────────────────
  function effRow(target, val, extra, k) {
    const good = isGood(target);
    const v = val;
    const col = (v * (good ? 1 : -1)) >= 0 ? '#4ade80' : '#f87171';
    const w = Math.min(100, Math.abs(v) * 220);
    return `<div class="eff" data-action="inspect" data-arg="${target}">
      <span>${esc(nameOf(target))} ${extra ? `<span class="tag">${extra}</span>` : ''}</span>
      <div class="cbar"><span style="background:${col};${v >= 0 ? 'left:50%' : 'right:50%'};width:${w / 2}%"></span></div>
      <span class="num" style="color:${col}">${v >= 0 ? '+' : ''}${(v * 100).toFixed(k ? 0 : 1)}</span></div>`;
  }
  const lagTag = (lag) => (lag >= 4 ? 'slow' : lag <= 1 ? 'fast' : '');

  function driversHTML(id) {
    const ins = E.effectsInto(id);
    const live = ins.filter((e) => Math.abs(E.contribution(S, e)) > 0.002)
      .sort((a, b) => Math.abs(E.contribution(S, b)) - Math.abs(E.contribution(S, a)));
    const levers = ins.filter((e) => E.nodeType(e.from) === 'policy' && !S.policies[e.from]);
    const extras = Object.entries(S.extra || {}).map(([k, m]) => [k, m[id]]).filter(([, v]) => v && Math.abs(v) > 0.002);
    const extraRows = extras.map(([k, v]) => {
      const inp = E.extraInputs.find((x) => x.id === k);
      const col = (v * (isGood(id) ? 1 : -1)) >= 0 ? '#4ade80' : '#f87171';
      return `<div class="eff" data-action="${k === 'hardware' ? 'compute' : 'hiring'}"><span>${esc(inp ? inp.label : k)} <span class="tag">open</span></span>
        <div class="cbar"><span style="background:${col};${v >= 0 ? 'left:50%' : 'right:50%'};width:${Math.min(100, Math.abs(v) * 220) / 2}%"></span></div>
        <span class="num" style="color:${col}">${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}</span></div>`;
    }).join('');
    let h = `<h3>Driven by</h3>` + extraRows + (live.length ? live.map((e) => effRowFrom(e)).join('') : extraRows ? '' : '<p class="note">Nothing is moving this yet.</p>');
    if (levers.length) h += `<h3>Policies you could enact</h3>` + levers.map((e) => effRowFrom(e, true)).join('');
    return h;
  }
  function effRowFrom(e, potential) {
    const v = potential ? e.k * E.curve(e.curve, 0.6) : E.contribution(S, e);
    const good = isGood(e.to);
    const col = (v * (good ? 1 : -1)) >= 0 ? '#4ade80' : '#f87171';
    const w = Math.min(100, Math.abs(v) * 220);
    return `<div class="eff" data-action="inspect" data-arg="${e.from}">
      <span>${esc(nameOf(e.from))} <span class="tag">${potential ? 'not active' : lagTag(e.lag)}</span></span>
      <div class="cbar"><span style="background:${col};${v >= 0 ? 'left:50%' : 'right:50%'};width:${w / 2}%;opacity:${potential ? 0.5 : 1}"></span></div>
      <span class="num" style="color:${col}">${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}</span></div>`;
  }
  function affectsHTML(id) {
    const outs = E.effectsFrom(id).sort((a, b) => Math.abs(E.contribution(S, b)) - Math.abs(E.contribution(S, a)));
    if (!outs.length) return '';
    return `<h3>Affects</h3>` + outs.map((e) => effRow(e.to, E.contribution(S, e), lagTag(e.lag))).join('');
  }

  UI.inspect = function (id) {
    selected = id || null;
    const el = $('right');
    if (!id) { el.innerHTML = briefingHTML(); return; }
    const n = E.node(id);
    if (!n) { el.innerHTML = briefingHTML(); return; }
    if (n.type === 'policy') el.innerHTML = policyHTML(n.def);
    else if (n.type === 'stat' || n.type === 'indicator') el.innerHTML = statHTML(n.def, n.type);
    else if (n.type === 'stakeholder') el.innerHTML = stakeholderHTML(n.def);
    else el.innerHTML = situationHTML(n.def);
    const slider = $('lvl');
    if (slider) slider.addEventListener('input', () => { preview[id] = slider.value / 100; updatePolicyPreview(n.def); });
  };

  function policyHTML(p) {
    const st = S.policies[p.id];
    const cat = catOf(p.id);
    const lvl = preview[p.id] != null ? preview[p.id] : st ? st.level : 0.5;
    return `
      <div class="insp-head"><span class="chip" style="color:${cat.color}">${esc(cat.name)}</span>
        <span class="chip" style="color:${st ? '#4ade80' : '#8a97ad'}">${st ? 'Active' : 'Not enacted'}</span></div>
      <div class="insp-title">${esc(p.name)}</div>
      <div class="desc">${esc(p.desc)}</div>
      <div class="slider-box">
        <div class="row"><span>Level</span><span class="m" id="lvlPct">${pct(lvl)}</span></div>
        <input type="range" id="lvl" min="0" max="100" step="5" value="${Math.round(lvl * 100)}">
        <div class="slider-ends"><span>${esc(p.lo)}</span><span>${esc(p.hi)}</span></div>
        <div class="row" style="margin-top:8px"><span>Running cost</span><span class="m" id="lvlCost"></span></div>
        <div class="row"><span>Bandwidth</span><span class="m" id="lvlBw"></span></div>
        <div class="btn-row" id="polBtns"></div>
        <div class="err" id="polErr"></div>
      </div>
      ${S.turnChanges[p.id] ? '<p class="note">Changed this quarter. Reverting to how it was is free.</p>' : ''}
      <h3>Effects ${st ? '' : '(if enacted)'}</h3><div id="polEffects"></div>
      ${p.special ? `<p class="note">${specialNote(p)}</p>` : ''}`;
  }
  function specialNote(p) {
    const s = p.special, notes = [];
    if (s.rivalBoost) notes.push('Rivals learn from this: every lab gains capability faster.');
    if (s.rivalSlow) notes.push('Slows rival labs\' progress.');
    if (s.computeDiscount) notes.push(`After 6 quarters, cuts all compute costs by up to ${pct(s.computeDiscount)}.`);
    if (s.bandwidth) notes.push(`Adds up to +${s.bandwidth} bandwidth per quarter.`);
    if (s.valuationHaircut) notes.push(`Cuts your valuation at funding rounds by up to ${pct(s.valuationHaircut)}.`);
    if (s.pause) notes.push(`If capability gets ahead of safety (currently pauses above ${Math.round(E.pauseThreshold(S) === Infinity ? S.values.safety * 100 + 20 : E.pauseThreshold(S))}), scaling slows to a crawl.`);
    return notes.join(' ');
  }
  function updatePolicyPreview(p) {
    const st = S.policies[p.id];
    const lvl = preview[p.id] != null ? preview[p.id] : st ? st.level : 0.5;
    $('lvlPct').textContent = pct(lvl);
    $('lvlCost').textContent = money(E.policyCost(S, p.id, lvl)) + ' / q';
    const changed = !st || Math.abs(st.level - lvl) > 1e-9;
    const bw = changed ? E.policyChangeCost(S, p.id, lvl) : 0;
    $('lvlBw').textContent = bw < 0 ? `refund ${-bw}` : bw === 0 ? 'free' : `${bw} of ${S.bandwidth}`;
    let btns = '';
    if (!st) btns += `<button class="btn primary" data-action="apply" data-arg="${p.id}" ${bw > S.bandwidth || S.ended ? 'disabled' : ''}>Enact (${bw})</button>`;
    else {
      btns += `<button class="btn primary" data-action="apply" data-arg="${p.id}" ${!changed || bw > S.bandwidth || S.ended ? 'disabled' : ''}>Apply change${changed ? ` (${bw < 0 ? 'refund ' + -bw : bw})` : ''}</button>`;
      const cc = E.policyChangeCost(S, p.id, null);
      btns += `<button class="btn danger" data-action="cancel" data-arg="${p.id}" ${cc > S.bandwidth || S.ended ? 'disabled' : ''}>Cancel (${cc < 0 ? 'refund ' + -cc : cc})</button>`;
    }
    $('polBtns').innerHTML = btns;
    const src = 0.2 + 0.8 * lvl;
    $('polEffects').innerHTML = E.effectsFrom(p.id)
      .sort((a, b) => Math.abs(b.k) - Math.abs(a.k))
      .map((e) => effRow(e.to, e.k * E.curve(e.curve, src), lagTag(e.lag))).join('');
  }

  function statHTML(d, type) {
    const id = d.id, v = S.values[id];
    const big = id === 'capability' ? `${Math.floor(S.cap)}<small class="muted" style="font-size:14px"> / 100</small>` : pct(v);
    let extra = '';
    if (id === 'capability') {
      extra = `<div class="row"><span>Gain last quarter</span><span class="m">+${(lastReport && lastReport.capGain || 0).toFixed(1)}</span></div>` +
        S.rivals.map((r) => `<div class="row"><span style="color:${r.color}">${esc(r.name)}</span><span class="m">${Math.floor(r.cap)}</span></div>`).join('') +
        `<p class="note">Capability grows each quarter with Research Velocity. Quality, hype, regulatory heat and the difficulty of alignment all rise with it.</p>` +
        (S.policies.rsp ? `<p class="note">Your Responsible Scaling Policy pauses scaling above capability ${Math.round(E.pauseThreshold(S))}.</p>` : '');
    } else if (id === 'runway') {
      const rq = runwayQ();
      extra = `<div class="row"><span>Quarters of cash</span><span class="m">${rq === Infinity ? 'Profitable' : rq.toFixed(1)}</span></div>`;
    }
    const hist = id === 'capability' ? S.history._cap : S.history[id];
    return `
      <div class="insp-head"><span class="chip" style="color:#7dd3fc">${type === 'indicator' ? 'Indicator' : 'Simulation value'}</span>
        ${d.good === false ? '<span class="chip" style="color:#f87171">Lower is better</span>' : ''}</div>
      <div class="insp-title">${esc(d.name)}</div>
      <div class="big-num" style="color:${id === 'capability' ? '#e6ebf3' : statColor(id, v)}">${big}</div>
      ${spark(hist, 300, 46, id === 'capability' ? { min: 0 } : { min: 0, max: 1, color: statColor(id, v) })}
      <div class="desc">${esc(d.desc)}</div>${extra}
      ${type === 'indicator' && id !== 'capability' ? '<p class="note">Computed directly from your finances and the race.</p>' : driversHTML(id)}
      ${affectsHTML(id)}`;
  }

  function stakeholderHTML(d) {
    const h = S.happiness[d.id];
    return `
      <div class="insp-head"><span class="chip" style="color:#fbbf24">Stakeholder</span><span class="chip" style="color:#8a97ad">Influence ${d.weight}</span></div>
      <div class="insp-title">${esc(d.name)}</div>
      <div class="big-num" style="color:${happyColor(h)}">${spct(h)}</div>
      ${spark(S.history[d.id], 300, 46, { min: -1, max: 1, zero: 0, color: happyColor(h) })}
      <div class="desc">${esc(d.desc)}</div>
      ${driversHTML(d.id)}`;
  }

  function situationHTML(d) {
    const on = !!S.active[d.id], p = S.pressure[d.id];
    const col = d.good ? '#4ade80' : '#f87171';
    return `
      <div class="insp-head"><span class="chip" style="color:${col}">${d.good ? 'Opportunity' : 'Crisis'}</span>
        <span class="chip" style="color:${on ? col : '#8a97ad'}">${on ? `Active ${S.active[d.id]} q` : 'Dormant'}</span></div>
      <div class="insp-title">${esc(d.name)}</div>
      <div class="desc">${esc(d.desc)}</div>
      <div class="row"><span>Pressure</span><span class="m">${Math.round(p * 100)} (starts ${Math.round(d.on * 100)}, ends below ${Math.round(d.off * 100)})</span></div>
      ${spark(S.history[d.id], 300, 40, { zero: d.on, color: col })}
      ${driversHTML(d.id)}
      <h3>Effects while active</h3>${d.e.map(([to, k]) => effRow(to, k)).join('')}
      ${d.special && d.special.cost ? `<p class="note">Costs ${money(d.special.cost)}+ per quarter in legal fees.</p>` : ''}
      ${d.special && d.special.rivalBoost ? '<p class="note">Rivals gain capability faster while this lasts.</p>' : ''}
      ${d.id === 'injunction' ? '<p class="note">Three consecutive quarters of injunction ends the game.</p>' : ''}`;
  }

  function briefingHTML() {
    const f = S.finance;
    const maxItem = Math.max(f.revenue, ...f.items.map((i) => i.amount), 1);
    const items = f.items.slice().sort((a, b) => b.amount - a.amount).map((i) => `
      <div class="fin-row"><div>${esc(i.label)}<div class="bar" style="width:${(i.amount / maxItem) * 100}%;background:${i.color}"></div></div><span class="m">${money(i.amount)}</span></div>`).join('');
    const sits = FL.SITUATIONS.filter((s) => S.active[s.id]);
    const toRound = S.nextRound - S.turn;
    const conf = E.investorConfidence(S);
    const log = S.log.slice(-6).reverse().map((l) => `<li><span>${esc(l.text)}</span><span class="m muted">${E.quarterLabel(l.turn)}</span></li>`).join('');
    return `
      <div class="insp-title">Quarterly briefing</div>
      <p class="note">Click any circle on the board to inspect it. Hover to see what drives what.</p>
      <h3>This quarter (projected)</h3>
      <div class="fin-row"><div>Revenue<div class="bar" style="width:${(f.revenue / maxItem) * 100}%;background:#4ade80"></div></div><span class="m pos">${money(f.revenue)}</span></div>
      ${items}
      <div class="fin-row" style="border-top:1px solid var(--line);margin-top:4px;padding-top:6px"><b>Net</b><span class="m ${f.net >= 0 ? 'pos' : 'neg'}">${money(f.net)}</span></div>
      ${spark(S.history._cash, 300, 40, { color: '#7dd3fc', zero: 0 })}
      <h3>Company</h3>
      <div class="row"><span>You and staff own</span><span class="m">${(S.ownership || 100).toFixed(1)}%</span></div>
      ${S.people ? `<div class="row"><span>Named team</span><span class="m">${S.people.roster.length} people</span></div>
      <div class="row"><span>Culture toxicity</span><span class="m" style="color:${goodColor(1 - S.people.toxicity * 1.6)}">${pct(S.people.toxicity)}</span></div>` : ''}
      ${S.hw ? `<div class="row"><span>Compute vs frontier need</span><span class="m">${(HW.summary(S).ratio * 100).toFixed(0)}%</span></div>` : ''}
      <h3>Funding</h3>
      <div class="row"><span>Next round</span><span class="m">${toRound <= 0 ? 'this quarter' : `in ${toRound} quarter${toRound > 1 ? 's' : ''}`}</span></div>
      <div class="row"><span>Valuation now</span><span class="m">${money(S.valuation)}</span></div>
      <div class="row"><span>Investor confidence</span><span class="m" style="color:${happyColor(conf)}">${spct(conf)}</span></div>
      <p class="note">Rounds raise roughly 14% of valuation, more with confident investors. Below -35% confidence, the round collapses.</p>
      <h3>Situations</h3>
      ${sits.length ? sits.map((s) => `<span class="sit-tag ${s.good ? 'good' : 'bad'}" data-action="inspect" data-arg="${s.id}">${esc(s.name)}</span>`).join('') : '<p class="note">Nothing on fire. Enjoy it.</p>'}
      ${log ? `<h3>Recent decisions</h3><ul class="rep-list">${log}</ul>` : ''}`;
  }

  // ── tooltip ──────────────────────────────────────────────
  function tooltipText(id) {
    const n = E.node(id);
    const d = n.def;
    if (n.type === 'policy') {
      const st = S.policies[id];
      return `<b>${esc(d.name)}</b>${st ? `Level ${pct(st.level)} · ${money(E.policyCost(S, id))}/q` : `Not enacted · ${d.intro} bandwidth`}`;
    }
    if (n.type === 'stakeholder') return `<b>${esc(d.name)}</b>Happiness ${spct(S.happiness[id])}`;
    if (n.type === 'situation') return `<b>${esc(d.name)}</b>${esc(d.desc)}`;
    if (id === 'capability') return `<b>Frontier Capability</b>${S.cap.toFixed(1)} / 100`;
    return `<b>${esc(d.name)}</b>${pct(S.values[id])}`;
  }

  // ── modals ───────────────────────────────────────────────
  function openModal(html) { $('modalCard').classList.remove('wide'); $('modalCard').innerHTML = html; $('modal').classList.remove('hidden'); $('modalCard').scrollTop = 0; }
  function closeModal() { $('modal').classList.add('hidden'); $('modalCard').classList.remove('wide'); valueDraft = null; }

  UI.showStart = function () {
    const saved = loadSave();
    const cards = FL.ARCHETYPES.map((a) => `
      <button class="card ${a.id === pickedArch ? 'sel' : ''}" data-action="pickArch" data-arg="${a.id}">
        <span class="diff ${a.difficulty}">${a.difficulty}</span><h4>${esc(a.name)}</h4>
        <p>${esc(a.blurb)}</p>
        <div class="meta">Cash ${money(a.cash)} · Bandwidth ${a.bandwidth} · Capability ${a.cap}</div>
        <div class="meta">Starts with: ${Object.keys(a.policies).map(nameOf).join(', ')}</div>
      </button>`).join('');
    openModal(`
      <h1>FRONTIER</h1>
      <h2>Found a frontier AI lab. Race to AGI. Try not to end the world, go broke, or get fired by your own board.</h2>
      ${saved && !saved.ended ? `<div class="callout"><b>${esc(saved.company)}</b> — ${E.quarterLabel(saved.turn)}, capability ${Math.floor(saved.cap)}.
        <div class="btn-row"><button class="btn primary" data-action="continue">Continue saved game</button></div></div>` : ''}
      <h3>Name your lab</h3>
      <input class="name-input" id="coName" value="${esc((saved && saved.company) || 'Frontier Labs')}" maxlength="32">
      <h3>Choose your origin story</h3>
      <div class="cards">${cards}</div>
      <h3>Difficulty</h3>
      <div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">${FL.DIFFICULTIES.map((d) => `
        <button class="card ${d.id === pickedDiff ? 'sel' : ''}" data-action="pickDiff" data-arg="${d.id}"><h4>${esc(d.name)}</h4><p>${esc(d.blurb)}</p></button>`).join('')}</div>
      <div class="btn-row"><button class="btn primary big" data-action="found">Found the company</button>
        <button class="btn big" data-action="help">How to play</button></div>`);
  };

  function helpHTML() {
    return `<h1>How to play</h1>
      <div class="howto">
        <p><b>Each turn is a quarter.</b> You have ten years (40 quarters). Make changes, then press <i>End quarter</i>.</p>
        <p><b>Policies</b> are the circles on the outer ring, grouped by category. Click one to enact it, set its slider, or cancel it. Dashed circles are not enacted.</p>
        <p><b>Bandwidth</b> is your leadership attention: enacting, adjusting and cancelling policies cost it. You earn more each quarter, more if stakeholders approve of you. Changes made this quarter can be reverted for free.</p>
        <p><b>Money.</b> Most policies cost cash every quarter. Revenue comes from adoption times monetization. Funding rounds happen every six quarters; the amount depends on valuation and investor confidence. Run out of cash and you are done.</p>
        <p><b>The board</b> (middle ring) is a living simulation. Hover any circle to see what drives it (wires in) and what it drives (wires out). Green helps, red hurts. Effects take quarters to fully kick in.</p>
        <p><b>Stakeholders</b> (inner ring and left panel) are your voter groups. Unhappy investors kill funding rounds. An unhappy board fires you.</p>
        <p><b>Situations</b> appear in the middle when pressure builds: lawsuits, scandals, talent exodus, injunctions — or viral moments and frontier leadership.</p>
        <p><b>Winning.</b> Reach capability 100 before your rivals. If safety maturity is high enough when you get there, you built aligned AGI. If not... Alignment gets harder as capability rises.</p>
      </div>
      <div class="btn-row"><button class="btn primary" data-action="${S ? 'closeModal' : 'start'}">Got it</button></div>`;
  }

  UI.showReport = function (r) {
    lastReport = r;
    const f = r.finance;
    const deltas = r.deltas.slice(0, 8).map((d) => {
      const better = (d.to - d.from) * (d.good === false ? -1 : 1) > 0;
      return `<li><span>${esc(d.name)}</span><span class="m ${better ? 'pos' : 'neg'}">${Math.round(d.from * 100)} → ${Math.round(d.to * 100)}</span></li>`;
    }).join('');
    const sitLine = (ids, verb) => ids.map((id) => {
      const st = E.node(id).def;
      const cls = (verb === 'started') === st.good ? 'good' : 'bad';
      return `<div class="callout ${cls}"><b>${esc(st.name)}</b> ${verb}. ${verb === 'started' ? esc(st.desc) : ''}</div>`;
    }).join('');
    const h = r.headline || { paper: 'The Ledger', head: `${r.label} in review`, sub: '' };
    const epi = r.epigraph && artifactOf(r.epigraph);
    const ob = r.objectives || { done: [], failed: [], dealt: [] };
    const obLines = ob.done.map((o) => `<div class="callout good"><b>Objective complete:</b> ${esc(o.text)} <span class="muted">(+4 bandwidth, ${esc(nameOf(o.owner))} pleased)</span></div>`).join('') +
      ob.failed.map((o) => `<div class="callout bad"><b>Objective missed:</b> ${esc(o.text)} <span class="muted">(${esc(nameOf(o.owner))} disappointed)</span></div>`).join('');
    const warnLines = (r.pitfallWarnings || []).map((w) => `<div class="callout warn"><b>Warning sign (${w.horizon}-term):</b> ${esc(w.text)}</div>`).join('');
    const rumorLines = (r.rumors || []).map((x) => `<div class="callout"><b>Rumor:</b> ${x.good ? 'Momentum is building toward' : 'Insiders whisper about'} ${esc(x.name)}.</div>`).join('');
    openModal(`
      <div class="reveal">
      <div class="paper ${h.tabloid ? 'tabloid' : ''}"><div class="mast"><span>${esc(r.label)}</span><b>${esc(h.paper)}</b><span>Late edition</span></div>
        <h1>${esc(h.head)}</h1><p>${esc(h.sub)}</p></div>
      ${r.funding ? `<div class="callout ${r.funding.ok ? 'good' : 'bad'}"><b>${r.funding.name}.</b> ${esc(r.funding.text)}</div>` : ''}
      ${r.bridge ? `<div class="callout warn">${esc(r.bridge)}</div>` : ''}
      ${sitLine(r.started, 'started')}${sitLine(r.ended, 'ended')}
      ${r.warnings.map((w) => `<div class="callout bad">${esc(w)}</div>`).join('')}
      ${warnLines}${rumorLines}${obLines}${hwLines(r)}${peopleLines(r)}
      <div class="rep-grid">
        <div>
          <h3>Finances</h3>
          <ul class="rep-list">
            <li><span>Revenue</span><span class="m pos">${money(f.revenue)}</span></li>
            <li><span>Costs</span><span class="m neg">${money(f.costs)}</span></li>
            <li><span>Net</span><span class="m ${f.net >= 0 ? 'pos' : 'neg'}">${money(f.net)}</span></li>
            <li><span>Cash now</span><span class="m" id="repCash">${money(S.cash - (r.funding ? r.funding.raised : 0))}</span></li>
            <li><span>Valuation</span><span class="m">${money(S.valuation)}</span></li>
          </ul>
          <h3>The race</h3>
          <ul class="rep-list">
            <li><span>Your capability</span><span class="m"><span id="repCap">${Math.floor(S.cap - r.capGain)}</span> <span class="pos">(+${r.capGain.toFixed(1)})</span></span></li>
            ${S.rivals.map((x) => `<li><span>${esc(x.name)}</span><span class="m">${Math.floor(x.cap)}</span></li>`).join('')}
          </ul>
          ${r.paused ? '<div class="callout warn">Your Responsible Scaling Policy kicked in: capability has outrun safety, so scaling slowed to a crawl.</div>' : ''}
          ${r.news.map((n) => `<p class="note">${esc(n)}</p>`).join('')}
        </div>
        <div><h3>Biggest changes</h3><ul class="rep-list">${deltas || '<li class="muted">A quiet quarter.</li>'}</ul></div>
      </div>
      ${epi ? `<div class="quote"><q>${esc(epi.quote)}</q><span class="by">${esc(epi.speaker || '')}${epi.speaker ? ', ' : ''}${epi.year}${epi.paraphrase ? ' (paraphrase)' : ''}</span></div>` : ''}
      <div class="btn-row" style="justify-content:flex-end"><button class="btn primary big" data-action="afterReport">Continue</button></div>
      </div>`);
    $('modalCard').querySelectorAll('.reveal > *').forEach((el, i) => (el.style.animationDelay = i * 140 + 'ms'));
    FX.countUp($('repCash'), S.cash - (r.funding ? r.funding.raised : 0), S.cash, 900, money);
    FX.countUp($('repCap'), Math.floor(S.cap - r.capGain), Math.floor(S.cap), 700);
    const badStart = r.started.some((id) => !E.node(id).def.good);
    if (badStart || (r.funding && !r.funding.ok)) { A.play('crisis'); FX.shake($('modalCard'), 5, 320); }
    else if (r.funding && r.funding.ok) setTimeout(() => A.play('cash'), 400);
    else if ((r.pitfallWarnings || []).length || r.warnings.length) A.play('warn');
    else if (ob.done.length) A.play('chime');
    recordUnlocks(r, 900);
  };

  /** Celebration cards for model generations, valuation tiers and new acts, shown one by one. */
  function showCelebration(c) {
    A.play('milestone');
    FX.flash('#fbbf24');
    openModal(`<div class="ms-card">
      <div class="kicker">${c.kicker}</div><div class="big">${esc(c.title)}</div><p>${esc(c.text)}</p>
      <div class="btn-row" style="justify-content:center"><button class="btn primary big" data-action="afterReport">Continue</button></div></div>`);
    const r = $('modalCard').getBoundingClientRect();
    FX.burst(r.left + r.width / 2, r.top + 90);
  }

  UI.showDilemma = function () {
    const d = FL.DILEMMAS.find((x) => x.id === S.pendingDilemma);
    if (!d) { S.pendingDilemma = null; return closeModal(); }
    const pit = d.pitfall && FL.PITFALLS.find((p) => p.id === d.pitfall);
    A.play(pit ? 'crisis' : 'decision');
    if (pit) { FX.shake($('modalCard'), 6, 380); FX.flash('#ef4444'); }
    openModal(`
      <h2>${pit ? `Pitfall · ${pit.horizon}-term · ${esc(pit.name)}` : 'Decision required'} · ${E.quarterLabel(S.turn)}</h2>
      <h1>${esc(d.title)}</h1>
      <p class="lede">${esc(d.text)}</p>
      <div class="cards">${d.options.map((o, i) => `
        <button class="card" data-action="choose" data-arg="${i}"><h4>${esc(o.label)}</h4><p>${esc(o.desc)}</p>
        ${o.cash ? `<div class="meta ${o.cash > 0 ? 'pos' : 'neg'}">${o.cash > 0 ? '+' : ''}${money(o.cash)}</div>` : ''}</button>`).join('')}
      </div>`);
  };

  UI.showEnding = function (end) {
    if (!endingShown) { endingShown = true; A.play(end.win ? 'win' : 'lose'); if (end.win) setTimeout(() => FX.burst(window.innerWidth / 2, window.innerHeight / 3, null, 90), 200); }
    const H = S.history, n = H._cap.length;
    const w = 640, h = 200;
    const line = (arr, col, width) => `<polyline fill="none" stroke="${col}" stroke-width="${width}" points="${arr.map((v, i) => `${(i / Math.max(1, n - 1)) * w},${h - (Math.min(v, 105) / 105) * h}`).join(' ')}"/>`;
    const chart = `<svg viewBox="0 0 ${w} ${h}" width="100%" style="background:#0d131e;border-radius:8px;margin:8px 0">
      <line x1="0" x2="${w}" y1="${h - (100 / 105) * h}" y2="${h - (100 / 105) * h}" stroke="#fbbf24" stroke-dasharray="4 4"/>
      ${S.rivals.map((r) => line(H['_rival_' + r.id], r.color, 1.5)).join('')}${line(H._cap, '#7dd3fc', 3)}
      ${line(H.safety.map((v) => v * 100), '#f472b6', 2)}</svg>
      <p class="note"><span style="color:#7dd3fc">You</span> · ${S.rivals.map((r) => `<span style="color:${r.color}">${esc(r.name)}</span>`).join(' · ')} · <span style="color:#f472b6">Your safety maturity</span> · <span style="color:#fbbf24">AGI</span></p>`;
    openModal(`
      <h2>${esc(S.company)} · ${E.quarterLabel(Math.min(S.turn, E.MAX_TURNS))}</h2>
      <h1 class="${end.win ? 'pos' : 'neg'}">${esc(end.title)}</h1>
      <p class="lede">${esc(end.text)}</p>
      ${chart}
      <ul class="rep-list">
        <li><span>Score</span><span class="m">${E.score(S)}</span></li>
        <li><span>Capability</span><span class="m">${Math.floor(S.cap)}</span></li>
        <li><span>Safety maturity</span><span class="m">${pct(S.values.safety)}</span></li>
        <li><span>Final valuation</span><span class="m">${money(S.valuation)}</span></li>
        <li><span>Total raised</span><span class="m">${money(S.rounds.reduce((a, b) => a + b.raised, 0))} over ${S.rounds.length} rounds</span></li>
      </ul>
      <div class="btn-row"><button class="btn primary big" data-action="menu">New game</button><button class="btn big" data-action="closeModal">Look at the board</button></div>`);
  };

  // ── flow ─────────────────────────────────────────────────
  UI.renderAll = function () {
    renderTicker();
    UI.renderTopbar();
    UI.renderLeft();
    UI.renderBoard();
    UI.inspect(selected);
    if (selected && E.nodeType(selected) === 'policy') updatePolicyPreview(E.node(selected).def);
  };

  function startGame(state) {
    S = state;
    selected = null; hovered = null; preview = {}; lastReport = null; endingShown = false; celebrations = [];
    closeModal();
    UI.renderAll();
    save();
    if (S.unseen) { recordUnlocks(S.unseen, 400); S.unseen = null; save(); }
    A.unlock();
    A.setTension(S.tension || 0);
    if (S.ended) UI.showEnding(S.ended);
    else if (S.pendingDilemma) UI.showDilemma();
  }

  const actions = {
    inspect: (id) => { UI.inspect(id); UI.renderLeft(); applyHighlight(); if (E.nodeType(id) === 'policy') updatePolicyPreview(E.node(id).def); },
    briefing: () => { selected = null; UI.renderAll(); },
    help: () => openModal(helpHTML()),
    start: () => UI.showStart(),
    menu: () => UI.showStart(),
    closeModal: () => closeModal(),
    pickArch: (id) => { pickedArch = id; document.querySelectorAll('.card[data-action=pickArch]').forEach((c) => c.classList.toggle('sel', c.dataset.arg === id)); },
    found: () => startGame(E.newGame(pickedArch, ($('coName').value || 'Frontier Labs').trim(), undefined, pickedDiff)),
    pickDiff: (id) => { pickedDiff = id; document.querySelectorAll('.card[data-action=pickDiff]').forEach((c) => c.classList.toggle('sel', c.dataset.arg === id)); },
    continue: () => startGame(loadSave()),
    apply: (id) => {
      const st = S.policies[id];
      const lvl = preview[id] != null ? preview[id] : st ? st.level : 0.5;
      const r = E.changePolicy(S, id, lvl);
      if (!r.ok) { $('polErr').textContent = r.reason; return; }
      delete preview[id];
      S.finance = E.computeFinances(S);
      S.log.push({ turn: S.turn, text: `${st ? 'Adjusted' : 'Enacted'} ${nameOf(id)} (${pct(lvl)})` });
      A.play(st ? 'click' : 'enact');
      save(); UI.renderAll();
    },
    cancel: (id) => {
      const r = E.cancelPolicy(S, id);
      if (!r.ok) { $('polErr').textContent = r.reason; return; }
      delete preview[id];
      S.finance = E.computeFinances(S);
      S.log.push({ turn: S.turn, text: `Cancelled ${nameOf(id)}` });
      A.play('cancel');
      save(); UI.renderAll();
    },
    endTurn: () => {
      if (!S || S.ended || busy) return;
      busy = true;
      preview = {};
      A.play('endTurn');
      $('boardWrap').classList.add('thinking');
      const beforeVals = { ...S.values };
      setTimeout(() => {
        const r = E.endTurn(S);
        meta.runs += r && r.turn === 1 ? 1 : 0;
        save();
        $('boardWrap').classList.remove('thinking');
        UI.renderAll();
        floatDeltas(beforeVals);
        A.setTension(S.tension || 0);
        celebrations = [];
        (r.milestones || []).forEach((m) => celebrations.push(m.kind === 'model'
          ? { kicker: `New model · capability ${m.at}`, title: `${S.company} ${m.name}`, text: m.blurb }
          : { kicker: 'Valuation milestone', title: m.name, text: m.blurb }));
        if (r.era) celebrations.push({ kicker: 'A new era begins', title: r.era.name, text: r.era.blurb });
        busy = false;
        UI.showReport(r);
      }, 420);
    },
    afterReport: () => {
      if (S.unseen) { recordUnlocks(S.unseen); S.unseen = null; }
      if (celebrations.length) return showCelebration(celebrations.shift());
      if (S.ended) UI.showEnding(S.ended);
      else if (S.pendingDilemma) UI.showDilemma();
      else closeModal();
    },
    archive: (tab) => showArchive(tab || 'all'),
    hiring: () => showHiring(),
    compute: () => showCompute(),
    offer: (id) => { const r = HR.makeOffer(S, id); afterAction(r, r.ok ? (r.accepted ? `<b>${esc(r.person.name)}</b> accepted your offer.` : esc(r.text)) : null); showHiring(r.ok ? null : r.reason); if (r.ok) A.play(r.accepted ? 'chime' : 'cancel'); },
    passCand: (id) => { S.people.feed = S.people.feed.filter((c) => c.id !== +id); save(); showHiring(); },
    appoint: (id) => { const sel = document.getElementById('focus-' + id); const r = HR.appointManager(S, id, sel ? sel.value : null); afterAction(r); showHiring(r.ok ? null : r.reason); },
    unappoint: (id) => { HR.removeManager(S, id); afterAction({ ok: true }); showHiring(); },
    practice: (id) => { const r = HR.setPractice(S, id, !S.people.practices[id]); afterAction(r); showHiring(r.ok ? null : r.reason); },
    toggleValue: (id) => { valueDraft = valueDraft.includes(id) ? valueDraft.filter((x) => x !== id) : valueDraft.concat(id).slice(-FL.MAX_VALUES); showHiring(); },
    saveValues: () => { const r = HR.setValues(S, valueDraft); afterAction(r); showHiring(r.ok ? null : r.reason); },
    deal: (id) => { const r = HW.acceptOffer(S, id); afterAction(r, r.ok ? 'Deal signed.' : null); showCompute(r.ok ? null : r.reason); if (r.ok) A.play('cash'); },
    sell: (id) => { const r = HW.sellCluster(S, id); afterAction(r, r.ok ? `Sold for ${money(r.price)}.` : null); showCompute(r.ok ? null : r.reason); },
    gameMenu: () => openModal(`<h1>Menu</h1><div class="btn-row">
      <button class="btn big" data-action="help">How to play</button>
      <button class="btn big" data-action="archive">The Archive</button>
      <button class="btn big danger" data-action="menu">New game</button>
      <button class="btn big" data-action="closeModal">Back to the board</button></div>`),
    mute: () => { A.setMuted(!A.isMuted()); UI.renderTopbar(); },
    choose: (i) => {
      const d = FL.DILEMMAS.find((x) => x.id === S.pendingDilemma);
      const res = E.resolveDilemma(S, +i);
      S.finance = E.computeFinances(S);
      S.valuation = E.valuation(S);
      save();
      UI.renderAll();
      A.play('click');
      const pit = d && d.pitfall && FL.PITFALLS.find((p) => p.id === d.pitfall);
      openModal(`<h2>${esc(d ? d.title : '')}</h2><h1>${esc(d ? d.options[+i].label : '')}</h1><p class="lede">${esc(res.text)}</p>
        ${pit ? `<div class="history"><h4>History rhymes · ${esc(pit.name)}</h4><p>${esc(pit.history)}</p><p class="lesson">${esc(pit.lesson)}</p></div>` : ''}
        <div class="btn-row" style="justify-content:flex-end"><button class="btn primary big" data-action="${res.ending ? 'showEnd' : S.pendingDilemma ? 'nextDilemma' : 'closeModal'}">Continue</button></div>`);
      recordUnlocks(res, 300);
    },
    showEnd: () => UI.showEnding(S.ended),
    nextDilemma: () => UI.showDilemma(),
    archiveTab: (tab) => showArchive(tab),
  };

  let valueDraft = null;

  /** Common post-action bookkeeping: recompute finances, save, refresh, surface unlocks. */
  function afterAction(res, toast) {
    S.finance = E.computeFinances(S);
    E.updateIndicators(S);
    S.valuation = E.valuation(S);
    save();
    if (res && res.ok) { recordUnlocks(res); if (S.unseen) { recordUnlocks(S.unseen); S.unseen = null; } if (toast) FX.toast(toast, 'good'); }
    UI.renderAll();
  }

  const pay = (m) => (m < 1 ? '$' + Math.round(m * 1000) + 'K' : money(m));
  function initials(name) { return name.split(' ').map((w) => w[0]).join('').slice(0, 2); }
  function avatarColor(name) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h},45%,35%)`; }
  function traitTags(p) {
    return p.revealed.map((t) => { const d = FL.TRAITS.find((x) => x.id === t); return `<span class="ttag ${d.good ? 'good' : 'bad'}" title="${esc(d.desc)}">${esc(d.name)}</span>`; }).join('') +
      (p.traits.length > p.revealed.length ? '<span class="ttag unk" title="Reference checks or Bar Raiser loops can reveal hidden traits">?</span>' : '');
  }

  function showHiring(err) {
    const P = S.people, R = HR;
    if (!valueDraft) valueDraft = P.values.slice();
    const roleName = (id) => FL.ROLES.find((r) => r.id === id).name;
    const feed = P.feed.map((c) => `
      <div class="li-card">
        <div class="li-top"><div class="avatar" style="background:${avatarColor(c.name)}">${initials(c.name)}</div>
          <div><b>${esc(c.name)}</b><div class="li-head">${esc(R.headline(c))}</div><div class="li-meta">${c.connections}+ connections · ${c.expires - S.turn <= 1 ? '<span class="neg">deciding soon</span>' : 'open to work'}</div></div></div>
        <div class="li-skill"><span>Skill</span><div class="pbar"><span style="width:${c.skill}%"></span></div><b>${c.skill}</b></div>
        <div class="tag-line">${traitTags(c)}</div>
        <div class="row"><span>Asking</span><span class="m">${pay(c.salary)}/yr</span></div>
        <div class="row"><span>Likely to accept</span><span class="m">${Math.round(R.acceptChance(S, c) * 100)}%</span></div>
        <div class="btn-row"><button class="btn primary" data-action="offer" data-arg="${c.id}" ${S.bandwidth < R.costs.offer || S.ended ? 'disabled' : ''}>Make offer (${R.costs.offer})</button>
          <button class="btn" data-action="passCand" data-arg="${c.id}">Pass</button></div>
      </div>`).join('');
    const mgrIds = P.managers.map((m) => m.id);
    const roster = P.roster.slice().sort((a, b) => b.seniority - a.seniority || b.skill - a.skill).map((p) => {
      const m = P.managers.find((x) => x.id === p.id);
      return `<div class="li-row">
        <div class="avatar sm" style="background:${avatarColor(p.name)}">${initials(p.name)}</div>
        <div style="flex:1;min-width:0"><b>${esc(p.name)}</b>${p.founder ? ' <span class="muted">co-founder</span>' : ''}<div class="li-head">${esc(FL.SENIORITY[p.seniority])} ${esc(roleName(p.role))} · skill ${p.skill}</div><div class="tag-line">${traitTags(p)}</div></div>
        <div class="li-ctl">${m ? `<button class="btn" data-action="unappoint" data-arg="${p.id}" title="Stop hiring">Hiring ${esc(roleName(m.focus))}s ✕</button>`
            : R.canAppoint(S) && p.seniority >= 1 ? `<select id="focus-${p.id}" class="sel">${FL.ROLES.map((r) => `<option value="${r.id}" ${r.id === p.role ? 'selected' : ''}>${esc(r.name)}s</option>`).join('')}</select>
              <button class="btn" data-action="appoint" data-arg="${p.id}" ${S.bandwidth < R.costs.manager ? 'disabled' : ''}>Make hiring manager (${R.costs.manager})</button>` : ''}</div>
      </div>`;
    }).join('');
    const practices = FL.PRACTICES.map((x) => `<button class="pill ${P.practices[x.id] ? 'on' : ''}" data-action="practice" data-arg="${x.id}" title="${esc(x.desc)} (Inspired by ${esc(x.inspired)})">${esc(x.name)}</button>`).join('');
    const values = FL.CULTURE_VALUES.map((x) => `<button class="pill ${valueDraft.includes(x.id) ? 'on' : ''} ${x.uber ? 'uber' : ''}" data-action="toggleValue" data-arg="${x.id}"
      title="${esc(Object.entries(x.fx).map(([k, d]) => `${nameOf(k)} ${d > 0 ? '+' : ''}${Math.round(d * 100)}`).join(', '))}${x.toxicity > 0 ? ' · adds toxicity' : x.toxicity < 0 ? ' · reduces toxicity' : ''}${x.note ? ' · ' + esc(x.note) : ''}">${esc(x.name)}</button>`).join('');
    const changed = valueDraft.length !== P.values.length || valueDraft.some((v) => !P.values.includes(v));
    const tox = P.toxicity, flow = R.toxicityFlow(S);
    openModal(`
      <div class="li-wrap">
        <div class="li-brand">Linked<b>Out</b> <span class="muted">Recruiter</span></div>
        <h2>${P.roster.length} people · ${P.managers.length} hiring manager${P.managers.length === 1 ? '' : 's'} · ${S.bandwidth} bandwidth · payroll ${money(R.payroll(S))}/q</h2>
        ${err ? `<div class="callout bad">${esc(err)}</div>` : ''}
        <div class="li-grid">
          <section><h3>Candidates</h3>${feed || '<p class="note">No one in your feed this quarter.</p>'}
            <p class="note">Early on you recruit personally: each offer costs bandwidth. Hidden red flags only show up with reference checks or Bar Raiser loops.</p></section>
          <section><h3>Your team</h3>${roster}
            ${!R.canAppoint(S) ? `<p class="note">Hire ${R.MANAGER_UNLOCK - P.roster.length} more to appoint hiring managers, who recruit automatically every quarter.</p>` : '<p class="note">Hiring managers recruit every quarter. Mentors hire better people; politicians hire more people, and their friends.</p>'}</section>
          <section>
            <h3>Hiring practices</h3><div class="pills">${practices}</div>
            <p class="note">Each change costs ${R.costs.practice} bandwidth. Hover for details.</p>
            <h3>Company values (pick up to ${FL.MAX_VALUES})</h3><div class="pills">${values}</div>
            <p class="note">Outlined values are Uber's original 14 (2015). They make you faster, and three or more compound into a toxic culture.</p>
            <div class="btn-row"><button class="btn primary" data-action="saveValues" ${!changed || S.bandwidth < R.costs.values ? 'disabled' : ''}>Adopt values (${R.costs.values})</button></div>
            <h3>Culture toxicity</h3>
            <div class="pbar" style="height:8px"><span style="width:${Math.round(tox * 100)}%;background:${goodColor(1 - tox * 1.6)}"></span></div>
            <p class="note">${pct(tox)} and ${flow > 0 ? `rising about ${Math.round(flow * 100)} points a quarter` : 'falling'}. High toxicity drags morale and retention, and eventually someone writes the blog post.</p>
          </section>
        </div>
        <div class="btn-row" style="justify-content:flex-end"><button class="btn primary" data-action="closeModal">Done</button></div>
      </div>`);
    $('modalCard').classList.add('wide');
  }

  function showCompute(err) {
    const sm = HW.summary(S), hw = S.hw;
    const bar = (label, v, col) => `<div class="fin-row"><div>${esc(label)}<div class="bar" style="width:${Math.min(100, (v / Math.max(sm.need, sm.eff)) * 100)}%;background:${col}"></div></div><span class="m">${Math.round(v)}</span></div>`;
    const fleet = hw.fleet.map((c) => {
      const g = HW.genById(c.gen), age = S.turn - c.acquired;
      return `<tr><td>${esc(g.name)}</td><td class="m">${c.pods.toFixed(1)}</td><td class="m">${age}q</td><td class="m">${Math.round(c.health * 100)}%</td>
        <td class="m">${(HW.failRate(S, age) * 100).toFixed(1)}%</td><td class="m">${money(c.book)}</td><td class="m">${money(HW.salePrice(S, c))}</td>
        <td><button class="btn" data-action="sell" data-arg="${c.id}">Sell</button></td></tr>`;
    }).join('');
    const pipe = hw.pipeline.map((p) => `<li><span>${p.pods.toFixed(1)} ${esc(HW.genById(p.gen).name)} pods${p.commitment ? ' (purchase commitment)' : ''}</span><span class="m">online ${E.quarterLabel(Math.max(p.ready, S.turn + (p.payLeft || 0)))}</span></li>`).join('');
    const leases = hw.leases.map((l) => `<li><span>${esc(l.name)}</span><span class="m">${Math.round(l.perf)} perf · ${l.perQuarter ? money(l.perQuarter) + '/q · ' : ''}until ${E.quarterLabel(l.until)}</span></li>`).join('');
    const offers = hw.offers.map((o) => `<div class="card" style="cursor:default"><span class="diff Normal">${esc(o.kind)}</span><h4>${esc(o.provider)}</h4><p>${esc(o.text)}</p>
      <div class="meta">${esc(o.summary)}</div><div class="meta">Offer expires after ${E.quarterLabel(o.expires - 1)}</div>
      <div class="btn-row"><button class="btn primary" data-action="deal" data-arg="${o.id}" ${S.bandwidth < o.bandwidth || S.ended ? 'disabled' : ''}>Sign (${o.bandwidth} bandwidth)</button></div></div>`).join('');
    const next = FL.CHIP_GENS.find((g) => g.turn > S.turn);
    openModal(`
      <h1>Compute</h1>
      <h2>Current generation: ${esc(sm.gen.name)} (${sm.gen.perf}x, ${money(sm.gen.price * HW.priceMult(S))} per pod of 1,000 chips)${next ? ` · ${esc(next.name)} (${next.perf}x) ships ${E.quarterLabel(next.turn)}` : ''}</h2>
      ${err ? `<div class="callout bad">${esc(err)}</div>` : ''}
      <div class="rep-grid">
        <div>
          <h3>Effective compute vs what the frontier needs</h3>
          ${bar('Frontier need', sm.need, '#fbbf24')}${bar('Owned clusters', sm.owned, '#38bdf8')}${bar('Leases & deals', sm.leased, '#0ea5e9')}
          ${bar('Cloud partnership', sm.cloud, '#7dd3fc')}${bar('Spot rentals', sm.spot, '#a5b4fc')}
          <p class="note">You have ${Math.round(sm.ratio * 100)}% of frontier need. The need grows about 50% a year, so yesterday's cluster becomes today's minimum.</p>
          <h3>Power</h3>
          <div class="row"><span>Owned clusters draw</span><span class="m">${Math.round(sm.demand)} MW of ${Math.round(sm.power)} MW</span></div>
          ${sm.utilization < 1 ? `<div class="callout bad">Power-limited: clusters are running at ${Math.round(sm.utilization * 100)}%. Fund energy deals or sign a power purchase agreement.</div>` : ''}
          <h3>Being built</h3><ul class="rep-list">${pipe || '<li class="muted">Nothing under construction. Fund Build Own Datacenters.</li>'}</ul>
          <h3>Leases</h3><ul class="rep-list">${leases || '<li class="muted">No active leases.</li>'}</ul>
        </div>
        <div>
          <h3>Deals on the table</h3>${offers || '<p class="note">No offers right now. Providers come knocking every few quarters.</p>'}
        </div>
      </div>
      <h3>Owned fleet</h3>
      <table class="fleet"><thead><tr><th>Gen</th><th>Pods</th><th>Age</th><th>Health</th><th>Fail/q</th><th>Book value</th><th>Resale</th><th></th></tr></thead><tbody>${fleet || '<tr><td colspan="8" class="muted">You own no hardware.</td></tr>'}</tbody></table>
      <p class="note">Failures follow a bathtub curve: new hardware has teething failures, then a stable middle age, then wears out. Infrastructure engineers on your team cut failure rates. Hardware depreciates over ${HW.lifeQuarters(S)} quarters on this difficulty, and old generations resell for much less.</p>
      <div class="btn-row" style="justify-content:flex-end"><button class="btn primary" data-action="closeModal">Done</button></div>`);
    $('modalCard').classList.add('wide');
  }

  function hwLines(r) {
    const h = r.hardware;
    if (!h) return '';
    const out = [];
    if (h.newGen) out.push(`<div class="callout good"><b>${esc(h.newGen)} chips are shipping.</b> Every cluster you own just became relatively older.</div>`);
    if (h.delivered > 0.5) out.push(`<div class="callout"><b>Compute online:</b> ${h.delivered.toFixed(1)} pods delivered.</div>`);
    if (h.failed > 0.3) out.push(`<div class="callout warn"><b>Hardware failures:</b> lost ${h.failed.toFixed(1)} pods this quarter.</div>`);
    h.expired.forEach((n) => out.push(`<div class="callout warn"><b>Lease ended:</b> ${esc(n)}.</div>`));
    if (h.offer) out.push(`<div class="callout good"><b>New compute offer:</b> ${esc(h.offer.provider)} — ${esc(h.offer.kind)}. <a href="#" data-action="compute">Review</a></div>`);
    return out.join('');
  }
  function peopleLines(r) {
    const p = r.people;
    if (!p) return '';
    const out = [];
    if (p.hired.length) out.push(`<div class="callout good"><b>Your hiring managers brought in ${p.hired.length}:</b> ${esc(p.hired.slice(0, 5).join(', '))}${p.hired.length > 5 ? '…' : ''}</div>`);
    if (p.left.length) out.push(`<div class="callout bad"><b>Departures:</b> ${esc(p.left.join(', '))}</div>`);
    if (p.culled.length) out.push(`<div class="callout warn"><b>Keeper test:</b> let go of ${esc(p.culled.join(', '))}</div>`);
    if (p.leaks.length) out.push(`<div class="callout bad"><b>Leak:</b> internal documents reached the press. Someone on the team talks to journalists.</div>`);
    return out.join('');
  }

  function floatDeltas(before) {
    const svg = $('board');
    let n = 0;
    for (const id of STAT_ORDER) {
      const q = pos[id], d = S.values[id] - before[id];
      if (!q || Math.abs(d) < 0.02) continue;
      const good = (d > 0) === isGood(id);
      FX.floatDelta(svg, q.x, q.y - q.r - 8, (d > 0 ? '+' : '') + Math.round(d * 100), good ? '#4ade80' : '#f87171', n++ * 80);
    }
  }

  function showArchive(tab) {
    const tabs = [['all', 'All'], ['triumph', 'Triumph'], ['cautionary', 'Cautionary'], ['doom', 'Doom'], ['irony', 'Irony'], ['achievements', 'Achievements']];
    let body;
    if (tab === 'achievements') {
      body = FL.ACHIEVEMENTS.map((a) => meta.achievements.includes(a.id)
        ? `<div class="acard legendary"><h5>${esc(a.name)}</h5>${esc(a.desc)}</div>`
        : `<div class="acard locked">${esc(a.name)}<br>???</div>`).join('');
    } else {
      body = FL.ARCHIVE.filter((a) => tab === 'all' || a.tone === tab).map((a) => {
        if (!meta.artifacts.includes(a.id)) return `<div class="acard locked ${a.rarity}">${a.rarity === 'legendary' ? 'LEGENDARY' : '???'}<br>${a.year}</div>`;
        return `<div class="acard ${a.rarity}"><span class="yr">${a.year} · ${a.rarity}</span><h5>${esc(a.title)}</h5>
          ${a.quote ? `<q>${esc(a.quote)}</q><span class="muted">${esc(a.speaker || '')}${a.paraphrase ? ' (paraphrase)' : ''}</span>` : ''}
          <div>${esc(a.summary)}</div><div class="ls">${esc(a.lesson)}</div>
          ${a.source ? `<a href="${esc(a.source)}" target="_blank" rel="noopener">source</a>` : ''}</div>`;
      }).join('');
    }
    openModal(`<h1>The Archive</h1>
      <h2>${meta.artifacts.length} of ${FL.ARCHIVE.length} artifacts · ${meta.achievements.length} of ${FL.ACHIEVEMENTS.length} achievements · collected across all your runs</h2>
      <p class="note">Real quotes, memos and headlines from AI labs and startups — triumphs and disasters both. They unlock when your company does something history has seen before.</p>
      <div class="tabs">${tabs.map(([id, n]) => `<button class="btn ${id === tab ? 'on' : ''}" data-action="archiveTab" data-arg="${id}">${n}</button>`).join('')}</div>
      <div class="archive-grid">${body}</div>
      <div class="btn-row" style="justify-content:flex-end"><button class="btn primary" data-action="${S ? 'closeModal' : 'start'}">Close</button></div>`);
  }

  function renderTicker() {
    if (!S) return;
    const items = [];
    const h = S.history._cap || [];
    S.rivals.forEach((r) => items.push(`<b>${esc(r.name)}</b> capability ${Math.floor(r.cap)}`));
    items.push(`<b>${esc(S.company)}</b> ${money(S.valuation)} valuation`);
    Sys.risks(S).slice(0, 2).forEach((r) => items.push(`<b>Whispers</b> ${esc(r.warn)}`));
    const owned = FL.ARCHIVE.filter((a) => a.quote && (meta.artifacts.includes(a.id) || a.rarity === 'common'));
    for (let i = 0; i < 3 && owned.length; i++) {
      const a = owned[(S.turn * 7 + i * 13) % owned.length];
      items.push(`"${esc(a.quote)}" — ${esc(a.speaker || 'unknown')}, ${a.year}`);
    }
    if (h.length > 1) items.push(`<b>Last quarter</b> +${(h[h.length - 1] - h[h.length - 2]).toFixed(1)} capability`);
    const track = $('tickerTrack');
    track.innerHTML = items.map((x) => `<span>${x}</span>`).join('');
    track.style.animationDuration = Math.max(30, track.textContent.length / 6) + 's';
  }

  UI.init = function () {
    document.addEventListener('pointerdown', () => A.unlock(), { once: false });
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (el) { actions[el.dataset.action](el.dataset.arg, el); return; }
    });
    const svg = $('board'), tip = $('tooltip');
    svg.addEventListener('mousemove', (e) => {
      const n = e.target.closest('.node');
      const id = n ? n.dataset.id : null;
      if (id !== hovered) { hovered = id; applyHighlight(); }
      if (id && S) {
        tip.innerHTML = tooltipText(id);
        tip.classList.remove('hidden');
        const box = $('boardWrap').getBoundingClientRect();
        let x = e.clientX - box.left + 14, y = e.clientY - box.top + 14;
        if (x + 270 > box.width) x -= 290;
        tip.style.left = x + 'px'; tip.style.top = y + 'px';
      } else tip.classList.add('hidden');
    });
    svg.addEventListener('mouseleave', () => { hovered = null; tip.classList.add('hidden'); applyHighlight(); });
    svg.addEventListener('click', (e) => {
      if (!S) return;
      const n = e.target.closest('.node');
      if (n) actions.inspect(n.dataset.id);
      else { selected = null; UI.renderAll(); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'm' && !(e.target && e.target.tagName === 'INPUT')) { A.setMuted(!A.isMuted()); if (S) UI.renderTopbar(); return; }
      if (e.key === 'Escape' && !$('modal').classList.contains('hidden') && S && !S.pendingDilemma && !S.ended) closeModal();
      else if (e.key === 'Escape' && S) { selected = null; UI.renderAll(); }
    });

    const saved = loadSave();
    if (saved && !saved.ended) {
      S = saved;
      UI.renderAll();
    }
    UI.showStart();
  };

  FL.UI = UI;
})(globalThis.FL = globalThis.FL || {});
