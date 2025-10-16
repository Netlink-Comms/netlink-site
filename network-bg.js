// network-bg.js — mobile-friendly looping network background (fixed coordinate bug)
// Drop this file in alongside your <canvas id="net-bg"></canvas>
// Default color: #FF003C (or set <canvas id="net-bg" data-color="#FF003C">)
// NOTE: fixed the mobile bug where drawing used mixed coordinate spaces (dividing by DPR).

(function () {
  'use strict';

  const DEFAULT_COLOR = '#FF003C';

  const BASE_DOT_RADIUS = 2;
  const BASE_SPEED = 0.05;
  const BASE_MAX_LINK_DIST = 150;
  const BASE_AREA_PER_PARTICLE = 9000;
  const MIN_PARTICLES = 20;
  const MAX_PARTICLES = 100;

  const MOBILE_MAX_DPR = 1.5;
  const MOBILE_FPS = 60;
  const DESKTOP_FPS = 60;

  const canvas = document.getElementById('net-bg');
  if (!canvas) {
    console.warn('network-bg.js: no canvas#net-bg found');
    return;
  }
  const ctx = canvas.getContext('2d', { alpha: true });

  const ua = navigator.userAgent || '';
  const isMobileUA = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua);
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  const saveData = connection && connection.saveData;
  const effectiveType = connection && connection.effectiveType ? connection.effectiveType : '';
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let DPR = Math.max(1, window.devicePixelRatio || 1);
  let width = 0, height = 0;
  let particles = [];
  let maxLinkDist = BASE_MAX_LINK_DIST;
  let running = true;

  const isMobile = isMobileUA || window.innerWidth <= 720;
  const targetFPS = prefersReducedMotion ? 12 : (isMobile ? MOBILE_FPS : DESKTOP_FPS);
  const minFrameMs = 1000 / targetFPS;
  let lastRender = performance.now();

  let DOT_RADIUS = BASE_DOT_RADIUS;
  let SPEED = BASE_SPEED;
  let AREA_PER_PARTICLE = BASE_AREA_PER_PARTICLE;
  let MAX_PARTICLES_ADJ = MAX_PARTICLES;
  let MAX_LINK_DIST = BASE_MAX_LINK_DIST;

  const COLOR = (canvas.dataset && canvas.dataset.color) ? canvas.dataset.color : DEFAULT_COLOR;

  function Particle(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.phase = Math.random() * Math.PI * 2;
  }

  Particle.prototype.step = function (dt) {
    // dt in ms, vx/vy are device-pixel-per-ms
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.x < 0) this.x += width;
    else if (this.x >= width) this.x -= width;
    if (this.y < 0) this.y += height;
    else if (this.y >= height) this.y -= height;
  };

  function clampDPR() {
    DPR = Math.max(1, window.devicePixelRatio || 1);
    if (isMobile || saveData || effectiveType === '2g' || effectiveType === 'slow-2g') {
      DPR = Math.min(DPR, MOBILE_MAX_DPR);
    } else {
      DPR = Math.min(DPR, 2);
    }
  }

  function tuneForEnvironment() {
    if (prefersReducedMotion) {
      DOT_RADIUS = BASE_DOT_RADIUS * 0.7;
      SPEED = BASE_SPEED * 0.35;
      AREA_PER_PARTICLE = BASE_AREA_PER_PARTICLE * 3.5;
      MAX_PARTICLES_ADJ = 60;
      MAX_LINK_DIST = BASE_MAX_LINK_DIST * 0.7;
    } else if (saveData || effectiveType === '2g' || effectiveType === 'slow-2g') {
      DOT_RADIUS = BASE_DOT_RADIUS * 0.8;
      SPEED = BASE_SPEED * 0.6;
      AREA_PER_PARTICLE = BASE_AREA_PER_PARTICLE * 2;
      MAX_PARTICLES_ADJ = 80;
      MAX_LINK_DIST = BASE_MAX_LINK_DIST * 0.8;
    } else if (isMobile) {
      DOT_RADIUS = BASE_DOT_RADIUS * 0.9;
      SPEED = BASE_SPEED * 0.85;
      AREA_PER_PARTICLE = BASE_AREA_PER_PARTICLE * 1.6;
      MAX_PARTICLES_ADJ = 120;
      MAX_LINK_DIST = BASE_MAX_LINK_DIST * 0.95;
    } else {
      DOT_RADIUS = BASE_DOT_RADIUS;
      SPEED = BASE_SPEED;
      AREA_PER_PARTICLE = BASE_AREA_PER_PARTICLE;
      MAX_PARTICLES_ADJ = MAX_PARTICLES;
      MAX_LINK_DIST = BASE_MAX_LINK_DIST;
    }
  }

  function resize() {
    clampDPR();
    tuneForEnvironment();

    const cssW = Math.max(1, window.innerWidth);
    const cssH = Math.max(1, window.innerHeight);

    // Keep canvas internal (width/height) in device pixels.
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * DPR);
    canvas.height = Math.round(cssH * DPR);

    width = canvas.width;
    height = canvas.height;

    maxLinkDist = Math.round(MAX_LINK_DIST * DPR);

    const area = cssW * cssH;
    let count = Math.round(area / AREA_PER_PARTICLE);
    count = Math.max(MIN_PARTICLES, Math.min(MAX_PARTICLES_ADJ, count));

    if (!particles.length || Math.abs(particles.length - count) > 6) {
      particles = [];
      for (let i = 0; i < count; i++) particles.push(randomParticle());
    } else {
      for (let p of particles) {
        p.x = (p.x % width + width) % width;
        p.y = (p.y % height + height) % height;
      }
    }

    // Use lineWidth in device pixels
    ctx.lineWidth = Math.max(1, DPR * 0.9 * (isMobile ? 0.9 : 1));
  }

  function randomParticle() {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const angle = Math.random() * Math.PI * 2;
    // vx/vy are device-pixels per ms (speed * DPR scales to device pixels)
    const speed = (Math.random() * 0.6 + 0.2) * SPEED * DPR;
    return new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  function clear() {
    ctx.clearRect(0, 0, width, height);
  }

  function toroidalDelta(aCoord, bCoord, span) {
    let d = bCoord - aCoord;
    if (d > span / 2) d -= span;
    else if (d < -span / 2) d += span;
    return d;
  }

  // Draw using device-pixel coordinates (DO NOT divide by DPR)
  function drawDotDevice(xDevice, yDevice) {
    ctx.beginPath();
    ctx.arc(xDevice, yDevice, DOT_RADIUS * DPR, 0, Math.PI * 2);
    ctx.fillStyle = COLOR;
    ctx.fill();
  }

  const PULSE_FREQ = 0.0018;

  function render(now) {
    if (!running) return;

    const elapsedSinceRender = now - lastRender;
    if (elapsedSinceRender < minFrameMs) {
      requestAnimationFrame(render);
      return;
    }
    const dt = Math.min(40, elapsedSinceRender);
    lastRender = now;

    for (let p of particles) p.step(dt);

    clear();

    const n = particles.length;
    const widthF = width;
    const heightF = height;
    const maxDistSq = maxLinkDist * maxLinkDist;
    const timeFactor = now * PULSE_FREQ;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < n; i++) {
      const a = particles[i];
      // draw dot in device pixels
      drawDotDevice(a.x, a.y);

      for (let j = i + 1; j < n; j++) {
        const b = particles[j];
        const dx = toroidalDelta(a.x, b.x, widthF);
        const dy = toroidalDelta(a.y, b.y, heightF);

        const distSq = dx * dx + dy * dy;
        if (distSq > maxDistSq) continue;

        const dist = Math.sqrt(distSq);
        const baseAlpha = 1 - dist / maxLinkDist;
        const pulse = 0.5 + 0.5 * Math.sin(timeFactor + a.phase + b.phase);
        const alpha = Math.min(1, Math.max(0, baseAlpha * pulse));
        if (alpha <= 0.003) continue;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + dx, a.y + dy);
        ctx.strokeStyle = hexToRgba(COLOR, alpha * 0.95);
        ctx.stroke();
      }
    }

    requestAnimationFrame(render);
  }

  function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function handleVisibility() {
    if (document.hidden) running = false;
    else {
      if (!running) {
        running = true;
        lastRender = performance.now();
        requestAnimationFrame(render);
      }
    }
  }

  function throttle(fn, wait) {
    let t = 0;
    return function (...args) {
      const now = Date.now();
      if (now - t >= wait) {
        t = now;
        fn.apply(this, args);
      }
    };
  }

  function init() {
    resize();
    window.addEventListener('resize', throttle(resize, 160), { passive: true });
    document.addEventListener('visibilitychange', handleVisibility, false);
    lastRender = performance.now();
    requestAnimationFrame(render);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();