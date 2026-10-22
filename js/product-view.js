/* Homie's Donuts — one reusable product detail view.
 *
 * Any element with [data-product] opens it. The attribute holds the product's name; details come
 * from window.HOMIES_MENU, with richer copy, colours and background accents for the favourites
 * (FAV below). The view sits under the site header (which stays usable), animates in, and returns
 * focus and scroll to where the visitor was when it closes.
 */
(function () {
  'use strict';
  var SITE = window.HOMIES_SITE || {};
  var menu = window.HOMIES_MENU || [];
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Favourites: copy describes only what is visible in the product photos.
  var FAV = {
    'Elmo': {
      img: 'img/fav/elmo.webp', title: ['Elmo', 'Donut'],
      desc: 'Bright red glaze and red sprinkles, two candy eyes, a donut-hole nose and an Oreo smile. A big grin in donut form.',
      mood: { bg1: '#fff1ec', bg2: '#ffd6cf', ink: '#e23b4e', glow: 'rgba(255, 90, 90, .35)' },
      accents: { kind: 'sprinkle', colors: ['#e8344a', '#ffc83d', '#ff8fb1', '#ffffff', '#5fc2ef'] }
    },
    'Peanut Butter & Jelly': {
      img: 'img/fav/pbj.webp', title: ['Peanut Butter', '& Jelly Donut'],
      desc: 'Glossy peanut butter glaze with a bright burst of jelly in the middle and a crunchy half-moon of chopped peanuts.',
      mood: { bg1: '#fff3e8', bg2: '#f8cfd6', ink: '#c2414f', glow: 'rgba(214, 140, 60, .35)' },
      accents: { kind: 'peanut', colors: ['#e2b47a', '#d39552', '#c8102e', '#f0c98f'] }
    },
    'Homers': {
      img: 'img/fav/homers.webp', title: ['Homers', 'Donut'],
      desc: 'Fluffy golden dough with sweet pink icing and a generous shower of rainbow sprinkles.',
      mood: { bg1: '#fff2f5', bg2: '#ffd3e1', ink: '#ef4f93', glow: 'rgba(239, 79, 147, .3)' },
      accents: { kind: 'sprinkle', colors: ['#ef4f93', '#ffc83d', '#5fc2ef', '#7ad36b', '#ff8a3d', '#ffffff'] }
    },
    'Cookie Monster': {
      img: 'img/fav/cookie-monster.webp', title: ['Cookie', 'Monster', 'Donut'],
      desc: 'Sky-blue icing, googly candy eyes, chunks of chocolate chip cookie and a fuzzy beard of blue sprinkles.',
      mood: { bg1: '#eef8ff', bg2: '#c9e9fb', ink: '#1f86e0', glow: 'rgba(31, 134, 224, .3)' },
      accents: { kind: 'crumb', colors: ['#b98552', '#8a5a33', '#3b2418', '#1f6fe0'] }
    },
    'Biscoff': {
      img: 'img/fav/biscoff.webp', title: ['Biscoff', 'Donut'],
      desc: 'Piled high with Biscoff cookie crumbs and crowned with a whole Lotus Biscoff biscuit.',
      mood: { bg1: '#fff4e8', bg2: '#f3d3ad', ink: '#b8641f', glow: 'rgba(196, 120, 50, .35)' },
      accents: { kind: 'crumb', colors: ['#c9813c', '#b06a2a', '#e0a35f', '#8f5220'] }
    },
    'Mille-Feuille': {
      img: 'img/fav/mille-feuille.webp', title: ['Mille-Feuille', 'Donut'],
      desc: 'Smooth white fondant feathered with chocolate, with an edge rolled in flaky golden pastry crumbs.',
      mood: { bg1: '#fff7f1', bg2: '#f9dcd2', ink: '#9b4a2c', glow: 'rgba(214, 150, 90, .3)' },
      accents: { kind: 'flake', colors: ['#e9b16a', '#d99447', '#f5d39b', '#c97a35'] }
    }
  };
  // category moods for everything else
  var CAT = {
    'donuts': { mood: { bg1: '#fff2f5', bg2: '#ffd9e4', ink: '#ef4f93', glow: 'rgba(239, 79, 147, .28)' }, accents: { kind: 'sprinkle', colors: ['#ef4f93', '#ffc83d', '#5fc2ef', '#ffffff'] } },
    'pizza-donuts': { mood: { bg1: '#fff4ea', bg2: '#ffd2bd', ink: '#d9472f', glow: 'rgba(232, 85, 61, .3)' }, accents: { kind: 'herb', colors: ['#4f9a5a', '#7cba6b', '#f2c14e', '#e8553d'] } },
    'bunz': { mood: { bg1: '#fff5ea', bg2: '#f0cfa8', ink: '#a8622a', glow: 'rgba(196, 120, 50, .3)' }, accents: { kind: 'crumb', colors: ['#c98a4b', '#e9b874', '#8f5a2c'] } },
    'beignewiches': { mood: { bg1: '#fffbea', bg2: '#ffe59a', ink: '#c47a00', glow: 'rgba(240, 180, 40, .32)' }, accents: { kind: 'herb', colors: ['#f2c14e', '#e89b2e', '#7cba6b'] } },
    'desserts': { mood: { bg1: '#f8f4ff', bg2: '#dccfff', ink: '#7a55d9', glow: 'rgba(122, 85, 217, .28)' }, accents: { kind: 'sprinkle', colors: ['#cbb9ff', '#ff8fb1', '#a6e6cf', '#ffc83d'] } },
    'drinks': { mood: { bg1: '#f1faff', bg2: '#c6e9fa', ink: '#1f86c9', glow: 'rgba(95, 194, 239, .32)' }, accents: { kind: 'bubble', colors: ['#ffffff', '#c6e9fa', '#ffd6e6'] } }
  };

  function find(name, catId) {
    for (var c = 0; c < menu.length; c++) {
      if (catId && menu[c].id !== catId) continue;
      for (var g = 0; g < menu[c].groups.length; g++) {
        var items = menu[c].groups[g].items;
        for (var i = 0; i < items.length; i++) if (items[i].name === name) return { item: items[i], cat: menu[c], group: menu[c].groups[g] };
      }
    }
    return null;
  }

  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---- build the view once
  var view = document.createElement('div');
  view.className = 'pv'; view.hidden = true;
  view.setAttribute('role', 'dialog'); view.setAttribute('aria-modal', 'true'); view.setAttribute('aria-labelledby', 'pv-title');
  view.innerHTML =
    '<div class="pv-bg" aria-hidden="true"></div>' +
    '<div class="pv-accents" aria-hidden="true"></div>' +
    '<div class="pv-flyer" aria-hidden="true"><img class="pv-from" alt=""><img class="pv-to" alt=""></div>' +
    '<button class="pv-close" type="button" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg></button>' +
    '<div class="pv-copy">' +
      '<p class="pv-kicker"></p>' +
      '<h2 class="pv-title" id="pv-title"></h2>' +
      '<svg class="pv-squiggle" viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true"><path d="M3 14 Q 40 2 78 12 T 152 12 T 226 12 T 297 8" fill="none" stroke="#ffc83d" stroke-width="6" stroke-linecap="round"/></svg>' +
      '<p class="pv-desc"></p>' +
      '<div class="pv-actions">' +
        '<a class="btn btn--lg pv-order" target="_blank" rel="noopener" data-burst>Order Now ' + ARROW + '</a>' +
        '<button class="pv-back" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span></span></button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(view);
  var $ = function (s) { return view.querySelector(s); };
  var flyer = $('.pv-flyer'), fromImg = $('.pv-from'), toImg = $('.pv-to'), copy = $('.pv-copy');
  var closeBtn = $('.pv-close');
  var state = null;

  function accents(spec, n) {
    var host = $('.pv-accents'); host.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var s = document.createElement('span');
      s.className = 'pv-acc pv-acc--' + spec.kind;
      s.style.setProperty('--c', spec.colors[i % spec.colors.length]);
      s.style.setProperty('--x', (i % 2 ? 60 + Math.random() * 38 : 2 + Math.random() * 22).toFixed(1) + '%');
      s.style.setProperty('--y', (Math.random() * 100).toFixed(1) + '%');
      s.style.setProperty('--r', Math.round(Math.random() * 360) + 'deg');
      s.style.setProperty('--s', (0.6 + Math.random() * 0.8).toFixed(2));
      s.style.setProperty('--d', (-Math.random() * 18).toFixed(1) + 's');
      s.style.setProperty('--t', (16 + Math.random() * 12).toFixed(1) + 's');
      if (spec.kind !== 'sprinkle') s.style.setProperty('--z', (6 + Math.random() * 14).toFixed(0) + 'px');
      host.appendChild(s);
    }
  }
  function headerBottom() { var b = document.querySelector('.site-header .bar'); return b ? b.getBoundingClientRect().bottom : 70; }
  function place(el, l, t, w, h) { el.style.left = l + 'px'; el.style.top = t + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px'; }

  /* Wide screens: product on the right, copy on the left. Narrow/portrait screens: product on top, copy below. */
  function layout() {
    var W = document.documentElement.clientWidth, H = window.innerHeight, target;
    var top = headerBottom();
    var a = state.aspect || 1;
    var maxH = (H - top) * (state.drink ? 0.46 : 0.4);
    var w = Math.min(W * 0.78, 460, maxH * a);
    target = { width: w, height: w / a, left: (W - w) / 2, top: top + 14 };
    if (W / H >= 1.15) {
      var hgt = Math.min(H - top - 70, W * 0.36 / a);
      target = { width: hgt * a, height: hgt, left: W * 0.71 - hgt * a / 2, top: top + (H - top - hgt) / 2 + 10 };
      var cl = Math.max(28, (W - 1200) / 2 + 24);
      copy.style.cssText = 'left:' + cl + 'px;width:' + Math.min(560, target.left - cl - 30) + 'px';
      view.classList.remove('pv--stacked'); view.classList.add('pv--side');
    } else {
      view.classList.remove('pv--side'); view.classList.add('pv--stacked');
      copy.style.cssText = 'left:0;width:' + W + 'px;top:' + (target.top + target.height + 10) + 'px';
    }
    place(flyer, target.left, target.top, target.width, target.height);
    return target;
  }

  function sourceRect() {
    var r = state.sourceImg && state.sourceImg.getBoundingClientRect();
    return r && r.width > 4 && r.bottom > 0 && r.top < window.innerHeight ? r : null;
  }
  function deltaFrom(r, t) {
    return 'translate(' + (r.left - t.left) + 'px,' + (r.top - t.top) + 'px) scale(' + (r.width / t.width) + ',' + (r.height / t.height) + ')';
  }

  function open(trigger) {
    if (state) return;
    var name = trigger.getAttribute('data-product');
    var catId = trigger.getAttribute('data-cat-id') || null;
    var found = find(name, catId);
    if (!found) return;
    var isFavGroup = found.group.id === 'favourites';
    var fav = FAV[name] && isFavGroup ? FAV[name] : null;
    var cat = CAT[found.cat.id] || CAT.donuts;
    var mood = fav ? fav.mood : cat.mood;
    var srcImg = trigger.closest('.dz') ? trigger.closest('.dz').querySelector('.dn img') : (trigger.querySelector('img') || null);
    state = { trigger: trigger, sourceImg: srcImg, drink: found.cat.id === 'drinks', anims: [] };

    view.style.setProperty('--pv-bg1', mood.bg1); view.style.setProperty('--pv-bg2', mood.bg2);
    view.style.setProperty('--pv-ink', mood.ink); view.style.setProperty('--pv-glow', mood.glow);
    view.classList.toggle('pv--drink', state.drink);
    $('.pv-kicker').textContent = found.group.title || found.cat.title;
    var h = $('.pv-title'); h.innerHTML = '';
    var title = [found.item.name];   // the same plain name heading for every item, favourites included
    var accentIdx = title.length - 1;
    title.forEach(function (part, i) {
      var span = document.createElement('span'); span.textContent = part;
      if (i === accentIdx && title.length > 1) span.className = 'pv-accent-word';
      h.appendChild(span);
    });
    $('.pv-desc').textContent = fav ? fav.desc : defaultCopy(found);
    [$('.pv-order')].forEach(function (a) {
      a.href = SITE.orderHref || '#';
      if (SITE.orderUrl) a.target = '_blank'; else a.removeAttribute('target');
    });
    $('.pv-back span').textContent = isFavGroup ? 'Back to favourites' : (document.querySelector('[data-menu]') ? 'Back to the menu' : 'Back');
    accents(fav ? fav.accents : cat.accents, 14);

    var toSrc = fav ? fav.img : found.item.img;
    fromImg.src = srcImg ? srcImg.currentSrc || srcImg.src : toSrc;
    toImg.src = toSrc; toImg.alt = found.item.name;

    // wait for the new artwork so nothing old or half-loaded ever shows
    var ready = [toImg].map(function (im) { return im.decode ? im.decode().catch(function () {}) : null; });
    Promise.race([Promise.all(ready), new Promise(function (r) { setTimeout(r, 1200); })]).then(function () {
      if (!state) return;
      state.aspect = toImg.naturalWidth && toImg.naturalHeight ? toImg.naturalWidth / toImg.naturalHeight : 1;
      document.documentElement.classList.add('pv-open');
      view.hidden = false;
      view.classList.remove('is-in', 'is-closing');
      var t = layout();
      void view.offsetWidth;
      view.classList.add('is-in');
      var r = sourceRect(), dur = 780;
      flyer.style.opacity = 1;
      if (!reduce && r) {
        if (state.sourceImg) state.sourceImg.style.visibility = 'hidden';
        state.anims.push(flyer.animate([{ transform: deltaFrom(r, t) }, { transform: 'none' }], { duration: dur, easing: 'cubic-bezier(.22,.8,.26,1)', fill: 'both' }));
        state.anims.push(fromImg.animate([{ opacity: 1 }, { opacity: 1, offset: 0.25 }, { opacity: 0, offset: 0.7 }, { opacity: 0 }], { duration: dur, fill: 'both' }));
        state.anims.push(toImg.animate([{ opacity: 0 }, { opacity: 0, offset: 0.25 }, { opacity: 1, offset: 0.7 }, { opacity: 1 }], { duration: dur, fill: 'both' }));
      } else {
        dur = reduce ? 1 : 420;
        fromImg.style.opacity = 0;
        state.anims.push(flyer.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: dur, easing: 'ease-out', fill: 'both' }));
      }
      setTimeout(function () { closeBtn.focus({ preventScroll: true }); }, reduce ? 0 : 80);
    });
  }

  function defaultCopy(f) {
    if (f.cat.id === 'drinks') return 'A Homie\'s ' + (f.group.title || 'drink').toLowerCase().replace(/s$/, '') + ', shaken up and piled high. Ask at the counter for today\'s lineup.';
    if (f.cat.savory) return 'From the savory side of the menu. Ask at the counter for today\'s lineup.';
    return 'Part of the ' + (f.group.title || f.cat.title) + ' lineup at Homie\'s Dearborn. Ask at the counter for today\'s selection.';
  }

  function finishClose() {
    if (!state) return;
    clearTimeout(state.closeTimer);
    state.anims.forEach(function (a) { a.cancel(); });
    if (state.sourceImg) state.sourceImg.style.visibility = '';
    fromImg.style.opacity = ''; flyer.style.opacity = '';
    view.hidden = true;
    view.classList.remove('is-in', 'is-closing');
    document.documentElement.classList.remove('pv-open');
    var trig = state.trigger; state = null;
    if (trig && document.contains(trig)) trig.focus({ preventScroll: true });
  }
  function close() {
    if (!state || view.classList.contains('is-closing')) return;
    view.classList.add('is-closing'); view.classList.remove('is-in');
    var t = flyer.getBoundingClientRect(), r = sourceRect();
    state.anims.forEach(function (a) { a.cancel(); });
    state.anims = [];
    var dur = 640;
    if (!reduce && r && t.width) {
      var opts = { duration: dur, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'both' };
      state.anims.push(flyer.animate([{ transform: 'none' }, { transform: deltaFrom(r, t) }], opts));
      state.anims.push(fromImg.animate([{ opacity: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1, offset: 0.75 }, { opacity: 1 }], { duration: dur, fill: 'both' }));
      state.anims.push(toImg.animate([{ opacity: 1 }, { opacity: 1, offset: 0.3 }, { opacity: 0, offset: 0.75 }, { opacity: 0 }], { duration: dur, fill: 'both' }));
    } else {
      dur = reduce ? 1 : 260;
      state.anims.push(flyer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur, fill: 'both' }));
    }
    state.anims[0].onfinish = finishClose;
    state.closeTimer = setTimeout(finishClose, dur + 200);   // also completes if the tab is hidden mid-close
  }

  closeBtn.addEventListener('click', close);
  $('.pv-back').addEventListener('click', close);
  view.addEventListener('click', function (e) { if (e.target === view || e.target.closest('.pv-bg')) close(); });
  document.addEventListener('keydown', function (e) {
    if (view.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') {   // keep keyboard focus inside the view (only the controls that are showing)
      var f = Array.prototype.filter.call(view.querySelectorAll('button, a[href]'), function (el) { return el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden'; });
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  window.addEventListener('resize', function () { if (state && !view.hidden) layout(); });
  var header = document.querySelector('.site-header');
  if (header) header.addEventListener('click', function (e) { if (e.target.closest('a') && state) finishClose(); });

  function bind(root) {
    (root || document).querySelectorAll('[data-product]').forEach(function (el) {
      if (el._pv) return; el._pv = true;
      if (!el.hasAttribute('tabindex') && el.tagName !== 'BUTTON' && el.tagName !== 'A') el.setAttribute('tabindex', '0');
      if (el.tagName !== 'BUTTON' && el.getAttribute('role') !== 'listitem') el.setAttribute('role', 'button');
      el.setAttribute('aria-haspopup', 'dialog');
      if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'View ' + el.getAttribute('data-product'));
      el.addEventListener('click', function () { el.blur(); open(el); });
      if (el.tagName !== 'BUTTON') el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(el); } });
    });
  }
  window.HomiesProductView = { open: open, close: close, bind: bind };
  bind();
  // warm the cache for the box favourites so the first open is instant
  if (document.querySelector('[data-hero-box]')) {
    window.addEventListener('load', function () {
      setTimeout(function () {
        Object.keys(FAV).forEach(function (k) { var i = new Image(); i.src = FAV[k].img; });
      }, 1200);
    });
  }
})();
