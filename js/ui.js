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
  const MP = FL.Multiplayer;
  const SHARE_URL = 'https://g8r-b8.github.io/frontierLab/';
  const joinPrefill = (() => { try { const q = new URLSearchParams(location.search); return { code: q.get('join') || '', kind: q.get('net') || 'internet' }; } catch (e) { return {}; } })();
  let mpEndResolve = null;
  const WEEK_MS = 2000; // one game week per 2 real seconds at 1x
  const SPEEDS = [0, 0.5, 1, 2, 4];
  let speed = 1;
  let loopAcc = 0, lastFrame = 0, lastClockSent = 0, lastSave = 0, ticksSinceInspect = 0;
  let decisionResults = []; // recent outcomes shown under the inbox
  
  const HW = FL.Hardware, HR = FL.Hiring;
  let lastReport = null;
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
    marketing: 'BC', ceoTour: 'CEO', nonprofit: 'NP', benchmarks: 'BX', execTeam: 'EX', devRel: 'DEV', creators: 'CRE', prTeam: 'COM', community: 'CMY', intel: 'INT',
    board: 'BD', investors: 'VC', researchers: 'RS', safetyCommunity: 'SC', enterprise: 'EC', consumers: 'CU', regulators: 'RG', openSource: 'OS', media: 'MD', partner: 'BT',
    talentExodus: 'TE', gpuCrunch: 'GS', probe: 'INV', injunction: 'INJ', lawsuit: 'LAW', jailbreak: 'JB', weightsLeak: 'WL', aiPanic: 'AP',
    misuse: 'MIS', bubble: 'BUB', viral: 'VIR', frontierLeader: '#1', missionCulture: 'MDC',
  };
  const STAT_ORDER = ['velocity', 'compute', 'talent', 'morale', 'data', 'openness', 'security', 'safety', 'trust', 'regHeat', 'legal',
    'hype', 'brand', 'quality', 'adoption', 'monetization', 'revGrowth', 'runway', 'lead'];

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

  /** What the player can see for a stat (fogged where measurement is uncertain). */
  const shown = (id) => (FL.Fog.FOGGY.includes(id) ? FL.Fog.measured(S, id).est : S.values[id]);

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
      const q = pos[id], v = shown(id), col = statColor(id, v);
      out.push(`<g class="node stat" data-id="${id}" transform="translate(${q.x.toFixed(1)},${q.y.toFixed(1)})">` +
        ring(q.r + 4, v, col, 4) +
        `<circle class="body" r="${q.r}" fill="#101724" stroke="#2a3549" stroke-width="1"/>` +
        `<text class="val" fill="${col}">${FL.Fog.FOGGY.includes(id) ? '~' : ''}${Math.round(v * 100)}</text>` +
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
      <div class="kpi"><span class="k">Date</span><span class="v">${E.quarterLabel(S.turn)} <small class="muted">wk ${E.weekOfQuarter(S) + 1}</small></span></div>
      <div class="kpi"><span class="k">Cash</span><span class="v ${S.cash < 0 ? 'neg' : ''}">${money(S.cash)}</span></div>
      <div class="kpi"><span class="k">Net / quarter</span><span class="v ${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : ''}${money(net)}</span></div>
      <div class="kpi"><span class="k">Runway</span><span class="v ${rq < toRound + 1 ? 'neg' : rq < toRound + 3 ? 'warn' : ''}">${rq === Infinity ? 'Profitable' : rq.toFixed(1) + ' q'}</span></div>
      <div class="kpi" title="Next funding round ${toRound <= 0 ? 'this quarter' : 'in ' + toRound + ' quarters'}"><span class="k">Valuation · round ${toRound <= 0 ? 'now' : 'in ' + toRound + 'q'}</span><span class="v">${money(S.valuation)}</span></div>
      <div class="kpi"><span class="k">Bandwidth</span><span class="v" style="color:#7dd3fc">${Math.floor(S.bandwidth)} <small class="muted">+${E.bandwidthIncome(S)}/q</small></span></div>
      <div class="spacer"></div>
      <span class="era-chip" title="${esc(Sys.eraOf(S).blurb)}">${esc(Sys.eraOf(S).name)}</span>
      <button class="btn" data-action="marketingMenu">Marketing${S.mkt && S.mkt.booked.length ? ` <b class="pos">${S.mkt.booked.length}</b>` : ''}</button>
      <button class="btn" data-action="hiring">People${S.people && S.people.feed.length ? ` <b>${S.people.feed.length}</b>` : ''}</button>
      <button class="btn" data-action="compute">Compute${S.hw && S.hw.offers.length ? ` <b class="pos">${S.hw.offers.length} deal${S.hw.offers.length > 1 ? 's' : ''}</b>` : ''}</button>
      <button class="btn" data-action="archive" title="The Archive">Archive <b>${meta.artifacts.length}</b></button>
      <button class="btn" data-action="gameMenu">Menu</button>
      ${MP.active() ? `<button class="btn" data-action="mpLobby" title="Lobby and chat">Lobby ${esc(MP.lobby.code)}</button>` : ''}
      ${speedControls()}`;
  };

  function speedControls() {
    const cur = MP.active() ? (MP.lobby.settings.speed || 1) : speed;
    const canSet = !MP.active() || MP.isHost();
    const opts = MP.active() ? SPEEDS.filter((v) => v > 0) : SPEEDS;
    return `<div class="speed" title="${MP.active() ? (canSet ? 'You set the pace for everyone' : 'The host sets the pace') : 'Space pauses; 1-4 set speed'}">${opts.map((v) =>
      `<button class="btn ${v === cur ? 'on' : ''}" data-action="setSpeed" data-arg="${v}" ${canSet ? '' : 'disabled'}>${v === 0 ? 'II' : v + 'x'}</button>`).join('')}
      <div class="qbar" title="Progress through the quarter"><span id="qprog" style="width:${(E.weekOfQuarter(S) / E.TICKS_PER_Q) * 100}%"></span></div></div>`;
  }

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
    const racers = [{ name: 'You', est: S.cap, sd: 0, color: '#7dd3fc' }].concat(S.rivals.map((r) => { const e = FL.Fog.rivalEstimate(S, r); return { name: r.name, est: e.est, sd: e.sd, color: r.color, player: r.player, source: e.source, age: e.age }; }))
      .sort((a, b) => b.est - a.est);
    const race = racers.map((r) => {
      const lo = Math.max(0, r.est - 1.6 * r.sd), hi = Math.min(105, r.est + 1.6 * r.sd);
      return `<div class="race-row" title="${r.sd ? `Estimate from ${esc(r.source)}${r.age > 0.2 ? `, ${Math.round(r.age * 13)} weeks ago` : ''}` : 'Your own lab'}"><div class="lbl"><span>${esc(r.name)}${r.player ? ` <span class="muted">· ${esc(r.player)}</span>` : ''}</span>
        <b>${r.sd ? `~${Math.round(r.est)} <small class="muted">±${Math.round(1.6 * r.sd)}</small>` : Math.floor(r.est)}</b></div>
        <div class="rbar">${r.sd ? `<i class="range" style="left:${lo}%;width:${hi - lo}%;background:${r.color}"></i>` : ''}<span style="width:${Math.min(100, r.est)}%;background:${r.color};${r.sd ? 'opacity:.55' : ''}"></span></div></div>`;
    }).join('');
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
      <p class="note">Rivals are estimates from public releases, leaks and intel; the bands widen the longer you go without news. First to 100 wins. What happens next depends on your safety — which you can only measure through evals (~${pct(FL.Fog.measured(S, 'safety').est)} ±${Math.round(160 * FL.Fog.measured(S, 'safety').sd)}).</p>`;
  };

  // ── inspector ────────────────────────────────────────────
  const MAG = ['barely', 'a little', 'moderately', 'strongly'];
  /** One qualitative effect row: direction, rough size, confidence. No hidden numbers. */
  function effRow(target, lab, extra, action) {
    const good = isGood(target);
    const col = (lab.sign * (good ? 1 : -1)) >= 0 ? '#4ade80' : '#f87171';
    const w = [6, 22, 50, 90][lab.mag] || 0;
    return `<div class="eff" data-action="${action || 'inspect'}" data-arg="${target}">
      <span>${esc(nameOf(target))} ${extra ? `<span class="tag">${extra}</span>` : ''}</span>
      <div class="cbar"><span style="background:${col};${lab.sign >= 0 ? 'left:50%' : 'right:50%'};width:${w / 2}%"></span></div>
      <span class="num" style="color:${col}">${lab.sign >= 0 ? '+' : '−'} ${MAG[lab.mag]}</span></div>`;
  }
  /** Size label for a live contribution (your own company: you can feel it, not measure it exactly). */
  function liveLabel(c) {
    const a = Math.abs(c);
    return { sign: Math.sign(c) || 1, mag: a < 0.015 ? 0 : a < 0.05 ? 1 : a < 0.11 ? 2 : 3 };
  }
  const lagTag = (lag) => (lag >= 4 ? 'slow' : lag <= 1 ? 'fast' : '');

  function driversHTML(id) {
    const ins = E.effectsInto(id);
    const live = ins.filter((e) => Math.abs(E.contribution(S, e)) > 0.004)
      .sort((a, b) => Math.abs(E.contribution(S, b)) - Math.abs(E.contribution(S, a)));
    const levers = ins.filter((e) => E.nodeType(e.from) === 'policy' && !S.policies[e.from]);
    const extras = Object.entries(S.extra || {}).map(([k, m]) => [k, m[id]]).filter(([, v]) => v && Math.abs(v) > 0.004);
    const extraRows = extras.map(([k, v]) => {
      const inp = E.extraInputs.find((x) => x.id === k);
      const lab = liveLabel(v);
      const col = (lab.sign * (isGood(id) ? 1 : -1)) >= 0 ? '#4ade80' : '#f87171';
      return `<div class="eff" data-action="${k === 'hardware' ? 'compute' : k === 'team' ? 'hiring' : 'marketingMenu'}"><span>${esc(inp ? inp.label : k)} <span class="tag">open</span></span>
        <div class="cbar"><span style="background:${col};${lab.sign >= 0 ? 'left:50%' : 'right:50%'};width:${[6, 22, 50, 90][lab.mag] / 2}%"></span></div>
        <span class="num" style="color:${col}">${lab.sign >= 0 ? '+' : '−'} ${MAG[lab.mag]}</span></div>`;
    }).join('');
    let h = `<h3>Driven by</h3>` + extraRows + (live.length ? live.map((e) => effRow(e.from, liveLabel(E.contribution(S, e)), lagTag(e.lag))).join('') : extraRows ? '' : '<p class="note">Nothing is moving this yet.</p>');
    if (levers.length) h += `<h3>Policies that might move it</h3><p class="note">Expected effects — this world may differ.</p>` + levers.map((e) => { const l = FL.Fog.effectLabel(S, e, 0.6); return effRow(e.from, l, 'guess'); }).join('');
    return h;
  }
  function affectsHTML(id) {
    const outs = E.effectsFrom(id).filter((e) => Math.abs(E.contribution(S, e)) > 0.004).sort((a, b) => Math.abs(E.contribution(S, b)) - Math.abs(E.contribution(S, a)));
    if (!outs.length) return '';
    return `<h3>Affects</h3>` + outs.map((e) => effRow(e.to, liveLabel(E.contribution(S, e)), lagTag(e.lag))).join('');
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
    const labs = E.effectsFrom(p.id).map((e) => ({ e, l: FL.Fog.effectLabel(S, e, src) })).sort((a, b) => b.l.mag - a.l.mag);
    const conf = labs.length ? labs[0].l.confidence : 'guess';
    $('polEffects').innerHTML = `<p class="note">${conf === 'measured' ? 'Measured from your own experience with this policy.' : conf === 'rough' ? 'Early read — effects take quarters to show, and this world may differ from expectations.' : 'An educated guess. Every world is different; you will learn the real effects by running it.'}</p>` +
      labs.map(({ e, l }) => effRow(e.to, l, [lagTag(e.lag), l.confidence].filter(Boolean).join(' · '))).join('');
  }

  function statHTML(d, type) {
    const id = d.id, v = shown(id);
    const m = FL.Fog.measured(S, id);
    const big = id === 'capability' ? `${Math.floor(S.cap)}<small class="muted" style="font-size:14px"> / 100</small>` : m.sd ? `~${pct(v)} <small class="muted" style="font-size:14px">±${Math.round(160 * m.sd)} · ${m.kind}</small>` : pct(v);
    let extra = '';
    if (id === 'capability') {
      extra = `<div class="row"><span>Gain last quarter</span><span class="m">+${(lastReport && lastReport.capGain || 0).toFixed(1)}</span></div>` +
        S.rivals.map((r) => { const e = FL.Fog.rivalEstimate(S, r); return `<div class="row"><span style="color:${r.color}">${esc(r.name)}</span><span class="m">~${Math.round(e.est)} ±${Math.round(1.6 * e.sd)}</span></div>`; }).join('') +
        `<p class="note">Capability grows each quarter with Research Velocity. Quality, hype, regulatory heat and the difficulty of alignment all rise with it.</p>` +
        (S.policies.rsp ? `<p class="note">Your Responsible Scaling Policy pauses scaling above capability ${Math.round(E.pauseThreshold(S))}.</p>` : '');
    } else if (id === 'runway') {
      const rq = runwayQ();
      extra = `<div class="row"><span>Quarters of cash</span><span class="m">${rq === Infinity ? 'Profitable' : rq.toFixed(1)}</span></div>`;
    }
    const hist = id === 'capability' ? S.history._cap : FL.Fog.FOGGY.includes(id) ? null : S.history[id];
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
      <div class="row"><span>Pressure</span><span class="m">${p > d.on ? 'past the tipping point' : p > d.on * 0.85 ? 'close to tipping' : p > d.on * 0.6 ? 'building' : 'low'}</span></div>
      ${driversHTML(d.id)}
      <h3>Effects while active</h3>${d.e.map(([to, k]) => effRow(to, liveLabel(k))).join('')}
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
    return FL.Fog.FOGGY.includes(id) ? `<b>${esc(d.name)}</b>~${pct(shown(id))} (${FL.Fog.measured(S, id).kind})` : `<b>${esc(d.name)}</b>${pct(S.values[id])}`;
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
        <button class="btn big" data-action="help">How to play</button></div>
      <h3>Multiplayer</h3>
      <p class="note">Race friends' labs — or their Claude companions — peer to peer. Each of you runs your own company; quarters advance when everyone is ready.</p>
      <div class="btn-row">
        <button class="btn" data-action="mpHost" data-arg="internet">Host an online lobby</button>
        <button class="btn" data-action="mpHost" data-arg="local">Host in this browser (tabs)</button>
        <input class="name-input" id="joinCode" placeholder="Room code" maxlength="6" style="width:130px;text-transform:uppercase" value="${esc(joinPrefill.code || '')}">
        <button class="btn" data-action="mpJoin">Join</button>
      </div>`);
  };

  function helpHTML() {
    return `<h1>How to play</h1>
      <div class="howto">
        <p><b>It runs in real time.</b> One game week passes every two seconds at 1x; you have ten years. Change speed with the buttons or keys 1-4; Space pauses (single-player only). Nothing waits for you.</p>
        <p><b>Decisions land in your inbox</b> with a countdown. Ignore one and the default (dashed) option happens when time runs out.</p>
        <p><b>You never see everything.</b> Rivals are estimates from releases, leaks and intel. Your own safety is an eval estimate, trust is a poll, and policy effects are educated guesses until you have run them for a while. Every world is different, and analyst notes about it are sometimes wrong.</p>
        <p><b>Policies</b> are the circles on the outer ring, grouped by category. Click one to enact it, set its slider, or cancel it. Dashed circles are not enacted.</p>
        <p><b>Bandwidth</b> is your leadership attention: enacting, adjusting and cancelling policies cost it. You earn more each quarter, more if stakeholders approve of you. Changes made within the same quarter can be reverted for free.</p>
        <p><b>Money.</b> Most policies cost cash every quarter. Revenue comes from adoption times monetization. Funding rounds happen every six quarters; the amount depends on valuation and investor confidence. Run out of cash and you are done.</p>
        <p><b>The board</b> (middle ring) is a living simulation. Hover any circle to see what drives it (wires in) and what it drives (wires out). Green helps, red hurts. Effects take quarters to fully kick in.</p>
        <p><b>Stakeholders</b> (inner ring and left panel) are your voter groups. Unhappy investors kill funding rounds. An unhappy board fires you.</p>
        <p><b>Situations</b> appear in the middle when pressure builds: lawsuits, scandals, talent exodus, injunctions — or viral moments and frontier leadership.</p>
        <p><b>Winning.</b> Reach capability 100 before your rivals. If safety maturity is high enough when you get there, you built aligned AGI. If not... Alignment gets harder as capability rises.</p>
        <p><b>Compute.</b> Your GPUs are real assets: datacenter spend buys pods that come online later, age, fail and depreciate, and need power. A new chip generation ships about every six quarters. Providers offer deals with very different strings attached.</p>
        <p><b>Recruiting.</b> Hire key people yourself at first, then appoint hiring managers. Hiring practices decide who gets through; company values decide who you become. Toxic cultures catch up with you.</p>
        <p><b>Pitfalls.</b> Short-, medium- and long-term traps from real AI and startup history build up quietly. Watch the risk radar for warning signs.</p>
        <p><b>The Archive.</b> Real quotes, memos and headlines unlock as your company repeats history. Your collection and achievements carry across runs.</p>
        <p><b>Terminal and Claude.</b> Run <code>npm start</code>, open localhost:4747, and drive the game with <code>./frontier help</code> — or ask Claude Code to be your chief of staff.</p>
      </div>
      <div class="btn-row"><button class="btn primary" data-action="${S ? 'closeModal' : 'start'}">Got it</button></div>`;
  }

  UI.showReport = function (r) {
    const f = r.finance;
    const deltas = (r.deltas || []).filter((d) => !FL.Fog.FOGGY.includes(d.id) && d.id !== 'lead').slice(0, 8).map((d) => {
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
    const arch = r.fromArchive && artifactOf(r.fromArchive);
    const ob = r.objectives || { done: [], failed: [], dealt: [] };
    const obLines = ob.done.map((o) => `<div class="callout good"><b>Objective complete:</b> ${esc(o.text)} <span class="muted">(+4 bandwidth, ${esc(nameOf(o.owner))} pleased)</span></div>`).join('') +
      ob.failed.map((o) => `<div class="callout bad"><b>Objective missed:</b> ${esc(o.text)} <span class="muted">(${esc(nameOf(o.owner))} disappointed)</span></div>`).join('');
    const warnLines = (r.pitfallWarnings || []).map((w) => `<div class="callout warn"><b>Warning sign (${w.horizon}-term):</b> ${esc(w.text)}</div>`).join('');
    const rumorLines = (r.rumors || []).map((x) => `<div class="callout"><b>Rumor:</b> ${x.good ? 'Momentum is building toward' : 'Insiders whisper about'} ${esc(x.name)}.</div>`).join('');
    openModal(`
      <div class="reveal">
      <div class="paper ${h.tabloid ? 'tabloid' : ''}"><div class="mast"><span>${esc(r.label)}</span><b>${esc(h.paper)}</b><span>Late edition</span></div>
        <div class="paper-cols"><div><h1>${esc(h.head)}</h1><p>${esc(h.sub)}</p>
          ${arch ? `<div class="paper-archive"><b>From the archives, ${arch.year}:</b> ${esc(arch.title)}. ${esc(arch.summary)}</div>` : ''}</div>
        ${epi ? `<aside class="paper-quote"><span>Quote of the quarter</span><q>${esc(epi.quote)}</q><i>— ${esc(epi.speaker || 'Unattributed')}, ${epi.year}${epi.paraphrase ? ' (paraphrase)' : ''}</i></aside>` : ''}</div></div>
      ${r.funding ? `<div class="callout ${r.funding.ok ? 'good' : 'bad'}"><b>${r.funding.name}.</b> ${esc(r.funding.text)}</div>` : ''}
      ${r.bridge ? `<div class="callout warn">${esc(r.bridge)}</div>` : ''}
      ${sitLine(r.started, 'started')}${sitLine(r.ended, 'ended')}
      ${r.warnings.map((w) => `<div class="callout bad">${esc(w)}</div>`).join('')}
      ${campaignLines(r)}${warnLines}${rumorLines}${obLines}${hwLines(r)}${peopleLines(r)}
      <div class="rep-grid">
        <div>
          <h3>Finances</h3>
          <ul class="rep-list">
            <li><span>Revenue</span><span class="m pos">${money(f.revenue)}</span></li>
            <li><span>Costs</span><span class="m neg">${money(f.costs)}</span></li>
            <li><span>Net</span><span class="m ${f.net >= 0 ? 'pos' : 'neg'}">${money(f.net)}</span></li>
            <li><span>Cash now</span><span class="m">${money(S.cash)}</span></li>
            <li><span>Valuation</span><span class="m">${money(S.valuation)}</span></li>
          </ul>
          <h3>The race</h3>
          <ul class="rep-list">
            <li><span>Your capability</span><span class="m">${Math.floor(S.cap)} <span class="pos">(+${r.capGain.toFixed(1)} that quarter)</span></span></li>
            ${S.rivals.map((x) => { const e = FL.Fog.rivalEstimate(S, x); return `<li><span>${esc(x.name)}</span><span class="m">~${Math.round(e.est)} ±${Math.round(1.6 * e.sd)}</span></li>`; }).join('')}
          </ul>
          ${r.paused ? '<div class="callout warn">Your Responsible Scaling Policy kicked in: capability has outrun safety, so scaling slowed to a crawl.</div>' : ''}
          ${r.news.map((n) => `<p class="note">${esc(n)}</p>`).join('')}
        </div>
        <div><h3>Biggest changes</h3><ul class="rep-list">${deltas || '<li class="muted">A quiet quarter.</li>'}</ul></div>
      </div>
      ${(r.notes || []).map((n) => `<div class="callout"><b>Analyst note:</b> ${esc(n)} <span class="muted">(may or may not be right)</span></div>`).join('')}
      ${(r.expired || []).map((n) => `<div class="callout bad">${esc(n)}</div>`).join('')}
      <p class="note">The clock is still running while you read.</p>
      <div class="btn-row" style="justify-content:flex-end"><button class="btn primary big" data-action="closeModal">Close</button></div>
      </div>`);
    $('modalCard').querySelectorAll('.reveal > *').forEach((el, i) => (el.style.animationDelay = i * 90 + 'ms'));
  };

  // ── Decision inbox (non-blocking; the clock keeps running) ─────
  function renderInbox() {
    const box = $('inbox');
    if (!box || !S) return;
    const sp = MP.active() ? (MP.lobby.settings.speed || 1) : speed;
    const cards = S.inbox.map((item) => {
      const d = FL.DILEMMAS.find((x) => x.id === item.id);
      if (!d) return '';
      const pit = d.pitfall && FL.PITFALLS.find((p) => p.id === d.pitfall);
      const total = item.deadline - item.arrived, left = Math.max(0, item.deadline - S.week - loopAcc / WEEK_MS);
      const secs = sp ? Math.ceil((left * WEEK_MS) / sp / 1000) : null;
      return `<div class="dcard ${pit ? 'pit' : ''}">
        <div class="dhead"><span>${pit ? `Pitfall · ${pit.horizon}-term` : d.launch ? `${esc(S.lastModel || 'New model')} is ready` : 'Decision'}</span>
          <span class="${left < 1.5 ? 'neg' : ''}">${secs == null ? 'paused' : `${Math.ceil(left)} wk · ~${secs}s`}</span></div>
        <div class="dbar"><span style="width:${(left / total) * 100}%"></span></div>
        <b>${esc(d.title)}</b><p>${esc(d.text)}</p>
        <div class="dopts">${d.options.map((o, i) => `<button class="btn ${i === E.defaultOption(d) ? 'dflt' : ''}" data-action="decide" data-arg="${item.uid}:${i}" title="${esc(o.desc)}${i === E.defaultOption(d) ? ' — this happens if you run out of time' : ''}">${esc(o.label)}${o.cash ? ` <span class="${o.cash > 0 ? 'pos' : 'neg'}">${o.cash > 0 ? '+' : ''}${money(E.eventCash(S, o))}</span>` : ''}</button>`).join('')}</div>
      </div>`;
    }).join('');
    const results = decisionResults.map((r, i) => `<div class="dcard done"><div class="dhead"><span>${esc(r.title)}</span><button class="btn" data-action="dismissResult" data-arg="${i}">Close</button></div>
      <p><b>${esc(r.label)}:</b> ${esc(r.text)}</p>${r.history ? `<div class="history"><h4>History rhymes · ${esc(r.pitName)}</h4><p>${esc(r.history)}</p><p class="lesson">${esc(r.lesson)}</p></div>` : ''}</div>`).join('');
    box.innerHTML = cards + results;
  }

  UI.decide = function (uid, i) {
    const item = S.inbox.find((x) => x.uid === uid);
    if (!item) return { ok: false, reason: 'That decision is gone.' };
    const d = FL.DILEMMAS.find((x) => x.id === item.id);
    if (!(i >= 0 && i < d.options.length)) return { ok: false, reason: `Choose 1-${d.options.length}.` };
    const res = E.resolveDilemma(S, i, uid);
    const pit = d.pitfall && FL.PITFALLS.find((p) => p.id === d.pitfall);
    decisionResults.unshift({ title: d.title, label: d.options[i].label, text: res.text, history: pit && pit.history, lesson: pit && pit.lesson, pitName: pit && pit.name, at: Date.now() });
    decisionResults = decisionResults.slice(0, 2);
    A.play('click');
    recordUnlocks(res, 200);
    afterAction({ ok: true });
    if (res.ending) handleEnding(res.ending);
    return { ok: true, res, dilemma: d, pitfall: pit };
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
      <p class="note"><span style="color:#7dd3fc">You</span> · ${S.rivals.map((r) => `<span style="color:${r.color}">${esc(r.name)}</span>`).join(' · ')} · <span style="color:#f472b6">Your true safety</span> · <span style="color:#fbbf24">AGI</span> — the real numbers, revealed now that it is over.</p>`;
    const traits = FL.World ? FL.World.reveal(S) : [];
    openModal(`
      <h2>${esc(S.company)} · ${E.quarterLabel(Math.min(S.turn, E.MAX_TURNS))}</h2>
      <h1 class="${end.win ? 'pos' : 'neg'}">${esc(end.title)}</h1>
      <p class="lede">${esc(end.text)}</p>
      ${traits.length ? `<div class="callout"><b>The hidden world was:</b> ${traits.map(esc).join(' · ')}. Your evals had safety at ~${pct(FL.Fog.measured(S, 'safety').est)}; the truth was ${pct(S.values.safety)}.</div>` : ''}
      ${chart}
      <ul class="rep-list">
        <li><span>Score</span><span class="m">${E.score(S)}</span></li>
        <li><span>Capability</span><span class="m">${Math.floor(S.cap)}</span></li>
        <li><span>Safety maturity</span><span class="m">${pct(S.values.safety)}</span></li>
        <li><span>Final valuation</span><span class="m">${money(S.valuation)}</span></li>
        <li><span>Total raised</span><span class="m">${money(S.rounds.reduce((a, b) => a + b.raised, 0))} over ${S.rounds.length} rounds</span></li>
      </ul>
      <div class="btn-row"><button class="btn primary big" data-action="menu">New game</button><button class="btn big" data-action="shareRun">Copy run summary</button><button class="btn big" data-action="closeModal">Look at the board</button></div>`);
  };

  // ── flow ─────────────────────────────────────────────────
  UI.renderAll = function () {
    renderTicker();
    renderInbox();
    UI.renderTopbar();
    UI.renderLeft();
    UI.renderBoard();
    UI.inspect(selected);
    if (selected && E.nodeType(selected) === 'policy') updatePolicyPreview(E.node(selected).def);
  };

  function startGame(state) {
    S = state;
    selected = null; hovered = null; preview = {}; lastReport = null; endingShown = false; decisionResults = [];
    loopAcc = 0; speed = 1; S.events = [];
    closeModal();
    UI.renderAll();
    save();
    if (S.unseen) { recordUnlocks(S.unseen, 400); S.unseen = null; save(); }
    A.unlock();
    A.setTension(S.tension || 0);
    renderInbox();
    if (S.ended) UI.showEnding(S.ended);
  }

  const actions = {
    inspect: (id) => { UI.inspect(id); UI.renderLeft(); applyHighlight(); if (E.nodeType(id) === 'policy') updatePolicyPreview(E.node(id).def); },
    briefing: () => { selected = null; closeModal(); UI.renderAll(); },
    help: () => openModal(helpHTML()),
    start: () => UI.showStart(),
    menu: () => UI.showStart(),
    closeModal: () => closeModal(),
    pickArch: (id) => { pickedArch = id; document.querySelectorAll('.card[data-action=pickArch]').forEach((c) => c.classList.toggle('sel', c.dataset.arg === id)); },
    found: () => startGame(E.newGame(pickedArch, ($('coName').value || 'Frontier Labs').trim(), undefined, pickedDiff)),
    setSpeed: (v) => {
      v = +v;
      if (MP.active()) { if (MP.isHost() && v > 0) MP.setSettings({ speed: v }); return; }
      speed = v;
      UI.renderTopbar();
    },
    togglePause: () => { if (MP.active()) return; speed = speed ? 0 : 1; UI.renderTopbar(); FX.toast(speed ? 'Running' : 'Paused', 'info', 1000); },
    decide: (arg) => { const [uid, i] = String(arg).split(':').map(Number); UI.decide(uid, i); },
    dismissResult: (i) => { decisionResults.splice(+i, 1); renderInbox(); },
    openNews: (turn) => { const r = (S.newspapers || []).find((x) => String(x.turn) === String(turn)) || lastReport; if (r) UI.showReport(r); },
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
    archive: (tab) => showArchive(tab || 'all'),
    mpHost: async (kind) => {
      try {
        await MP.hostLobby({ kind, name: 'Host', company: ($('coName') && $('coName').value.trim()) || 'Frontier Labs', archetype: pickedArch, difficulty: pickedDiff });
        showLobby();
      } catch (e) { FX.toast(esc(e.message || e), 'bad'); }
    },
    mpJoin: async () => {
      const code = ($('joinCode').value || '').trim().toUpperCase();
      try {
        FX.toast('Connecting…', 'info', 2000);
        await MP.joinLobby(code, { kind: joinPrefill.code === code ? joinPrefill.kind : 'internet', name: 'Player', company: ($('coName') && $('coName').value.trim()) || 'Frontier Labs', archetype: pickedArch });
        showLobby();
      } catch (e) { FX.toast(esc(e.message || e), 'bad', 5000); }
    },
    mpLobby: () => showLobby(),
    shareRun: () => {
      const arch = FL.ARCHETYPES.find((a) => a.id === S.archetype);
      const end = S.ended || { title: 'Still running' };
      const text = `${end.title}: ${S.company} (${arch ? arch.name : ''}, ${S.difficulty}) reached capability ${Math.floor(S.cap)} by ${E.quarterLabel(Math.min(S.turn, E.MAX_TURNS))} with ${pct(S.values.safety)} safety maturity. Score ${E.score(S)}. Repeated ${Object.keys(S.pitfallsFired || {}).length} historical mistakes; collected ${meta.artifacts.length}/${FL.ARCHIVE.length} artifacts.\nPlay Frontier: ${SHARE_URL}`;
      try { navigator.clipboard.writeText(text); FX.toast('Run summary copied. Paste it anywhere.', 'good', 2500); } catch (e) { FX.toast(esc(text), 'info', 9000); }
    },
    inviteFriend: () => { try { navigator.clipboard.writeText(SHARE_URL); FX.toast('Link copied.', 'good', 2000); } catch (e) { /* ignore */ } },
    mpAddBot: () => MP.addBot(),
    mpRemove: (id) => MP.removePlayer(id),
    mpStart: () => MP.start(),
    mpLeave: () => { MP.leave(); UI.showStart(); },
    mpProfile: () => MP.setProfile({ name: $('mpName').value.trim() || 'Player', company: $('mpCompany').value.trim() || 'Frontier Labs', archetype: $('mpArch').value }),
    mpSettings: () => MP.setSettings({ difficulty: $('mpDiff').value, aiRivals: $('mpAi').checked, speed: +$('mpSpeed').value }),
    mpChat: () => { const i = $('mpChatIn'); if (i && i.value.trim()) { MP.chat(i.value.trim()); i.value = ''; } },
    copyInvite: () => { try { navigator.clipboard.writeText(MP.inviteLink()); FX.toast('Invite link copied.', 'good', 2000); } catch (e) { /* ignore */ } },
    hiring: () => showHiring(),
    marketingMenu: () => showMarketing(),
    book: (id) => { const r = FL.Marketing.book(S, id); afterAction(r, r.ok ? 'Campaign booked. Results at quarter end.' : null); showMarketing(r.ok ? null : r.reason); if (r.ok) A.play('enact'); },
    unbook: (id) => { const r = FL.Marketing.unbook(S, id); afterAction(r); showMarketing(r.ok ? null : r.reason); },
    compute: () => showCompute(),
    offer: (id) => { const r = HR.makeOffer(S, id); afterAction(r, r.ok ? (r.accepted ? `<b>${esc(r.person.name)}</b> accepted your offer.` : esc(r.text)) : null); showHiring(r.ok ? null : r.reason); if (r.ok) A.play(r.accepted ? 'chime' : 'cancel'); return r; },
    passCand: (id) => { S.people.feed = S.people.feed.filter((c) => c.id !== +id); save(); showHiring(); },
    appoint: (id) => { const sel = document.getElementById('focus-' + id); const r = HR.appointManager(S, id, sel ? sel.value : null); afterAction(r); showHiring(r.ok ? null : r.reason); },
    unappoint: (id) => { HR.removeManager(S, id); afterAction({ ok: true }); showHiring(); },
    practice: (id) => { const r = HR.setPractice(S, id, !S.people.practices[id]); afterAction(r); showHiring(r.ok ? null : r.reason); },
    toggleValue: (id) => { valueDraft = valueDraft.includes(id) ? valueDraft.filter((x) => x !== id) : valueDraft.concat(id).slice(-FL.MAX_VALUES); showHiring(); },
    saveValues: () => { const r = HR.setValues(S, valueDraft); afterAction(r); showHiring(r.ok ? null : r.reason); },
    deal: (id) => { const r = HW.acceptOffer(S, id); afterAction(r, r.ok ? 'Deal signed.' : null); showCompute(r.ok ? null : r.reason); if (r.ok) A.play('cash'); },
    sell: (id) => { const r = HW.sellCluster(S, id); afterAction(r, r.ok ? `Sold for ${money(r.price)}.` : null); showCompute(r.ok ? null : r.reason); },
    gameMenu: () => openModal(`<h1>Menu</h1><div class="btn-row">
      <button class="btn big" data-action="briefing">Quarterly briefing</button>
      <button class="btn big" data-action="mute">${A.isMuted() ? 'Turn sound on' : 'Mute sound'} (M)</button>
      <button class="btn big" data-action="help">How to play</button>
      <button class="btn big" data-action="archive">The Archive</button>
      <button class="btn big" data-action="inviteFriend">Copy link to share the game</button>
      <button class="btn big danger" data-action="menu">New game</button>
      <button class="btn big" data-action="closeModal">Back to the board</button></div>`),
    mute: () => { A.setMuted(!A.isMuted()); closeModal(); UI.renderTopbar(); FX.toast(A.isMuted() ? 'Sound off' : 'Sound on', 'info', 1500); },
    showEnd: () => UI.showEnding(S.ended),
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

  function showMarketing(err) {
    const list = FL.Marketing.available(S);
    const chan = FL.POLICIES.filter((p) => p.cat === 'marketing').map((p) => `<div class="eff" data-action="inspect" data-arg="${p.id}"><span>${esc(p.name)}</span>
      <span class="muted">${S.policies[p.id] ? 'active ' + pct(S.policies[p.id].level) : 'not enacted'}</span><span class="num">${S.policies[p.id] ? money(E.policyCost(S, p.id)) : ''}</span></div>`).join('');
    const cards = list.map((c) => {
      const booked = S.mkt.booked.includes(c.id);
      return `<div class="card" style="cursor:default"><h4>${esc(c.name)}</h4><p>${esc(c.desc)}</p>
        <div class="meta">${money(c.price)} · ${c.bandwidth} bandwidth · then ${c.cooldown}q cooldown${c.onlyQ ? ` · Q${c.onlyQ} only` : ''}</div>
        <div class="meta">Outcomes: ${c.outcomes.map((o) => Math.round(o.p * 100) + '%').join(' / ')} (better products and brands tilt the odds)</div>
        <div class="btn-row">${booked ? `<button class="btn" data-action="unbook" data-arg="${c.id}">Cancel booking</button><span class="pos">Booked</span>`
          : `<button class="btn primary" data-action="book" data-arg="${c.id}" ${c.blocker || S.ended ? 'disabled' : ''}>Book</button>${c.blocker ? `<span class="muted">${esc(c.blocker)}</span>` : ''}`}</div></div>`;
    }).join('');
    const hist = S.mkt.history.slice(-5).reverse().map((h) => `<li><span>${esc(h.name)}: ${esc(h.label)}</span><span class="m muted">${E.quarterLabel(h.turn)}</span></li>`).join('');
    openModal(`<h1>Marketing</h1>
      <h2>Brand awareness ${pct(S.values.brand)} · Hype ${pct(S.values.hype)} · Trust ${pct(S.values.trust)} · ${S.bandwidth} bandwidth</h2>
      ${err ? `<div class="callout bad">${esc(err)}</div>` : ''}
      <p class="note">Hype is this quarter's buzz; brand is what lasts. Campaigns run once and report results at the end of the quarter. Each new model also gets a launch-day decision.</p>
      <div class="rep-grid"><div><h3>Always-on channels</h3>${chan}${hist ? `<h3>Recent campaigns</h3><ul class="rep-list">${hist}</ul>` : ''}</div>
      <div><h3>Campaigns</h3><div class="cards" style="grid-template-columns:1fr">${cards}</div></div></div>
      <div class="btn-row" style="justify-content:flex-end"><button class="btn primary" data-action="closeModal">Done</button></div>`);
    $('modalCard').classList.add('wide');
  }

  function campaignLines(r) {
    return (r.campaigns || []).map((c) => `<div class="callout ${c.best ? 'good' : c.worst ? 'bad' : ''}"><b>Campaign — ${esc(c.name)}:</b> ${esc(c.label)} <span class="muted">(~${c.reach}M people reached)</span></div>`).join('');
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

  /** A real quote, picked at random from the verified archive. */
  function randomQuote() {
    const q = FL.ARCHIVE.filter((a) => a.quote && a.quote.length < 160);
    return q[Math.floor(Math.random() * q.length)];
  }
  function quoteHTML(a) {
    return `<q>${esc(a.quote)}</q><div class="by">— ${esc(a.speaker || 'Unattributed')}, ${a.year}${a.paraphrase ? ' (paraphrase)' : ''}</div>`;
  }
  function showSplash() {
    const sp = $('splash');
    if (!sp) return;
    sp.querySelector('.splash-quote').innerHTML = quoteHTML(randomQuote());
    sp.classList.remove('hidden');
    const close = () => { sp.classList.add('out'); setTimeout(() => sp.classList.add('hidden'), 450); };
    sp.addEventListener('click', close, { once: true });
    setTimeout(close, 3200);
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
    const items = feedItems.slice();
    const h = S.history._cap || [];
    S.rivals.forEach((r) => { const e = FL.Fog.rivalEstimate(S, r); items.push(`<b>${esc(r.name)}</b> est. capability ~${Math.round(e.est)}`); });
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

  // ── Multiplayer lobby ───────────────────────────────────
  function showLobby() {
    const L = MP.lobby;
    if (!L) return UI.showStart();
    const me = MP.me() || {};
    const host = MP.isHost();
    const rows = L.players.map((p) => `<li><span><i class="dot" style="background:${p.color || '#888'}"></i><b>${esc(p.company)}</b> <span class="muted">${esc(p.bot ? 'AI lab' : p.name)}${p.host ? ' · host' : ''}${p.id === MP.myId ? ' · you' : ''}${p.connected === false ? ' · disconnected' : ''}</span></span>
      <span class="m">${esc((FL.ARCHETYPES.find((a) => a.id === p.archetype) || {}).name || '')}${L.started ? ` · last release ${Math.floor(p.cap)}${p.ended ? ' · ' + esc(p.ended.title) : ''}` : ''}
      ${host && !L.started && p.id !== MP.myId ? ` <button class="btn" data-action="mpRemove" data-arg="${p.id}">Remove</button>` : ''}</span></li>`).join('');
    const chat = L.chat.slice(-12).map((c) => `<div><b>${esc(c.from)}</b> <span class="muted">${esc(c.company || '')}</span>: ${esc(c.text)}</div>`).join('');
    openModal(`<h1>Lobby <span class="mono">${esc(L.code)}</span></h1>
      <h2>${L.kind === 'local' ? 'Same-browser lobby: open the invite link in another tab.' : 'Online, peer to peer. Share the code or invite link with friends.'} Real time — the clock never stops.</h2>
      <div class="btn-row"><input class="name-input" readonly value="${esc(MP.inviteLink())}" style="flex:1;font-size:12px"><button class="btn" data-action="copyInvite">Copy invite link</button></div>
      <div class="rep-grid">
        <div><h3>Labs in this race</h3><ul class="rep-list">${rows}</ul>
          ${host && !L.started ? `<div class="btn-row"><button class="btn" data-action="mpAddBot">Add an AI lab</button></div>` : ''}
          ${!L.started ? `<h3>Your lab</h3>
            <div class="btn-row"><input id="mpName" class="name-input" style="width:140px" placeholder="Your name" value="${esc(me.name || '')}">
            <input id="mpCompany" class="name-input" style="width:180px" placeholder="Company" value="${esc(me.company || '')}">
            <select id="mpArch" class="sel">${FL.ARCHETYPES.map((a) => `<option value="${a.id}" ${a.id === me.archetype ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
            <button class="btn" data-action="mpProfile">Update</button></div>` : ''}
          ${host && !L.started ? `<h3>Match settings</h3><div class="btn-row">
            <select id="mpDiff" class="sel">${FL.DIFFICULTIES.map((d) => `<option value="${d.id}" ${d.id === L.settings.difficulty ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
            <select id="mpSpeed" class="sel">${[0.5, 1, 2, 4].map((n) => `<option value="${n}" ${n === L.settings.speed ? 'selected' : ''}>Speed ${n}x</option>`).join('')}</select>
            <label class="note"><input type="checkbox" id="mpAi" ${L.settings.aiRivals ? 'checked' : ''}> Include the classic AI rival labs</label>
            <button class="btn" data-action="mpSettings">Apply</button></div>` : !L.started ? `<p class="note">Difficulty: ${esc(L.settings.difficulty || 'normal')} · Speed ${L.settings.speed || 1}x · Classic AI rivals: ${L.settings.aiRivals ? 'on' : 'off'}</p>` : ''}
        </div>
        <div><h3>Chat</h3><div class="chatlog">${chat || '<span class="muted">Say hello. Trash talk encouraged.</span>'}</div>
          <div class="btn-row"><input id="mpChatIn" class="name-input" style="flex:1" placeholder="Message" maxlength="300"><button class="btn" data-action="mpChat">Send</button></div></div>
      </div>
      <div class="btn-row" style="justify-content:flex-end">
        ${L.started ? '<button class="btn primary" data-action="closeModal">Back to the board</button>' : host ? '<button class="btn primary big" data-action="mpStart">Start the race</button>' : '<span class="note">Waiting for the host to start…</span>'}
        <button class="btn danger" data-action="mpLeave">Leave</button></div>`);
    $('modalCard').classList.add('wide');
    const ci = $('mpChatIn');
    if (ci) ci.addEventListener('keydown', (e) => { if (e.key === 'Enter') actions.mpChat(); });
  }
  const lobbyOpen = () => !$('modal').classList.contains('hidden') && $('modalCard').querySelector('[data-action=mpLeave]');

  MP.on('change', () => {
    if (S && MP.active()) { MP.applySnapshots(S); UI.renderTopbar(); UI.renderLeft(); }
    if (lobbyOpen()) showLobby();
  });
  MP.on('start', () => { startGame(MP.makeGame()); FX.toast(`The race is on: ${MP.lobby.players.length} labs, in real time.`, 'good'); });
  MP.on('chat', (c) => { if (!lobbyOpen()) FX.toast(`<span class="tk">${esc(c.company || '')}</span><b>${esc(c.from)}:</b> ${esc(c.text)}`, 'info', 5000); else showLobby(); });
  MP.on('ended', (end) => handleEnding(end));
  MP.on('error', (e) => FX.toast(esc(e), 'bad', 5000));
  MP.on('hostLeft', () => FX.toast('The host left the lobby.', 'bad', 6000));

  // ── The real-time loop ──────────────────────────────────
  function handleEnding(end) {
    if (endingShown) return;
    save();
    UI.renderAll();
    UI.showEnding(end);
  }

  /** Turn engine events into notifications, sounds and effects. Nothing here pauses the game. */
  function handleEvents() {
    const evs = S.events.splice(0);
    let toasts = 0;
    const T = (html, kind, ms) => { if (toasts++ < 4) FX.toast(html, kind, ms); };
    for (const ev of evs) {
      switch (ev.type) {
        case 'decision': {
          const d = FL.DILEMMAS.find((x) => x.id === ev.id);
          if (d && d.pitfall) { A.play('crisis'); FX.shake($('boardWrap'), 5, 300); FX.flash('#ef4444'); } else A.play('decision');
          break;
        }
        case 'expired': A.play('warn'); T(`<span class="tk">Out of time</span>${esc(ev.text)}`, 'bad', 6000); break;
        case 'situation': {
          const d = E.node(ev.id).def;
          const good = ev.on === d.good;
          T(`<span class="tk">${ev.on ? 'Started' : 'Ended'}</span><b>${esc(d.name)}</b>${ev.on ? '<br>' + esc(d.desc) : ''}`, good ? 'good' : 'bad', 6000);
          if (ev.on && !d.good) { A.play('crisis'); FX.shake($('boardWrap'), 4, 260); } else if (good) A.play('chime');
          break;
        }
        case 'warning': A.play('warn'); T(`<span class="tk">Warning sign · ${ev.horizon}-term</span>${esc(ev.text)}`, 'bad', 7000); break;
        case 'milestone': {
          A.play('milestone'); FX.flash('#fbbf24');
          const r = $('boardWrap').getBoundingClientRect();
          FX.burst(r.left + r.width / 2, r.top + r.height / 2, null, 60);
          T(ev.kind === 'model' ? `<span class="tk">New model · capability ${ev.at}</span><b>${esc(S.company)} ${esc(ev.name)}</b><br>${esc(ev.blurb)}` : `<span class="tk">Valuation milestone</span><b>${esc(ev.name)}</b><br>${esc(ev.blurb)}`, 'legendary', 7000);
          break;
        }
        case 'era': { const era = FL.ERAS.find((x) => x.id === ev.era); A.play('milestone'); T(`<span class="tk">A new era begins</span><b>${esc(era.name)}</b><br>${esc(era.blurb)}`, 'legendary', 9000); break; }
        case 'funding': A.play(ev.round.ok ? 'cash' : 'crisis'); T(`<span class="tk">${esc(ev.round.name)}</span>${esc(ev.round.text)}`, ev.round.ok ? 'good' : 'bad', 7000); break;
        case 'bridge': A.play('warn'); T(esc(ev.text), 'bad', 7000); break;
        case 'objective': A.play(ev.done ? 'chime' : 'warn'); T(`<span class="tk">Objective ${ev.done ? 'complete' : 'missed'}</span>${esc(ev.text)}`, ev.done ? 'good' : 'bad', 4500); break;
        case 'note': T(`<span class="tk">Analyst note</span>${esc(ev.text)}<br><span class="muted">Could be right. Could be wrong.</span>`, 'info', 8000); break;
        case 'intel': feed(`<b>Intel</b> new read on ${esc(ev.rival)} (${esc(ev.source)})`); break;
        case 'news': feed(`<b>Rival news</b> ${esc(ev.text)}`); break;
        case 'hired': if (ev.auto) feed(`<b>Hired</b> ${esc(ev.name)}, ${esc(ev.headline)}`); break;
        case 'left': T(`<span class="tk">Departure</span>${esc(ev.name)} — ${esc(ev.headline)}`, 'bad', 4500); break;
        case 'leak': A.play('warn'); T('<span class="tk">Leak</span>Internal documents just reached the press.', 'bad', 5000); break;
        case 'offer': feed(`<b>Compute deal on the table</b> ${esc(ev.provider)}: ${esc(ev.kind)}`); break;
        case 'campaign': A.play(ev.best ? 'chime' : ev.worst ? 'warn' : 'click'); T(`<span class="tk">Campaign · ${esc(ev.name)}</span>${esc(ev.label)}`, ev.best ? 'good' : ev.worst ? 'bad' : 'info', 6000); break;
        case 'newGen': T(`<span class="tk">New chips</span>${esc(ev.name)} accelerators are shipping. Everything you own just got older.`, 'info', 6000); break;
        case 'leaseEnded': feed(`<b>Lease ended</b> ${esc(ev.name)}`); break;
        case 'paused': T('<span class="tk">Responsible Scaling Policy</span>Capability has outrun safety. Scaling slowed to a crawl.', 'bad', 6000); break;
        case 'unlock': recordUnlocks({ artifacts: ev.artifact ? [ev.artifact] : [], achievements: ev.achievement ? [ev.achievement] : [] }); break;
        case 'newspaper': {
          const r = (S.newspapers || [])[S.newspapers.length - 1];
          if (r) { lastReport = r; showNewsCard(r); renderTicker(); }
          break;
        }
        case 'ending': handleEnding(ev.ending); break;
      }
    }
  }

  /** Low-stakes events go to the ticker rather than interrupting. */
  let feedItems = [];
  function feed(html) {
    feedItems.unshift(html);
    feedItems = feedItems.slice(0, 6);
    renderTicker();
  }

  function showNewsCard(r) {
    const h = r.headline || {};
    const box = $('newsCard');
    box.innerHTML = `<div class="paper mini ${h.tabloid ? 'tabloid' : ''}" data-action="openNews" data-arg="${r.turn}"><div class="mast"><span>${esc(r.label)}</span><b>${esc(h.paper || 'The Ledger')}</b></div>
      <h1>${esc(h.head || r.label)}</h1><p>${esc(h.sub || '')}</p><span class="muted">Click to read the full edition</span></div>`;
    box.classList.remove('hidden');
    clearTimeout(showNewsCard.t);
    showNewsCard.t = setTimeout(() => box.classList.add('hidden'), 14000);
  }

  function liveRender() {
    UI.renderTopbar();
    UI.renderLeft();
    UI.renderBoard();
    renderInbox();
    // Refresh the inspector unless the player is in the middle of using it.
    const ae = document.activeElement;
    if (++ticksSinceInspect >= 2 && !(ae && (ae.id === 'lvl' || ae.tagName === 'INPUT' || ae.tagName === 'SELECT'))) {
      ticksSinceInspect = 0;
      UI.inspect(selected);
      if (selected && E.nodeType(selected) === 'policy') updatePolicyPreview(E.node(selected).def);
    }
    A.setTension(S.tension || 0);
  }

  let lastInboxPaint = 0;
  function gameLoop(now) {
    requestAnimationFrame(gameLoop);
    const dtMs = lastFrame ? Math.min(400, now - lastFrame) : 0;
    lastFrame = now;
    if (!S || S.ended || (document.hidden && !MP.active())) return;
    let n = 0;
    if (MP.active()) {
      if (MP.isHost()) {
        loopAcc += dtMs * (MP.lobby.settings.speed || 1);
        while (loopAcc >= WEEK_MS && n < 6 && !S.ended) { const r = E.tick(S); if (r) lastReport = r; loopAcc -= WEEK_MS; n++; }
        MP.hostTickBots(S.week);
        if (now - lastClockSent > 1000) { lastClockSent = now; MP.broadcastClock(S.week + loopAcc / WEEK_MS); }
      } else {
        const target = MP.targetWeek(WEEK_MS);
        while (S.week < Math.floor(target) && n < 6 && !S.ended) { const r = E.tick(S); if (r) lastReport = r; n++; }
        loopAcc = Math.max(0, Math.min(WEEK_MS - 1, (target - S.week) * WEEK_MS));
      }
      MP.maybeSnap(S);
    } else {
      loopAcc += dtMs * speed;
      while (loopAcc >= WEEK_MS && n < 6 && !S.ended) { const r = E.tick(S); if (r) lastReport = r; loopAcc -= WEEK_MS; n++; }
    }
    if (n) {
      handleEvents();
      liveRender();
      if (now - lastSave > 5000) { lastSave = now; save(); }
    } else if (S.inbox.length && now - lastInboxPaint > 500) {
      lastInboxPaint = now;
      renderInbox();
    }
    const qp = $('qprog');
    if (qp) qp.style.width = Math.min(100, ((E.weekOfQuarter(S) + loopAcc / WEEK_MS) / E.TICKS_PER_Q) * 100) + '%';
  }
  requestAnimationFrame(gameLoop);

  // ── API used by the CLI bridge (js/bridge.js) ───────────
  UI.state = () => S;
  UI.lastReport = () => lastReport;
  UI.meta = () => meta;
  UI.act = (name, arg) => actions[name](arg);
  UI.refresh = (res) => afterAction(res);
  UI.startNew = (arch, name, diff) => startGame(E.newGame(arch, name, undefined, diff));
  UI.policyChange = function (id, lvl) {
    const st = S.policies[id];
    const r = E.changePolicy(S, id, lvl);
    if (r.ok) {
      S.log.push({ turn: S.turn, text: lvl == null ? `Cancelled ${nameOf(id)}` : `${st ? 'Adjusted' : 'Enacted'} ${nameOf(id)} (${pct(lvl)})` });
      A.play(lvl == null ? 'cancel' : st ? 'click' : 'enact');
      selected = id;
      afterAction(r);
    }
    return r;
  };
  UI.setSpeed = (v) => actions.setSpeed(v);
  UI.speed = () => (MP.active() ? MP.lobby.settings.speed : speed);
  UI.dismiss = function () {
    for (let k = 0; k < 6 && !$('modal').classList.contains('hidden'); k++) {
      const b = $('modalCard').querySelector('[data-action=showEnd], [data-action=closeModal]');
      if (!b) break;
      actions[b.dataset.action](b.dataset.arg);
    }
  };
  UI.advisor = function (text) {
    const box = $('advisor');
    if (!box) return;
    box.classList.remove('hidden');
    box.querySelector('.adv-body').textContent = text;
    A.play('decision');
  };

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
      if (e.key === ' ' && S && !(e.target && /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))) { e.preventDefault(); actions.togglePause(); return; }
      if (/^[1-4]$/.test(e.key) && S && !MP.active() && !(e.target && e.target.tagName === 'INPUT')) { speed = [0.5, 1, 2, 4][+e.key - 1]; UI.renderTopbar(); return; }
      if (e.key === 'm' && !(e.target && e.target.tagName === 'INPUT')) { A.setMuted(!A.isMuted()); if (S) UI.renderTopbar(); return; }
      if (e.key === 'Escape' && !$('modal').classList.contains('hidden') && S && !S.pendingDilemma && !S.ended) closeModal();
      else if (e.key === 'Escape' && S) { selected = null; UI.renderAll(); }
    });

    if (FL.Bridge) FL.Bridge.connect();
    showSplash();
    if (joinPrefill.code) setTimeout(() => { if ($('joinCode')) FX.toast(`Invite to lobby ${esc(joinPrefill.code)}: pick a name and origin, then press Join.`, 'info', 6000); }, 600);
    const saved = loadSave();
    if (saved && !saved.ended) {
      S = saved;
      UI.renderAll();
    }
    UI.showStart();
  };

  FL.UI = UI;
})(globalThis.FL = globalThis.FL || {});
