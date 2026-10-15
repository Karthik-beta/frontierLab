const test = require('node:test');
const assert = require('node:assert');
const load = require('./load');

const FL = load();
const E = FL.Engine, H = FL.Hardware, R = FL.Hiring;

test('achievement and archive ids are unique', () => {
  const ach = FL.ACHIEVEMENTS.map((a) => a.id);
  assert.strictEqual(new Set(ach).size, ach.length);
  assert.ok(FL.ACHIEVEMENTS.length >= 50);
  assert.ok(FL.ARCHIVE.length >= 120);
});

test('difficulty changes starting cash and rival pace', () => {
  const easy = E.newGame('defectors', 'T', 1, 'easy');
  const real = E.newGame('defectors', 'T', 1, 'realistic');
  assert.ok(easy.cash > real.cash);
  assert.ok(E.diff(easy).rivalPace < E.diff(real).rivalPace);
});

test('datacenter spend becomes owned pods after the build delay', () => {
  const s = E.newGame('idealists', 'T', 2);
  const before = s.hw.fleet.reduce((a, c) => a + c.pods, 0);
  E.changePolicy(s, 'datacenters', 0.6);
  for (let i = 0; i < 5; i++) { E.endTurn(s); if (s.pendingDilemma) E.resolveDilemma(s, 1); }
  const after = s.hw.fleet.reduce((a, c) => a + c.pods, 0);
  assert.ok(after > before + 5, `fleet ${before} -> ${after}`);
});

test('hardware wears out and relative compute falls without investment', () => {
  const s = E.newGame('upstarts', 'T', 3);
  s.cash = 1e6;
  const pods0 = s.hw.fleet[0].pods;
  const ratio0 = H.summary(s).ratio;
  for (let i = 0; i < 16; i++) { E.endTurn(s); if (s.pendingDilemma) E.resolveDilemma(s, 1); s.cash = 1e6; }
  assert.ok(s.hw.fleet.length === 0 || s.hw.fleet[0].pods < pods0, 'pods should fail over time');
  assert.ok(H.summary(s).ratio < ratio0, 'need outgrows a static fleet');
});

test('every compute deal can be signed', () => {
  for (const tpl of FL.COMPUTE_OFFERS) {
    const s = E.newGame('spinout', 'T', 4);
    s.turn = 10; s.bandwidth = 40; s.cash = 1e5;
    const o = H.priceOffer(s, tpl);
    s.hw.offers.push(o);
    const r = H.acceptOffer(s, o.id);
    assert.ok(r.ok, `${tpl.id}: ${r.reason}`);
    assert.ok(Number.isFinite(E.computeFinances(s).costs));
  }
});

test('hiring: offers, toxicity from an all-Uber culture, and the culture reset', () => {
  const s = E.newGame('defectors', 'T', 5);
  s.bandwidth = 40;
  const n0 = s.people.roster.length;
  for (const c of s.people.feed.slice()) R.makeOffer(s, c.id);
  assert.ok(s.people.roster.length >= n0, 'roster never shrinks from offers');
  R.setValues(s, ['alwaysHustlin', 'toeStepping', 'superpumped']);
  assert.ok(R.toxicityFlow(s) > 0.01, `flow ${R.toxicityFlow(s)}`);
  for (let i = 0; i < 6; i++) { s.bandwidth = 40; E.endTurn(s); while (s.pendingDilemma) E.resolveDilemma(s, 0); }
  assert.ok(s.people.toxicity > 0.12, `toxicity ${s.people.toxicity}`);
  R.cultureReset(s);
  assert.ok(!s.people.values.some((v) => FL.CULTURE_VALUES.find((x) => x.id === v).uber));
  assert.ok(R.toxicityFlow(s) < 0.03);
});

test('team bonus feeds stats through the extra-input hook', () => {
  const s = E.newGame('defectors', 'T', 6);
  assert.ok(s.extra.team && s.extra.team.safety > 0);
  assert.ok(s.extra.hardware && s.extra.hardware.compute > 0);
});

test('real time: 13 weekly ticks make a quarter, and decisions expire to their default', () => {
  const s = E.newGame('defectors', 'T', 9);
  assert.strictEqual(s.turn, 1);
  for (let i = 0; i < 12; i++) assert.strictEqual(E.tick(s), null);
  const r = E.tick(s);
  assert.ok(r && r.label, 'quarter report at week 13');
  assert.strictEqual(s.turn, 2);
  E.addDecision(s, 'gpuPrepay', 2);
  const before = s.inbox.length;
  E.tick(s); E.tick(s);
  assert.ok(s.inbox.length < before, 'expired decision left the inbox');
  assert.ok(s.events.some((e) => e.type === 'expired'));
});

test('fog: rival estimates carry uncertainty and safety is an estimate', () => {
  const s = E.newGame('spinout', 'T', 10);
  for (let i = 0; i < 3; i++) E.endTurn(s);
  const est = FL.Fog.rivalEstimate(s, s.rivals[0]);
  assert.ok(est.sd > 0);
  const m = FL.Fog.measured(s, 'safety');
  assert.ok(m.sd > 0 && m.kind === 'eval estimate');
  const view = FL.Fog.view(s);
  assert.ok(!('cap' in view.rivals[0]), 'the view never exposes true rival capability');
});

test('worlds differ between seeds', () => {
  const a = E.newGame('defectors', 'T', 1), b = E.newGame('defectors', 'T', 2);
  assert.notDeepStrictEqual(a.world.traits, b.world.traits.length ? b.world.traits : ['x']);
  assert.ok(a.world.mult.some((m, i) => Math.abs(m - b.world.mult[i]) > 0.05));
});
