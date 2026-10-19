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

  // ---- build the view once
  var view = document.createElement('div');
  view.className = 'pv'; view.hidden = true;
  view.setAttribute('role', 'dialog'); view.setAttribute('aria-modal', 'true'); view.setAttribute('aria-labelledby', 'pv-title');
  view.innerHTML =
    '<div class="pv-bg" aria-hidden="true"></div>' +
    '<div class="pv-accents" aria-hidden="true"></div>' +
    '<button class="pv-close" type="button" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button>' +
    '<div class="pv-inner">' +
      '<div class="pv-copy">' +
        '<p class="pv-kicker"></p>' +
        '<h2 class="pv-title" id="pv-title"></h2>' +
        '<svg class="pv-squiggle" viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true"><path d="M3 14 Q 40 2 78 12 T 152 12 T 226 12 T 297 8" fill="none" stroke="#ffc83d" stroke-width="6" stroke-linecap="round"/></svg>' +
        '<p class="pv-desc"></p>' +
        '<a class="btn pv-order" target="_blank" rel="noopener" data-burst>Order Now <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></a>' +
        '<button class="pv-back" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span></span></button>' +
      '</div>' +
      '<figure class="pv-figure"><span class="pv-halo" aria-hidden="true"></span><img class="pv-img" alt=""></figure>' +
    '</div>';
  document.body.appendChild(view);
  var $ = function (s) { return view.querySelector(s); };
  var lastTrigger = null, closeTimer = null;

  function accents(spec) {
    var host = $('.pv-accents'); host.innerHTML = '';
    var n = spec.kind === 'bubble' ? 14 : 18;
    for (var i = 0; i < n; i++) {
      var s = document.createElement('span');
      s.className = 'pv-acc pv-acc--' + spec.kind;
      var size = spec.kind === 'sprinkle' ? 0 : (6 + Math.random() * 16);
      s.style.setProperty('--c', spec.colors[i % spec.colors.length]);
      s.style.setProperty('--x', (Math.random() * 100).toFixed(1) + '%');
      s.style.setProperty('--y', (Math.random() * 100).toFixed(1) + '%');
      s.style.setProperty('--r', Math.round(Math.random() * 360) + 'deg');
      s.style.setProperty('--s', (0.6 + Math.random() * 0.9).toFixed(2));
      s.style.setProperty('--d', (-Math.random() * 14).toFixed(1) + 's');
      s.style.setProperty('--t', (12 + Math.random() * 12).toFixed(1) + 's');
      if (size) s.style.setProperty('--z', size.toFixed(0) + 'px');
      // keep the left text column mostly clear on wide screens
      if (i % 3 === 0) s.style.setProperty('--x', (55 + Math.random() * 45).toFixed(1) + '%');
      host.appendChild(s);
    }
  }

  function open(trigger) {
    var name = trigger.getAttribute('data-product');
    var catId = trigger.getAttribute('data-cat-id') || null;
    var found = find(name, catId);
    if (!found) return;
    var fav = FAV[name] && (!catId || catId === 'donuts') && found.group.id === 'favourites' ? FAV[name] : null;
    var cat = CAT[found.cat.id] || CAT.donuts;
    var mood = fav ? fav.mood : cat.mood;
    var title = fav ? fav.title : [found.item.name];
    lastTrigger = trigger;
    clearTimeout(closeTimer);

    view.style.setProperty('--pv-bg1', mood.bg1); view.style.setProperty('--pv-bg2', mood.bg2);
    view.style.setProperty('--pv-ink', mood.ink); view.style.setProperty('--pv-glow', mood.glow);
    $('.pv-kicker').textContent = (found.group.title || found.cat.title) + (found.item.tag && found.item.tag !== 'Favourite' ? ' · ' + found.item.tag : '');
    var h = $('.pv-title'); h.innerHTML = '';
    title.forEach(function (part, i) {
      var span = document.createElement('span');
      span.textContent = part; if (i === title.length - 1 && title.length > 1) span.className = 'pv-accent-word';
      h.appendChild(span);
    });
    $('.pv-desc').textContent = fav ? fav.desc : defaultCopy(found);
    var img = $('.pv-img'); img.src = fav ? fav.img : found.item.img; img.alt = found.item.name;
    view.classList.toggle('pv--drink', found.cat.id === 'drinks');
    var order = $('.pv-order'); order.href = SITE.orderHref || '#';
    if (!SITE.orderUrl) { order.removeAttribute('target'); }
    var backLabel = trigger.closest('[data-hero-box]') ? 'Back to the box' : fav ? 'Back to favourites' : (document.querySelector('[data-menu]') ? 'Back to the menu' : 'Back to the case');
    $('.pv-back span').textContent = backLabel;
    accents(fav ? fav.accents : cat.accents);

    view.hidden = false;
    document.documentElement.classList.add('pv-open');
    // restart the entrance sequence
    view.classList.remove('is-in', 'is-out'); void view.offsetWidth; view.classList.add('is-in');
    setTimeout(function () { $('.pv-close').focus({ preventScroll: true }); }, reduce ? 0 : 60);
  }
  function defaultCopy(f) {
    if (f.cat.id === 'drinks') return 'A Homie\'s ' + (f.group.title || 'drink').toLowerCase().replace(/s$/, '') + ', shaken up and piled high. Ask at the counter for today\'s lineup.';
    if (f.cat.savory) return 'From the savory side of the menu. Ask at the counter for today\'s lineup.';
    return 'Part of the ' + (f.group.title || f.cat.title) + ' lineup at Homie\'s Dearborn. Ask at the counter for today\'s selection.';
  }
  function close() {
    if (view.hidden) return;
    view.classList.add('is-out'); view.classList.remove('is-in');
    closeTimer = setTimeout(function () {
      view.hidden = true; view.classList.remove('is-out');
      document.documentElement.classList.remove('pv-open');
    }, reduce ? 0 : 280);
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus({ preventScroll: true });
  }

  $('.pv-close').addEventListener('click', close);
  $('.pv-back').addEventListener('click', close);
  view.addEventListener('click', function (e) { if (e.target === view || e.target.classList.contains('pv-bg')) close(); });
  document.addEventListener('keydown', function (e) {
    if (view.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') {   // keep keyboard focus inside the view
      var f = view.querySelectorAll('button, a[href]'); var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  // the header stays usable: following one of its links closes the view first
  var header = document.querySelector('.site-header');
  if (header) header.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });

  function bind(root) {
    (root || document).querySelectorAll('[data-product]').forEach(function (el) {
      if (el._pv) return; el._pv = true;
      if (!el.hasAttribute('tabindex') && el.tagName !== 'BUTTON' && el.tagName !== 'A') el.setAttribute('tabindex', '0');
      if (el.getAttribute('role') !== 'listitem') el.setAttribute('role', 'button');
      el.setAttribute('aria-haspopup', 'dialog');
      el.setAttribute('aria-label', 'View ' + el.getAttribute('data-product'));
      el.addEventListener('click', function () { open(el); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(el); } });
    });
  }
  window.HomiesProductView = { open: open, close: close, bind: bind };
  bind();
})();
