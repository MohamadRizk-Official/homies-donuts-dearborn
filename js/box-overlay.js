/* Homie's Donuts — detail overlay for the six donuts in the hero box only.
 *
 * Each box donut ([data-donut]) opens a centred panel with that donut's real photo, name, a short
 * description and Order Now. Every donut has its own colour mood and its own quiet animated details,
 * which live only in the panel's edges and the backdrop, never over the photo or the text.
 * Close: the X, Escape, or a click outside the panel. The site header stays on top and usable.
 */
(function () {
  'use strict';
  var box = document.querySelector('[data-hero-box]');
  if (!box) return;
  var SITE = window.HOMIES_SITE || {};
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Copy describes only what is visible in each product photo.
  var D = {
    'Elmo': { img: 'img/fav/elmo.webp', name: ['Elmo', 'Donut'], theme: 'elmo',
      desc: 'Bright red glaze and red sprinkles, two candy eyes, a donut-hole nose and an Oreo smile. A big grin in donut form.' },
    'Peanut Butter & Jelly': { img: 'img/fav/pbj.webp', name: ['Peanut Butter', '& Jelly Donut'], theme: 'pbj',
      desc: 'Glossy peanut butter glaze with a bright burst of jelly in the middle and a crunchy half-moon of chopped peanuts.' },
    'Homers': { img: 'img/fav/homers.webp', name: ['Homers', 'Donut'], theme: 'homers',
      desc: 'Fluffy golden dough with sweet pink icing and a generous shower of rainbow sprinkles.' },
    'Cookie Monster': { img: 'img/fav/cookie-monster.webp', name: ['Cookie Monster', 'Donut'], theme: 'cookie',
      desc: 'Sky-blue icing, googly candy eyes, chunks of chocolate chip cookie and a fuzzy beard of blue sprinkles.' },
    'Biscoff': { img: 'img/fav/biscoff.webp', name: ['Biscoff', 'Donut'], theme: 'biscoff',
      desc: 'Piled high with Biscoff cookie crumbs and crowned with a whole Lotus Biscoff biscuit.' },
    'Mille-Feuille': { img: 'img/fav/mille-feuille.webp', name: ['Mille-Feuille', 'Donut'], theme: 'mille',
      desc: 'Smooth white fondant feathered with chocolate, with an edge rolled in flaky golden pastry crumbs.' }
  };
  // flavour details: [kind, colours, how many in the backdrop, how many along the panel edges]
  var FX = {
    cookie:  ['sprinkle', ['#1f6fe0', '#3b8cff', '#0d4fb8', '#7fb6ff'], 22, 10, 'fall'],
    elmo:    ['sprinkle', ['#e8233a', '#ff5a6e', '#ffd2d8', '#ff8a3d'], 20, 10, 'fall'],
    homers:  ['sprinkle', ['#ef4f93', '#ffc83d', '#5fc2ef', '#7ad36b', '#ff8a3d', '#ffffff'], 24, 12, 'fall'],
    biscoff: ['crumb', ['#b8672a', '#d58a45', '#8f4f1e', '#e8b27a'], 18, 8, 'fall'],
    mille:   ['flake', ['#e9b16a', '#f5d39b', '#d99447', '#fff4dc'], 16, 8, 'sway'],
    pbj:     ['jelly', ['#c8102e', '#e8344a', '#d39552', '#f0c98f'], 16, 8, 'rise']
  };

  var ov = document.createElement('div');
  ov.className = 'bo'; ov.hidden = true;
  ov.innerHTML =
    '<div class="bo-backdrop"><div class="bo-fx bo-fx--back" aria-hidden="true"></div></div>' +
    '<div class="bo-panel" role="dialog" aria-modal="true" aria-labelledby="bo-title" aria-describedby="bo-desc">' +
      '<div class="bo-fx bo-fx--edge" aria-hidden="true"></div>' +
      '<button class="bo-close" type="button" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg></button>' +
      '<div class="bo-stage"><span class="bo-halo" aria-hidden="true"></span><img class="bo-img" alt=""></div>' +
      '<div class="bo-copy">' +
        '<p class="bo-kicker">Homie\'s Favourites</p>' +
        '<h2 class="bo-title" id="bo-title"></h2>' +
        '<p class="bo-desc" id="bo-desc"></p>' +
        '<a class="btn btn--lg bo-order" data-burst>Order Now <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></a>' +
      '</div>' +
    '</div>';
  document.body.appendChild(ov);
  var $ = function (s) { return ov.querySelector(s); };
  var panel = $('.bo-panel'), img = $('.bo-img'), current = null, hideTimer = null;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function particle(kind, color, motion) {
    var s = document.createElement('i');
    s.className = 'bo-p bo-p--' + kind + ' bo-m--' + motion;
    s.style.setProperty('--c', color);
    s.style.setProperty('--r', Math.round(rand(0, 180)) + 'deg');
    s.style.setProperty('--dur', rand(14, 24).toFixed(1) + 's');
    s.style.setProperty('--delay', (-rand(0, 24)).toFixed(1) + 's');
    s.style.setProperty('--sway', Math.round(rand(-26, 26)) + 'px');
    s.style.setProperty('--sz', rand(0.7, 1.3).toFixed(2));
    return s;
  }
  // backdrop: anywhere outside the panel; edge: only the outer 9% of the panel, clear of the photo and the text
  function buildFx(theme) {
    var f = FX[theme], back = $('.bo-fx--back'), edge = $('.bo-fx--edge');
    back.innerHTML = ''; edge.innerHTML = '';
    for (var i = 0; i < f[2]; i++) {
      var p = particle(f[0], f[1][i % f[1].length], f[4]);
      p.style.left = rand(1, 99).toFixed(1) + '%';
      back.appendChild(p);
    }
    for (var j = 0; j < f[3]; j++) {
      var q = particle(f[0], f[1][j % f[1].length], f[4]);
      q.style.left = (j % 2 ? rand(1.5, 7) : rand(93, 98.5)).toFixed(1) + '%';
      edge.appendChild(q);
    }
  }

  function open(hit) {
    var d = D[hit.getAttribute('data-donut')];
    if (!d || current) return;
    clearTimeout(hideTimer);
    current = { hit: hit, y: window.scrollY };
    ov.setAttribute('data-theme', d.theme);
    var t = $('.bo-title'); t.innerHTML = '';
    d.name.forEach(function (part, i) { var s = document.createElement('span'); s.textContent = part; if (i === d.name.length - 1) s.className = 'bo-accent'; t.appendChild(s); });
    $('.bo-desc').textContent = d.desc;
    var order = $('.bo-order'); order.href = SITE.orderHref || '#';
    if (SITE.orderUrl) { order.target = '_blank'; order.rel = 'noopener'; } else order.removeAttribute('target');
    buildFx(d.theme);
    img.alt = d.name.join(' ');
    img.src = d.img;
    // only show once the right photo is ready, so the previous donut can never flash
    var ready = img.decode ? img.decode().catch(function () {}) : Promise.resolve();
    Promise.race([ready, new Promise(function (r) { setTimeout(r, 900); })]).then(function () {
      if (!current) return;
      document.documentElement.classList.add('bo-open');
      ov.hidden = false;
      ov.classList.remove('is-out');
      void ov.offsetWidth;
      ov.classList.add('is-in');
      $('.bo-close').focus({ preventScroll: true });
    });
  }
  function close() {
    if (!current || ov.hidden) { current = null; return; }
    var hit = current.hit, y = current.y;
    ov.classList.remove('is-in'); ov.classList.add('is-out');
    hideTimer = setTimeout(function () {
      ov.hidden = true; ov.classList.remove('is-out');
      document.documentElement.classList.remove('bo-open');
      $('.bo-fx--back').innerHTML = ''; $('.bo-fx--edge').innerHTML = '';
      if (window.scrollY !== y) window.scrollTo(0, y);
      current = null;
      hit.focus({ preventScroll: true });
    }, reduce ? 0 : 320);
  }

  box.querySelectorAll('.dz .hit[data-donut]').forEach(function (hit) {
    hit.addEventListener('click', function () { open(hit); });
  });
  $('.bo-close').addEventListener('click', close);
  $('.bo-backdrop').addEventListener('click', close);
  ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
  document.addEventListener('keydown', function (e) {
    if (!current) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (ov.hidden) return;
    if (e.key === 'Tab') {
      var f = panel.querySelectorAll('button, a[href]'), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  // the header stays usable: following one of its links closes the overlay first
  var header = document.querySelector('.site-header');
  if (header) header.addEventListener('click', function (e) {
    if (e.target.closest('a') && current) { ov.hidden = true; ov.classList.remove('is-in', 'is-out'); document.documentElement.classList.remove('bo-open'); current = null; }
  });
  window.HomiesBoxOverlay = { open: function (name) { var h = box.querySelector('.dz .hit[data-donut="' + name + '"]'); if (h) open(h); }, close: close };
  // warm the cache so the first open is instant
  window.addEventListener('load', function () { setTimeout(function () { Object.keys(D).forEach(function (k) { var i = new Image(); i.src = D[k].img; }); }, 1000); });
})();
