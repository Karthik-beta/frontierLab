/* fx.js — "juice": count-ups, floating deltas, particle bursts, shake, flashes, toasts.
 * Every effect amplifies a real outcome; nothing here changes the simulation.
 * Respects prefers-reduced-motion. */
(function (FL) {
  'use strict';
  const FX = {};
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  /** Tween a number inside an element, with a small pop for big changes. */
  FX.countUp = function (el, from, to, ms, fmt) {
    if (!el) return;
    fmt = fmt || ((x) => String(Math.round(x)));
    if (reduced() || from === to || !Number.isFinite(from)) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    let lastTick = 0;
    const big = Math.abs(to - from) > Math.max(1, Math.abs(from)) * 0.1;
    if (big) { el.style.transition = 'transform 120ms'; el.style.display = 'inline-block'; el.style.transform = 'scale(1.15)'; }
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      el.textContent = fmt(from + (to - from) * easeOutCubic(t));
      if (FL.Audio && now - lastTick > 45 && t < 1) { lastTick = now; FL.Audio.play('tick', { pitch: t }); }
      if (t < 1) requestAnimationFrame(step);
      else if (big) el.style.transform = 'scale(1)';
    };
    requestAnimationFrame(step);
  };

  /** Floating "+4" text that rises and fades over ~900ms, in SVG user units. */
  FX.floatDelta = function (svg, x, y, text, color, delay) {
    if (!svg || reduced()) return;
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', x); t.setAttribute('y', y);
    t.setAttribute('class', 'float-delta');
    t.setAttribute('fill', color);
    t.style.animationDelay = (delay || 0) + 'ms';
    t.textContent = text;
    svg.appendChild(t);
    setTimeout(() => t.remove(), 1100 + (delay || 0));
  };

  /** Particle burst at viewport coords, with gravity, ~1.2s. Reserved for milestones. */
  FX.burst = function (x, y, colors, n) {
    if (reduced()) return;
    colors = [].concat(colors || ['#7dd3fc', '#fbbf24', '#4ade80', '#f472b6']);
    const layer = document.getElementById('fxLayer');
    if (!layer) return;
    n = n || 48;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      const ang = Math.random() * Math.PI * 2, sp = 140 + Math.random() * 260;
      p.className = 'particle';
      p.style.left = x + 'px'; p.style.top = y + 'px';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', Math.cos(ang) * sp + 'px');
      p.style.setProperty('--dy', Math.sin(ang) * sp - 120 + 'px');
      p.style.setProperty('--rot', Math.random() * 720 - 360 + 'deg');
      layer.appendChild(p);
      setTimeout(() => p.remove(), 1300);
    }
  };

  /** Short decaying shake. Bad news only. */
  FX.shake = function (el, px, ms) {
    if (!el || reduced()) return;
    px = px || 4; ms = ms || 320;
    const t0 = performance.now();
    const step = (now) => {
      const t = (now - t0) / ms;
      if (t >= 1) { el.style.transform = ''; return; }
      const a = px * (1 - t);
      el.style.transform = `translate(${(Math.random() * 2 - 1) * a}px, ${(Math.random() * 2 - 1) * a}px)`;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /** Full-screen color flash at ~10% opacity. */
  FX.flash = function (color) {
    const layer = document.getElementById('fxFlash');
    if (!layer || reduced()) return;
    layer.style.background = color;
    layer.classList.remove('go'); void layer.offsetWidth; layer.classList.add('go');
  };

  /** Stacked toast in the corner. kind: info | good | bad | rare | legendary. */
  FX.toast = function (html, kind, ms) {
    const box = document.getElementById('toasts');
    if (!box) return null;
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || 'info');
    t.innerHTML = html;
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, ms || 4200);
    return t;
  };

  FL.FX = FX;
})(globalThis.FL = globalThis.FL || {});
