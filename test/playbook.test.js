const test = require('node:test');
const assert = require('node:assert');
const load = require('./load');
const FL = load();
const E = FL.Engine, P = FL.Playbook;

test('playbook: max three plays, costs bandwidth, and hooks move the engine', () => {
  const s = E.newGame('spinout', 'T', 41);
  s.bandwidth = 20;
  const costsBefore = E.computeFinances(s).costs;
  const bwBefore = E.bandwidthIncome(s);
  const r = P.set(s, ['defaultAlive', 'letFiresBurn', 'raiseTooMuch', 'embraceChaos']);
  assert.ok(r.ok);
  assert.strictEqual(s.plays.length, 3);
  assert.strictEqual(s.bandwidth, 17);
  assert.ok(E.computeFinances(s).costs < costsBefore, 'default-alive discipline cuts costs');
  assert.ok(E.bandwidthIncome(s) > bwBefore, 'letting fires burn frees leadership time');
  assert.strictEqual(P.mod(s, 'raise', 1), 1.3);
  E.updateNetwork(s, true);
  assert.ok(s.extra.playbook && s.extra.playbook.board > 0);
});

test('every play can be committed and the game keeps running', () => {
  for (const p of FL.PLAYS) {
    const s = E.newGame('defectors', 'T', 50);
    s.bandwidth = 20;
    assert.ok(P.set(s, [p.id]).ok, p.id);
    for (let i = 0; i < 3 && !s.ended; i++) { E.endTurn(s); while (s.pendingDilemma && !s.ended) E.resolveDilemma(s, 0); }
    assert.ok(Number.isFinite(s.cash), p.id);
  }
});
