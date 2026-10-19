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

  /* ---------- 4. sprinkles drifting down each section, kept to the side gutters ---------- */
  if (!reduce) {
    var FALL_COLORS = ['#ef4f93', '#ffc83d', '#5fc2ef', '#7ad36b', '#cbb9ff', '#ff8a3d'];
    document.querySelectorAll('main > section, .hero').forEach(function (sec, si) {
      var gutter = (window.innerWidth - 1200) / 2;
      var n = gutter > 90 ? 8 : (window.innerWidth >= 700 ? 4 : 3);
      var layer = document.createElement('div'); layer.className = 'fall'; layer.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < n; i++) {
        var s = document.createElement('i');
        var left = i % 2 === 0;
        // inside the gutters on wide screens; hugging the very edge on small ones
        var x = gutter > 90 ? (left ? 1 + Math.random() * (gutter / window.innerWidth * 100 - 3) : 99 - Math.random() * (gutter / window.innerWidth * 100 - 3)) : (left ? 0.5 + Math.random() * 2 : 97.5 + Math.random() * 2);
        s.style.left = x.toFixed(2) + '%';
        s.style.setProperty('--c', FALL_COLORS[(i + si) % FALL_COLORS.length]);
        s.style.setProperty('--dur', (16 + Math.random() * 10).toFixed(1) + 's');
        s.style.setProperty('--delay', (-Math.random() * 26).toFixed(1) + 's');
        s.style.setProperty('--sway', ((Math.random() - 0.5) * 30).toFixed(0) + 'px');
        s.style.setProperty('--r', Math.round(Math.random() * 180) + 'deg');
        layer.appendChild(s);
      }
      sec.insertBefore(layer, sec.firstChild);
    });
  }

  /* ---------- 5. the truck rolls in ~1s after the bottom of the blue catering card is in view ---------- */
  var sentinel = document.querySelector('[data-truck-trigger]');
  var cater = document.querySelector('.cater-card');
  if (sentinel && cater) {
    if (reduce || !('IntersectionObserver' in window)) { cater.classList.add('drive'); }
    else {
      var tTimer = null, scrolled = false;
      window.addEventListener('scroll', function () { scrolled = true; }, { passive: true, once: true });
      var truckIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !tTimer && scrolled) {
            tTimer = setTimeout(function () { cater.classList.add('drive'); truckIO.disconnect(); }, 1000);
          } else if (!en.isIntersecting && tTimer && !cater.classList.contains('drive')) {
            clearTimeout(tTimer); tTimer = null;   // scrolled away before the second passed
          }
        });
      }, { threshold: 1 });
      truckIO.observe(sentinel);
      window.addEventListener('scroll', function () { truckIO.unobserve(sentinel); truckIO.observe(sentinel); }, { passive: true, once: true });
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
      var set = function () { b.style.transform = 'translate(' + b._pos.x + 'px,' + b._pos.y + 'px) rotate(' + (b._ang || 0).toFixed(2) + 'deg)'; };
      place();
      window.addEventListener('resize', place);
      window.addEventListener('load', function () { setTimeout(function () { if (!b._moved && overlapsContent(sec, b.getBoundingClientRect())) { b._pos = freeSpot(sec, b); set(); } }, 600); });

      var drag = null, raf = null;
      b._ang = 0; b._angV = 0; b._vx = 0; b._vy = 0;
      // one physics loop: follows the pointer softly while held, then coasts with gravity, damping and a swinging basket
      var tick = function () {
        var sr = sec.getBoundingClientRect();
        var maxX = sr.width - b.offsetWidth, maxY = sr.height - b.offsetHeight;
        if (drag) {
          var tx = drag.px - drag.ox, ty = drag.py - drag.oy;
          var nx = b._pos.x + (tx - b._pos.x) * 0.35, ny = b._pos.y + (ty - b._pos.y) * 0.35;
          b._vx = nx - b._pos.x; b._vy = ny - b._pos.y;
          b._pos.x = nx; b._pos.y = ny;
        } else {
          b._vy += (b._g || 0); b._g = (b._g || 0) * 0.97;   // light gravity that fades as it settles back to floating
          b._vx *= 0.965; b._vy *= 0.955;      // air damping
          b._pos.x += b._vx; b._pos.y += b._vy;
          if (b._pos.x < 0 || b._pos.x > maxX) { b._vx = -b._vx * 0.5; b._pos.x = Math.min(Math.max(b._pos.x, 0), maxX); }
          if (b._pos.y < 0 || b._pos.y > maxY) { b._vy = -b._vy * 0.4; b._pos.y = Math.min(Math.max(b._pos.y, 0), maxY); }
        }
        // moving right → the basket lags behind (left), so the balloon leans right
        var targetAng = Math.max(-28, Math.min(28, b._vx * 2.4));
        b._angV += (targetAng - b._ang) * 0.09; b._angV *= 0.82; b._ang += b._angV;
        set();
        var moving = drag || Math.abs(b._vx) + Math.abs(b._vy) > 0.15 || Math.abs(b._ang) > 0.4 || Math.abs(b._angV) > 0.05;
        if (moving) raf = requestAnimationFrame(tick);
        else { b._ang = 0; set(); b.classList.remove('is-flying'); settle(); }
      };
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (err) {} b._moved = true;
        b.classList.add('is-grabbed', 'is-flying'); b.classList.remove('is-hidden');
        drag = { ox: e.clientX - b._pos.x, oy: e.clientY - b._pos.y, px: e.clientX, py: e.clientY };
        cancelAnimationFrame(raf);
        if (reduce) return;
        raf = requestAnimationFrame(tick);
      });
      b.addEventListener('pointermove', function (e) {
        if (!drag) return;
        drag.px = e.clientX; drag.py = e.clientY;
        if (reduce) { b._pos = { x: e.clientX - drag.ox, y: e.clientY - drag.oy }; set(); }
      });
      var release = function () {
        if (!drag) return;
        drag = null; b.classList.remove('is-grabbed');
        if (reduce) { settle(); return; }
        // keep the throw from the last few frames, gently capped
        b._vx = Math.max(-26, Math.min(26, b._vx * 1.1)); b._vy = Math.max(-26, Math.min(26, b._vy * 1.1)); b._g = 0.14;
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

  /* ---------- 8. traveling LED light around card edges ---------- */
  var LED = '.tile, .primary-nav .nav-link, .cater-card, .review-card, .polaroid, .reel-phone, .menu-section .card';
  var ledIO = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { en.target.classList.toggle('led-live', en.isIntersecting); });
  }, { rootMargin: '80px' }) : null;
  document.querySelectorAll(LED).forEach(function (el) {
    if (el.querySelector(':scope > .led')) return;
    var glow = document.createElement('span'); glow.className = 'led-glow'; glow.setAttribute('aria-hidden', 'true');
    var ring = document.createElement('span'); ring.className = 'led'; ring.setAttribute('aria-hidden', 'true');
    el.appendChild(glow); el.appendChild(ring); el.classList.add('has-led');
    if (ledIO) ledIO.observe(el); else el.classList.add('led-live');
  });

  /* ---------- 9. reviews: swipe on phones, arrows, slow optional advance ---------- */
  var track = document.querySelector('[data-reviews]');
  if (track) {
    var cards = track.querySelectorAll('.review-card');
    var step = function (dir) {
      var w = cards[0].getBoundingClientRect().width + 18;
      var maxL = track.scrollWidth - track.clientWidth;
      var next = track.scrollLeft + dir * w;
      if (next > maxL + 4) next = 0; if (next < -4) next = maxL;
      track.scrollTo({ left: next, behavior: reduce ? 'auto' : 'smooth' });
    };
    document.querySelectorAll('[data-rev]').forEach(function (btn) {
      btn.addEventListener('click', function () { step(btn.getAttribute('data-rev') === 'next' ? 1 : -1); });
    });
    // advance slowly on narrow screens only (desktop shows all three); pause on hover, focus or touch
    var paused = false, timer = null;
    ['pointerenter', 'focusin', 'touchstart'].forEach(function (ev) { track.parentElement.addEventListener(ev, function () { paused = true; }, { passive: true }); });
    ['pointerleave', 'focusout'].forEach(function (ev) { track.parentElement.addEventListener(ev, function () { paused = false; }); });
    if (!reduce) timer = setInterval(function () { if (!paused && track.scrollWidth > track.clientWidth + 10 && !document.hidden) step(1); }, 7000);
  }

  /* ---------- 10. keyboard-only focus styling (no stray rings after mouse clicks) ---------- */
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Tab' || ev.key === 'Enter' || ev.key === ' ') document.documentElement.classList.add('kbd'); });
  document.addEventListener('pointerdown', function () { document.documentElement.classList.remove('kbd'); }, true);
})();
