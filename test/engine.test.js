const test = require('node:test');
const assert = require('node:assert');
const load = require('./load');

const FL = load();
const E = FL.Engine;

function noNaN(obj, path = 'state') {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number') assert.ok(Number.isFinite(v), `${path}.${k} is ${v}`);
    else if (v && typeof v === 'object') noNaN(v, `${path}.${k}`);
  }
}

test('node ids are unique and every effect edge resolves', () => {
  assert.ok(Object.keys(E.nodes()).length > 60);
  assert.ok(E.allEffects().length > 100);
});

test('newGame produces a finite state for every archetype', () => {
  for (const a of FL.ARCHETYPES) {
    const s = E.newGame(a.id, 'Test', 7);
    noNaN(s);
    assert.strictEqual(s.turn, 1);
    for (const st of FL.STATS) assert.ok(s.values[st.id] >= 0 && s.values[st.id] <= 1);
  }
});

test('same seed and same choices replay identically', () => {
  const run = () => {
    const s = E.newGame('defectors', 'T', 42);
    for (let i = 0; i < 10 && !s.ended; i++) { E.endTurn(s); if (s.pendingDilemma) E.resolveDilemma(s, 0); }
    return E.serialize(s);
  };
  assert.strictEqual(run(), run());
});

test('policy changes are priced against start of turn and reverting refunds', () => {
  const s = E.newGame('defectors', 'T', 1);
  s.bandwidth = 30;
  const intro = E.node('pretrain').def.intro;
  assert.ok(E.implementPolicy(s, 'pretrain', 0.5).ok);
  assert.strictEqual(s.bandwidth, 30 - intro);
  assert.ok(E.adjustPolicy(s, 'pretrain', 1).ok); // still a new implementation this turn: no extra cost
  assert.strictEqual(s.bandwidth, 30 - intro);
  assert.ok(E.cancelPolicy(s, 'pretrain').ok);
  assert.strictEqual(s.bandwidth, 30);
  assert.ok(!s.policies.pretrain);
  // existing policy: adjust then revert is free
  const before = s.bandwidth;
  E.adjustPolicy(s, 'comp', 1);
  assert.ok(s.bandwidth < before);
  E.adjustPolicy(s, 'comp', 0.5);
  assert.strictEqual(s.bandwidth, before);
});

test('cannot spend bandwidth you do not have', () => {
  const s = E.newGame('defectors', 'T', 1);
  s.bandwidth = 2;
  const r = E.implementPolicy(s, 'datacenters', 0.5);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(s.bandwidth, 2);
});

test('every dilemma condition evaluates and option targets exist', () => {
  const s = E.newGame('spinout', 'T', 3);
  for (const d of FL.DILEMMAS) {
    assert.strictEqual(typeof d.when(s, E), 'boolean', d.id);
    for (const o of d.options) {
      const outs = [o, o.chance && o.chance.win, o.chance && o.chance.lose].filter(Boolean);
      for (const out of outs) for (const [to] of out.fx || []) assert.ok(E.node(to), `${d.id} -> ${to}`);
      if (o.enact) assert.strictEqual(E.nodeType(o.enact[0]), 'policy');
    }
  }
});

test('an idle game always ends by the turn limit', () => {
  for (let seed = 0; seed < 10; seed++) {
    const s = E.newGame('spinout', 'T', seed);
    let n = 0;
    while (!s.ended && n++ < 60) { E.endTurn(s); if (s.pendingDilemma) E.resolveDilemma(s, 1); }
    assert.ok(s.ended, 'game did not end');
    assert.ok(s.turn <= E.MAX_TURNS + 1);
    noNaN(s);
  }
});
