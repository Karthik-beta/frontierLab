/* hardware.js — the GPU fleet: chip generations, purchases, leases, failures, depreciation,
 * power limits and compute deals offered by providers. Feeds the Compute Capacity stat.
 *
 * Units: 1 pod = 1,000 accelerators. "perf-units" = pods x generation perf.
 * Spend comes from policies: Build Own Datacenters (capex, online after a build delay),
 * GPU Spot Buying (rented for the quarter), Exclusive Cloud Partnership (leased block),
 * Nuclear & Energy Deals (power), Custom Silicon (cheaper purchases once mature). */
(function (FL) {
  'use strict';
  const E = FL.Engine;
  const H = {};
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const cfg = () => FL.HW;
  const strength = (state, id) => (state.policies[id] ? 0.2 + 0.8 * state.policies[id].level : 0);
  const genById = (id) => FL.CHIP_GENS.find((g) => g.id === id);
  H.genById = genById;

  H.currentGen = function (state) {
    let g = FL.CHIP_GENS[0];
    for (const x of FL.CHIP_GENS) if (state.turn >= x.turn) g = x;
    return g;
  };
  H.genBack = function (state, n) {
    const i = FL.CHIP_GENS.indexOf(H.currentGen(state));
    return FL.CHIP_GENS[Math.max(0, i - n)];
  };

  /** Purchase-price multiplier: custom silicon cuts prices once it has matured. */
  H.priceMult = function (state) {
    const c = state.policies.chips;
    return c && state.turn - c.since >= 6 ? 1 - 0.3 * strength(state, 'chips') : 1;
  };
  H.lifeQuarters = (state) => (state.difficulty === 'realistic' ? 12 : state.difficulty === 'easy' ? 24 : cfg().lifeQuarters);

  H.init = function (state, arch) {
    state.hw = { fleet: [], pipeline: [], leases: [], offers: [], power: cfg().basePower, spotPerf: 0, nextId: 1, gen: null };
    for (const f of (arch && arch.fleet) || []) {
      const g = genById(f.gen);
      state.hw.fleet.push({ id: state.hw.nextId++, gen: g.id, pods: f.pods, acquired: -4, health: 1, cost: f.pods * g.price, book: f.pods * g.price * 0.8 });
    }
  };

  H.frontierNeed = (state) => cfg().needBase * Math.pow(cfg().needGrowth, state.turn - 1);

  /** Power demanded by owned clusters vs capacity. Leased compute brings its own power. */
  H.powerDemand = (state) => state.hw.fleet.reduce((a, c) => a + c.pods * genById(c.gen).power, 0);
  H.utilization = (state) => {
    const d = H.powerDemand(state);
    return d <= state.hw.power ? 1 : state.hw.power / d;
  };

  H.ownedPerf = (state) => state.hw.fleet.reduce((a, c) => a + c.pods * genById(c.gen).perf * c.health, 0) * H.utilization(state);
  H.leasedPerf = (state) => state.hw.leases.reduce((a, l) => a + l.perf, 0);
  H.cloudPerf = (state) => H.frontierNeed(state) * (state.policies.cloudDeal ? 0.12 + 0.3 * strength(state, 'cloudDeal') : 0);

  H.effectiveCompute = function (state) {
    if (!state.hw) return 0;
    return H.ownedPerf(state) + H.leasedPerf(state) + state.hw.spotPerf + H.cloudPerf(state);
  };

  /** ratio 1 (enough for the frontier) -> +0.55; every doubling ~ +0.12. */
  H.computeBonus = function (state) {
    if (!state.hw) return 0;
    const r = H.effectiveCompute(state) / H.frontierNeed(state);
    if (r <= 0) return 0;
    return clamp(0.55 + 0.12 * Math.log2(r), 0, 0.85);
  };

  /** Quarterly cash costs that are not policies: power & upkeep, lease obligations, purchase commitments. */
  H.costItems = function (state) {
    if (!state.hw) return [];
    const items = [];
    const opex = H.powerDemand(state) * H.utilization(state) * cfg().opexPerMW;
    if (opex > 0.5) items.push({ label: 'Datacenter power & upkeep', amount: opex, color: '#38bdf8' });
    const lease = state.hw.leases.reduce((a, l) => a + (l.perQuarter || 0), 0);
    if (lease > 0.5) items.push({ label: 'Compute lease commitments', amount: lease, color: '#0ea5e9' });
    const commit = state.hw.pipeline.filter((p) => p.commitment && p.payLeft > 0).reduce((a, p) => a + p.payPerQuarter, 0);
    if (commit > 0.5) items.push({ label: 'Chip purchase commitments', amount: commit, color: '#0284c7' });
    return items;
  };

  /** Failure fraction per quarter by age (bathtub): infant mortality, steady state, wear-out. */
  H.failRate = function (state, ageQ) {
    const base = ageQ < 2 ? 0.02 : ageQ < 12 ? 0.008 : 0.008 + 0.004 * (ageQ - 12);
    const infra = FL.Hiring && FL.Hiring.reliabilityBonus ? FL.Hiring.reliabilityBonus(state) : 0;
    return Math.min(0.25, base * E.diff(state).failureMult * (1 - infra));
  };

  H.bookValue = (state) => (state.hw ? state.hw.fleet.reduce((a, c) => a + c.book, 0) : 0);

  /** One quarter of fleet dynamics. Called after the quarter's cash has been paid. */
  /** dt quarters of fleet dynamics (one game week in real time). Times are in quarters (state.t). */
  H.update = function (state, report, dt) {
    dt = dt || 1;
    const hw = state.hw;
    if (!hw) return null;
    const now = state.t || 0;
    const res = report.hardware || (report.hardware = { delivered: 0, failed: 0, expired: [], newGen: null });
    const gen = H.currentGen(state);
    if (hw.gen !== gen.id) { hw.gen = gen.id; if (now > 0) { res.newGen = gen.name; E.emit(state, { type: 'newGen', name: gen.name }); res.newGenNow = true; } }

    for (const p of hw.pipeline) if (p.commitment && p.payLeft > 0) p.payLeft -= dt;

    // Deliveries
    hw.pipeline = hw.pipeline.filter((p) => {
      if (p.ready > now || (p.commitment && p.payLeft > 1e-9)) return true;
      hw.fleet.push({ id: hw.nextId++, gen: p.gen, pods: p.pods, acquired: now, health: p.health || 1, cost: p.cost, book: p.cost });
      res.delivered += p.pods;
      res.deliveredNow = true;
      return false;
    });

    // Datacenter capex buys current-gen pods continuously; each month's purchases come online together.
    if (state.policies.datacenters) {
      const capex = E.policyCost(state, 'datacenters') * dt;
      const pods = capex / (gen.price * H.priceMult(state));
      const ready = now + cfg().buildQuarters;
      const last = hw.pipeline[hw.pipeline.length - 1];
      if (last && !last.commitment && last.gen === gen.id && ready - last.ready < 0.34) { last.pods += pods; last.cost += capex; }
      else hw.pipeline.push({ gen: gen.id, pods, ready, cost: capex });
      hw.power += pods * gen.power * cfg().dcPowerShare;
    }
    if (state.policies.energy) hw.power += E.policyCost(state, 'energy') * cfg().mwPerEnergyDollar * dt;

    // Spot rentals for the coming quarter.
    hw.spotPerf = state.policies.gpuSpot ? (E.policyCost(state, 'gpuSpot') / (gen.price * cfg().spotRate)) * gen.perf : 0;

    // Failures and depreciation.
    const life = H.lifeQuarters(state);
    let failedNow = 0;
    for (const c of hw.fleet) {
      const lost = c.pods * H.failRate(state, now - c.acquired) * dt;
      const share = lost / Math.max(c.pods, 1e-9);
      c.pods -= lost;
      failedNow += lost;
      c.book = Math.max(0, c.book * (1 - share) - (c.cost / life) * dt);
    }
    res.failed += failedNow;
    hw.fleet = hw.fleet.filter((c) => c.pods > 0.05);

    hw.leases = hw.leases.filter((l) => {
      if (l.until > now) return true;
      res.expired.push(l.name);
      E.emit(state, { type: 'leaseEnded', name: l.name });
      return false;
    });

    hw.failedTotal = (hw.failedTotal || 0) + failedNow;
    H.rollOffers(state, res, dt);
    if (report) {
      const T = (k) => FL.Systems && FL.Systems.fireTrigger(state, k, report);
      if (res.newGenNow) {
        res.newGenNow = false;
        T('hw:newGen');
        const old = hw.fleet.filter((c) => FL.CHIP_GENS.indexOf(genById(c.gen)) <= FL.CHIP_GENS.indexOf(gen) - 2).reduce((a, c) => a + c.pods, 0);
        if (old >= 10) T('hw:obsolete');
      }
      if (res.deliveredNow) { res.deliveredNow = false; T('hw:firstDelivery'); }
      if (hw.failedTotal >= 10) T('hw:failures');
    }
    return res;
  };

  // ── Deals ────────────────────────────────────────────────
  H.priceOffer = function (state, tpl) {
    const gen = tpl.genBack ? H.genBack(state, tpl.genBack) : H.currentGen(state);
    const need = H.frontierNeed(state);
    const perfPerPod = gen.perf * (tpl.perfMult || 1);
    const pods = tpl.size ? (need * tpl.size) / perfPerPod : 0;
    const o = { id: 'o' + state.turn + '-' + tpl.id, tpl: tpl.id, provider: tpl.provider, kind: tpl.kind, text: tpl.text, gen: gen.id, genName: gen.name,
      pods, perf: pods * perfPerPod, term: tpl.term, expires: (state.t || 0) + 2, bandwidth: 2 };
    const scale = Math.pow(1.06, state.turn - 1);
    if (tpl.pay === 'lease') { o.perQuarter = pods * gen.price * tpl.rate; o.summary = `${Math.round(pods)} pods of ${gen.name} for ${tpl.term} quarters at ${E.fmtMoney(o.perQuarter)}/q (take-or-pay)`; }
    if (tpl.pay === 'equity') { o.dilution = tpl.dilution; o.summary = `${Math.round(pods)} pods of ${gen.name} for ${tpl.term} quarters, paid with ${tpl.dilution}% of the company`; }
    if (tpl.pay === 'upfront' && tpl.mw) { o.cost = tpl.cost * scale; o.mw = tpl.mw; o.summary = `+${tpl.mw} MW of firm power for ${E.fmtMoney(o.cost)} up front`; }
    if (tpl.pay === 'upfront' && !tpl.mw) { o.cost = pods * gen.price * tpl.discount; o.health = tpl.health; o.summary = `${Math.round(pods)} used ${gen.name} pods (${Math.round(tpl.health * 100)}% health) for ${E.fmtMoney(o.cost)}`; }
    if (tpl.pay === 'vendor') {
      const next = FL.CHIP_GENS[Math.min(FL.CHIP_GENS.length - 1, FL.CHIP_GENS.indexOf(gen) + 1)];
      o.cash = tpl.cash * scale;
      o.commitCost = o.cash * (1 + tpl.commitPods);
      o.commitPods = o.commitCost / next.price;
      o.commitGen = next.id;
      o.summary = `+${E.fmtMoney(o.cash)} investment now; you commit ${E.fmtMoney(o.commitCost)} to ${next.name} chips over ${tpl.term} quarters`;
    }
    return o;
  };

  /** Each quarter there is a chance of a new offer; offers expire after two quarters. */
  H.rollOffers = function (state, res, dt) {
    dt = dt || 1;
    const hw = state.hw;
    hw.offers = hw.offers.filter((o) => o.expires > (state.t || 0));
    if (hw.offers.length >= 3 || state.turn < 2 || E.rand(state) > 0.4 * dt) return;
    const pool = FL.COMPUTE_OFFERS.filter((t) => !hw.offers.some((o) => o.tpl === t.id));
    if (!pool.length) return;
    const o = H.priceOffer(state, pool[Math.floor(E.rand(state) * pool.length)]);
    hw.offers.push(o);
    if (res) res.offer = o;
    E.emit(state, { type: 'offer', provider: o.provider, kind: o.kind });
  };

  H.acceptOffer = function (state, offerId) {
    const hw = state.hw;
    const o = hw.offers.find((x) => x.id === offerId);
    if (!o) return { ok: false, reason: 'That offer has expired.' };
    if (state.bandwidth < o.bandwidth) return { ok: false, reason: `Needs ${o.bandwidth} bandwidth.` };
    if (o.cost && state.cash < o.cost) return { ok: false, reason: `Needs ${E.fmtMoney(o.cost)} cash.` };
    const tpl = FL.COMPUTE_OFFERS.find((t) => t.id === o.tpl);
    state.bandwidth -= o.bandwidth;
    if (tpl.pay === 'lease' || tpl.pay === 'equity') hw.leases.push({ name: `${o.provider} (${o.kind})`, perf: o.perf, until: (state.t || 0) + o.term, perQuarter: o.perQuarter || 0, gen: o.gen });
    if (tpl.pay === 'equity') state.ownership = (state.ownership || 100) * (1 - o.dilution / 100);
    if (tpl.pay === 'upfront' && o.mw) { state.cash -= o.cost; hw.power += o.mw; }
    if (tpl.pay === 'upfront' && !o.mw) { state.cash -= o.cost; hw.fleet.push({ id: hw.nextId++, gen: o.gen, pods: o.pods, acquired: (state.t || 0) - 10, health: o.health, cost: o.cost, book: o.cost }); }
    if (tpl.pay === 'vendor') {
      state.cash += o.cash;
      hw.pipeline.push({ gen: o.commitGen, pods: o.commitPods, ready: (state.t || 0) + o.term, cost: o.commitCost, commitment: true, payLeft: o.term, payPerQuarter: o.commitCost / o.term });
    }
    (tpl.fx || []).forEach(([to, amt, turns]) => state.shocks.push({ to, amt, turns: turns || 4, left: turns || 4 }));
    if (tpl.meter) state.meters[tpl.meter[0]] = (state.meters[tpl.meter[0]] || 0) + tpl.meter[1];
    hw.offers = hw.offers.filter((x) => x.id !== offerId);
    state.log.push({ turn: state.turn, text: `Signed: ${o.provider} — ${o.kind}` });
    const res = { ok: true, artifacts: [], achievements: [] };
    if (FL.Systems) {
      FL.Systems.fireTrigger(state, 'deal:' + tpl.id, res);
      if (state.active.gpuCrunch) FL.Systems.fireTrigger(state, 'deal:duringShortage', res);
    }
    return res;
  };

  /** Sell an owned cluster on the secondary market. Older generations fetch much less. */
  H.salePrice = function (state, c) {
    const g = genById(c.gen);
    return c.pods * g.price * c.health * 0.45 * Math.pow(g.perf / H.currentGen(state).perf, 0.6);
  };
  H.sellCluster = function (state, clusterId) {
    const hw = state.hw;
    const c = hw.fleet.find((x) => x.id === +clusterId);
    if (!c) return { ok: false, reason: 'No such cluster.' };
    const price = H.salePrice(state, c);
    state.cash += price;
    hw.fleet = hw.fleet.filter((x) => x !== c);
    state.log.push({ turn: state.turn, text: `Sold ${Math.round(c.pods)} ${genById(c.gen).name} pods for ${E.fmtMoney(price)}` });
    const res = { ok: true, price, artifacts: [], achievements: [] };
    if (FL.Systems && price < c.cost * 0.5) FL.Systems.fireTrigger(state, 'hw:soldAtLoss', res);
    return res;
  };

  H.summary = function (state) {
    const need = H.frontierNeed(state), eff = H.effectiveCompute(state);
    return { need, eff, ratio: eff / need, owned: H.ownedPerf(state), leased: H.leasedPerf(state), cloud: H.cloudPerf(state), spot: state.hw.spotPerf,
      power: state.hw.power, demand: H.powerDemand(state), utilization: H.utilization(state), book: H.bookValue(state), gen: H.currentGen(state) };
  };

  E.registerInput('hardware', 'GPU fleet vs frontier need', (state) => ({ compute: H.computeBonus(state) }));

  FL.Hardware = H;
})(globalThis.FL = globalThis.FL || {});
