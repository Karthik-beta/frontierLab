const test = require('node:test');
const assert = require('node:assert');
const load = require('./load');

const FL = load();
const E = FL.Engine;
const S = FL.Systems;

const ids = (arr) => new Set(arr.map((x) => x.id));
const policyIds = ids(FL.POLICIES), sitIds = ids(FL.SITUATIONS), pitIds = ids(FL.PITFALLS), dilIds = ids(FL.DILEMMAS);
const endings = new Set(['aligned', 'uneasy', 'misaligned', 'lostRace', 'bankrupt', 'ousted', 'shutdown', 'timeout', 'acquihired']);

/** Every trigger key the game can emit must match one of these shapes. */
function validTrigger(k) {
  if (['start', 'epigraph', 'round:first', 'round:ok', 'round:failed', 'bridge', 'profitable', 'rsp:pause', 'rival:release', 'reinstated', 'rival:spawned', 'speedrun', 'objectives:10', 'pitfalls:5', 'archive:25'].includes(k)) return true;
  let m;
  if ((m = k.match(/^start:(\w+)$/))) return FL.ARCHETYPES.some((a) => a.id === m[1]);
  if ((m = k.match(/^(policy|cancel):(\w+)(:max)?$/))) return policyIds.has(m[2]) && !(m[1] === 'cancel' && m[3]);
  if ((m = k.match(/^situation:(\w+)$/))) return sitIds.has(m[1]);
  if ((m = k.match(/^pitfall:(\w+)$/))) return pitIds.has(m[1]);
  if ((m = k.match(/^dilemma:(.+?)(:\d)?$/)) && dilIds.has(m[1])) return true;
  if ((m = k.match(/^model:(\w+)$/))) return FL.MODEL_GENS.some((g) => g.name === m[1]);
  if ((m = k.match(/^tier:(.+)$/))) return FL.VALUATION_TIERS.some((t) => t.name === m[1]);
  if ((m = k.match(/^era:(\w+)$/))) return FL.ERAS.some((e) => e.id === m[1]);
  if ((m = k.match(/^ending:(\w+)$/))) return endings.has(m[1]);
  if ((m = k.match(/^(cap|turn|team):\d+$/))) return true;
  if ((m = k.match(/^dilemma:(.+?):(\d):(win|lose)$/))) return dilIds.has(m[1]);
  if ((m = k.match(/^users:\d+$/))) return true;
  if ((m = k.match(/^opp:(claim|10|wrath:win|wrath:lose)$/))) return true;
  if ((m = k.match(/^world:(\w+)(:spared)?$/))) return FL.WORLD_EVENTS.some((e) => e.id === m[1]);
  if ((m = k.match(/^campaign:(\w+)(:best|:worst|:broke)?$/))) return FL.CAMPAIGNS.some((c) => c.id === m[1]);
  if ((m = k.match(/^practice:(\w+)$/))) return FL.PRACTICES.some((p) => p.id === m[1]);
  if ((m = k.match(/^hire:(\w+)$/))) return ['legend', 'jerk'].includes(m[1]) || FL.ROLES.some((r) => r.id === m[1]);
  if ((m = k.match(/^deal:(\w+)$/))) return m[1] === 'duringShortage' || FL.COMPUTE_OFFERS.some((o) => o.id === m[1]);
  if (['hw:newGen', 'hw:obsolete', 'hw:firstDelivery', 'hw:failures', 'hw:soldAtLoss', 'manager:first', 'people:seniorLeft', 'culture:superpumped', 'valuation:crash', 'ownership:10'].includes(k)) return true;
  return false;
}

test('every archive and achievement trigger is one the game can emit', () => {
  assert.ok(FL.ARCHIVE.length >= 80);
  for (const a of FL.ARCHIVE) for (const t of [].concat(a.trigger)) assert.ok(validTrigger(t), `${a.id}: ${t}`);
  for (const a of FL.ACHIEVEMENTS) assert.ok(validTrigger(a.trigger), `${a.id}: ${a.trigger}`);
});

test('archive ids are unique and every card has a source', () => {
  assert.strictEqual(new Set(FL.ARCHIVE.map((a) => a.id)).size, FL.ARCHIVE.length);
  for (const a of FL.ARCHIVE) assert.ok(a.source && a.summary, a.id);
});

test('every pitfall option resolves without errors and with valid targets', () => {
  for (const p of FL.PITFALLS) {
    assert.ok(['short', 'medium', 'long'].includes(p.horizon), p.id);
    assert.strictEqual(p.warn.length, 2, p.id);
    p.event.options.forEach((o, i) => {
      for (const out of [o, o.chance && o.chance.win, o.chance && o.chance.lose].filter(Boolean)) {
        for (const [to] of out.fx || []) assert.ok(E.node(to), `${p.id} -> ${to}`);
        if (out.cancel) assert.ok(policyIds.has(out.cancel), `${p.id} cancel ${out.cancel}`);
      }
      const s = E.newGame('idealists', 'T', 5 + i);
      s.pendingDilemma = 'pit:' + p.id;
      const r = E.resolveDilemma(s, i);
      assert.ok(typeof r.text === 'string');
    });
  }
});

test('three objectives are dealt at the start and refilled over time', () => {
  const s = E.newGame('defectors', 'T', 11);
  assert.strictEqual(s.objectives.length, 3);
  let dealt = 0;
  for (let i = 0; i < 12 && !s.ended; i++) { const r = E.endTurn(s); dealt += r.objectives.dealt.length; if (s.pendingDilemma) E.resolveDilemma(s, 0); }
  assert.ok(dealt >= 3, `only ${dealt} objectives re-dealt`);
  assert.ok(s.objectives.length >= 1);
  for (const o of s.objectives) assert.ok(o.text && o.deadline > o.dealt);
});

test('pitfalls build up and fire over a normal game', () => {
  let fired = 0, warned = 0;
  for (let seed = 0; seed < 8; seed++) {
    const s = E.newGame('spinout', 'T', seed);
    for (const id of ['consumerApp', 'scraping', 'ceoTour', 'benchmarks', 'hiring']) E.changePolicy(s, id, 0.9);
    while (!s.ended) {
      const r = E.endTurn(s);
      if (!r) break;
      warned += (r.pitfallWarnings || []).length;
      if (s.pendingDilemma) E.resolveDilemma(s, 1);
    }
    fired += Object.keys(s.pitfallsFired).length;
  }
  assert.ok(fired >= 8, `only ${fired} pitfalls fired in 8 games`);
  assert.ok(warned > fired, 'warning signs should precede pitfalls');
});
