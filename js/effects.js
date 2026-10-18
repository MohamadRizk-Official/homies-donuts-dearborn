/* Homie's Donuts — playful effects
 * sprinkle bursts on buttons · seamless category marquee · draggable donut balloons ·
 * drifting swirls · card hover tilt · scroll-triggered truck · desktop-friendly call button
 * Everything respects prefers-reduced-motion.
 */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer: fine)').matches;
  var SPRINKLE_COLORS = ['#ef4f93', '#ffc83d', '#5fc2ef', '#7ad36b', '#ff8a3d', '#cbb9ff'];

  /* ---------- 1. sprinkle burst from a button's bottom edge ---------- */
  function burst(btn) {
    if (reduce || btn._bursting) return;
    btn._bursting = true; setTimeout(function () { btn._bursting = false; }, 450);
    var band = btn.querySelector(':scope > .burst-band');
    if (!band) { band = document.createElement('span'); band.className = 'burst-band'; band.setAttribute('aria-hidden', 'true'); btn.appendChild(band); }
    for (var i = 0; i < 12; i++) {
      var s = document.createElement('i');
      s.style.setProperty('--c', SPRINKLE_COLORS[i % SPRINKLE_COLORS.length]);
      s.style.setProperty('--x', (6 + Math.random() * 88).toFixed(1) + '%');
      s.style.setProperty('--dx', ((Math.random() - 0.5) * 22).toFixed(1) + 'px');
      s.style.setProperty('--dy', (8 + Math.random() * 10).toFixed(1) + 'px');
      s.style.setProperty('--r', Math.round(Math.random() * 180) + 'deg');
      s.style.setProperty('--rr', Math.round(Math.random() * 300 - 150) + 'deg');
      s.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's';
      band.appendChild(s);
      setTimeout(function (n) { n.remove(); }.bind(null, s), 1000);
    }
  }
  function bindBursts(root) {
    (root || document).querySelectorAll('[data-burst], .hero-ctas .btn, .cater-card .btn, .visit-actions .btn').forEach(function (b) {
      if (b._burst) return; b._burst = true;
      b.addEventListener('mouseenter', function () { burst(b); });
      b.addEventListener('focus', function () { if (b.matches(':focus-visible')) burst(b); });
      b.addEventListener('touchstart', function () { burst(b); }, { passive: true });
    });
  }
  bindBursts();
  window.HomiesBurst = bindBursts;

  /* ---------- 2. seamless marquee ---------- */
  var ribbon = document.querySelector('.ribbon-track');
  if (ribbon) {
    var proto = ribbon.querySelector('ul').cloneNode(true);
    var buildMarquee = function () {
      ribbon.style.animation = 'none';
      ribbon.innerHTML = '';
      var set = document.createElement('div'); set.className = 'ribbon-set';
      ribbon.appendChild(set);
      set.appendChild(proto.cloneNode(true));
      // one "set" must be at least as wide as the screen; the track is two identical sets
      var guard = 0;
      while (set.scrollWidth < window.innerWidth + 200 && guard++ < 12) set.appendChild(proto.cloneNode(true));
      ribbon.appendChild(set.cloneNode(true));
      var w = set.getBoundingClientRect().width;
      ribbon.style.setProperty('--shift', -w + 'px');
      ribbon.style.setProperty('--dur', (w / 70).toFixed(2) + 's');   // ~70px per second
      void ribbon.offsetWidth;
      ribbon.style.animation = '';
    };
    buildMarquee();
    var mqTimer; window.addEventListener('resize', function () { clearTimeout(mqTimer); mqTimer = setTimeout(buildMarquee, 200); });
  }

  /* ---------- 3. drifting swirls ---------- */
  var SWIRL = '<svg viewBox="0 0 120 60" aria-hidden="true"><path d="M6 40c10-22 34-26 40-10 5 13-12 20-17 9-5-11 12-24 30-18 20 7 18 34 44 30 12-2 9-14 2-13" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>';
  document.querySelectorAll('[data-swirls]').forEach(function (sec) {
    var spots = sec.getAttribute('data-swirls').split(';');
    spots.forEach(function (spot, i) {
      var p = spot.split(',');
      var s = document.createElement('span');
      s.className = 'swirl'; s.innerHTML = SWIRL; s.setAttribute('aria-hidden', 'true');
      s.style.left = p[0]; s.style.top = p[1]; s.style.color = p[2] || '#f4b3c2';
      s.style.setProperty('--d', (-i * 6.5) + 's');
      sec.insertBefore(s, sec.firstChild);
    });
  });

  /* ---------- 4. card hover: lift forward, tilt left→right, lower edge rises, settle ---------- */
  if (!reduce && fine && Element.prototype.animate) {
    var HOVER = [
      { transform: 'perspective(800px) translateY(0) rotateX(0deg) rotateY(0deg) scale(1)' },
      { transform: 'perspective(800px) translateY(-8px) rotateX(9deg) rotateY(-7deg) scale(1.035)', offset: 0.35 },
      { transform: 'perspective(800px) translateY(-9px) rotateX(5deg) rotateY(5deg) scale(1.04)', offset: 0.7 },
      { transform: 'perspective(800px) translateY(-7px) rotateX(3deg) rotateY(0deg) scale(1.035)' }
    ];
    document.addEventListener('pointerover', function (e) {
      var card = e.target.closest && e.target.closest('.card, .shelf-item');
      if (!card || card._hovering || (e.relatedTarget && card.contains(e.relatedTarget))) return;
      card._hovering = true;
      if (card._anim) card._anim.cancel();
      card._anim = card.animate(HOVER, { duration: 900, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' });
    });
    document.addEventListener('pointerout', function (e) {
      var card = e.target.closest && e.target.closest('.card, .shelf-item');
      if (!card || (e.relatedTarget && card.contains(e.relatedTarget))) return;
      card._hovering = false;
      var from = getComputedStyle(card).transform;
      if (card._anim) card._anim.cancel();
      card._anim = card.animate([{ transform: from === 'none' ? 'none' : from }, { transform: 'perspective(800px) translateY(0) rotateX(0deg) rotateY(0deg) scale(1)' }], { duration: 450, easing: 'cubic-bezier(.34,1.4,.64,1)' });
    });
  }

  /* ---------- 5. the truck rolls in ~1s after the bottom of the blue catering card is in view ---------- */
  var sentinel = document.querySelector('[data-truck-trigger]');
  var cater = document.querySelector('.cater-card');
  if (sentinel && cater) {
    if (reduce || !('IntersectionObserver' in window)) { cater.classList.add('drive'); }
    else {
      var tTimer = null;
      var truckIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !tTimer) {
            tTimer = setTimeout(function () { cater.classList.add('drive'); truckIO.disconnect(); }, 1000);
          } else if (!en.isIntersecting && tTimer && !cater.classList.contains('drive')) {
            clearTimeout(tTimer); tTimer = null;   // scrolled away before the second passed
          }
        });
      }, { threshold: 1 });
      truckIO.observe(sentinel);
    }
  }

  /* ---------- 6. call buttons: dial on phones; on desktop also copy the number ---------- */
  var toast;
  function showToast(msg) {
    if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; toast.setAttribute('role', 'status'); document.body.appendChild(toast); }
    toast.textContent = msg; toast.classList.add('is-on');
    clearTimeout(toast._t); toast._t = setTimeout(function () { toast.classList.remove('is-on'); }, 3200);
  }
  document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
    a.addEventListener('click', function () {
      if (!fine) return;   // phones and tablets dial straight away
      var num = (window.HOMIES_SITE && window.HOMIES_SITE.phoneLabel) || a.getAttribute('href').slice(4);
      if (navigator.clipboard) navigator.clipboard.writeText(num).catch(function () {});
      showToast('Call us at ' + num + ' (number copied)');
    });
  });

  /* ---------- 7. donut balloons: float, drag and throw, never parked over content ---------- */
  var BALLOON = function (c1, c2) {
    return '<svg viewBox="0 0 80 120" aria-hidden="true"><circle cx="40" cy="38" r="34" fill="' + c1 + '"/><circle cx="40" cy="38" r="12" fill="#fff4f6"/>' +
      '<path d="M22 20q4-4 8-2M52 16q5 1 7 5M60 40q2 5-1 9M20 50q2 5 6 7M44 64q5-1 8-4" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M48 14l2 6M27 30l5 2M58 30l-4 3M30 58l3-4" stroke="' + c2 + '" stroke-width="3" stroke-linecap="round"/>' +
      '<ellipse cx="28" cy="22" rx="8" ry="4" fill="#fff" opacity=".35" transform="rotate(-30 28 22)"/>' +
      '<path d="M26 66l8 30M54 66l-8 30" stroke="#c9937f" stroke-width="1.6"/><rect x="31" y="94" width="18" height="14" rx="3" fill="#c98a5a"/><rect x="31" y="94" width="18" height="4" rx="2" fill="#a86a40"/></svg>';
  };
  var PALETTE = [['#f37fb0', '#ffc83d'], ['#5fc2ef', '#ef4f93'], ['#ffc83d', '#ef4f93'], ['#cbb9ff', '#5fc2ef'], ['#a6e6cf', '#ef4f93']];
  var PROTECT = '.section-head, .case, .tile, .card, .visit-card, .map-frame, .polaroid, .reel, .cater-card, .hero-box, h1, h2, h3, p, .btn, .hero-ctas, .shelf-row, .eyebrow, .cat-bar';
  // text is measured by its actual lines, not its full-width block
  function rectsOf(el) {
    if (el.matches('h1, h2, h3, p, .eyebrow')) {
      var r = document.createRange(); r.selectNodeContents(el);
      return Array.prototype.slice.call(r.getClientRects());
    }
    return [el.getBoundingClientRect()];
  }
  function overlapsContent(sec, rect) {
    var hit = false;
    var bar = document.querySelector('.site-header .bar');   // never hide behind the sticky header
    if (bar) { var hb = bar.getBoundingClientRect(); if (rect.top < hb.bottom + 10 && rect.bottom > hb.top) return true; }
    sec.querySelectorAll(PROTECT).forEach(function (el) {
      if (hit) return;
      rectsOf(el).forEach(function (r) {
        if (r.width && rect.left < r.right - 4 && rect.right > r.left + 4 && rect.top < r.bottom - 4 && rect.bottom > r.top + 4) hit = true;
      });
    });
    return hit;
  }
  function freeSpot(sec, b) {
    var sr = sec.getBoundingClientRect(), bw = b.offsetWidth, bh = b.offsetHeight;
    for (var tries = 0; tries < 40; tries++) {
      var x = Math.random() * Math.max(1, sr.width - bw), y = Math.random() * Math.max(1, sr.height - bh);
      var rect = { left: sr.left + x, top: sr.top + y, right: sr.left + x + bw, bottom: sr.top + y + bh };
      if (!overlapsContent(sec, rect)) return { x: x, y: y };
    }
    return { x: b._home.x, y: b._home.y };
  }
  document.querySelectorAll('[data-balloons]').forEach(function (sec, si) {
    sec.getAttribute('data-balloons').split(';').forEach(function (spot, i) {
      var p = spot.split(',');
      var colors = PALETTE[(si + i) % PALETTE.length];
      var b = document.createElement('div');
      b.className = 'balloon-fly'; b.setAttribute('aria-hidden', 'true');
      b.innerHTML = '<div class="bob" style="--d:' + (-(si * 2 + i * 3)) + 's">' + BALLOON(colors[0], colors[1]) + '</div>';
      sec.insertBefore(b, sec.firstChild);
      var place = function () {
        var sr = sec.getBoundingClientRect();
        b._home = { x: parseFloat(p[0]) / 100 * sr.width, y: parseFloat(p[1]) / 100 * sr.height };
        if (!b._moved) {
          b._pos = { x: b._home.x, y: b._home.y }; set();
          // never start parked over text or cards
          requestAnimationFrame(function () { if (overlapsContent(sec, b.getBoundingClientRect())) { b._pos = freeSpot(sec, b); set(); } });
        }
      };
      var set = function () { b.style.transform = 'translate(' + b._pos.x + 'px,' + b._pos.y + 'px)'; };
      place();
      window.addEventListener('resize', place);
      window.addEventListener('load', function () { setTimeout(function () { if (!b._moved && overlapsContent(sec, b.getBoundingClientRect())) { b._pos = freeSpot(sec, b); set(); } }, 600); });

      var drag = null, raf = null;
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault(); b.setPointerCapture(e.pointerId); b._moved = true;
        cancelAnimationFrame(raf); b.classList.add('is-grabbed'); b.classList.remove('is-hidden');
        drag = { ox: e.clientX - b._pos.x, oy: e.clientY - b._pos.y, hist: [{ x: e.clientX, y: e.clientY, t: performance.now() }] };
      });
      b.addEventListener('pointermove', function (e) {
        if (!drag) return;
        b._pos = { x: e.clientX - drag.ox, y: e.clientY - drag.oy }; set();
        drag.hist.push({ x: e.clientX, y: e.clientY, t: performance.now() }); if (drag.hist.length > 6) drag.hist.shift();
      });
      var release = function () {
        if (!drag) return;
        var h = drag.hist, a = h[0], z = h[h.length - 1], dt = Math.max(16, z.t - a.t);
        var vx = reduce ? 0 : (z.x - a.x) / dt * 16, vy = reduce ? 0 : (z.y - a.y) / dt * 16;
        drag = null; b.classList.remove('is-grabbed');
        var sr = sec.getBoundingClientRect();
        var step = function () {
          vx *= 0.93; vy *= 0.93;
          b._pos.x += vx; b._pos.y += vy;
          var maxX = sr.width - b.offsetWidth, maxY = sr.height - b.offsetHeight;
          if (b._pos.x < 0 || b._pos.x > maxX) { vx = -vx * 0.6; b._pos.x = Math.min(Math.max(b._pos.x, 0), maxX); }
          if (b._pos.y < 0 || b._pos.y > maxY) { vy = -vy * 0.6; b._pos.y = Math.min(Math.max(b._pos.y, 0), maxY); }
          set();
          if (Math.abs(vx) + Math.abs(vy) > 0.3) raf = requestAnimationFrame(step); else settle();
        };
        step();
      };
      var settle = function () {
        if (!overlapsContent(sec, b.getBoundingClientRect())) return;
        // landed on text or a card: fade out and float back somewhere open
        b.classList.add('is-hidden');
        setTimeout(function () { b._pos = freeSpot(sec, b); set(); b.classList.remove('is-hidden'); }, 450);
      };
      b.addEventListener('pointerup', release);
      b.addEventListener('pointercancel', release);
    });
  });
})();
