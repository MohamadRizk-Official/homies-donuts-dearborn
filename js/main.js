/* Homie's Donuts — site behaviour */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Site settings. Fill these in once the shop confirms them.
     orderUrl: leave empty until there is an official ordering link.
     When set, the header button becomes "Order Online" and the
     Visit section shows an Order button.
  ------------------------------------------------------------------ */
  var SITE = {
    orderUrl: '',
    hours: '' // e.g. 'Open daily · 9am – 11pm'
  };

  var menu = window.HOMIES_MENU || [];
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function findItem(catId, name) {
    var cat = menu.filter(function (c) { return c.id === catId; })[0];
    if (!cat) return null;
    for (var g = 0; g < cat.groups.length; g++) {
      for (var i = 0; i < cat.groups[g].items.length; i++) {
        if (cat.groups[g].items[i].name === name) return cat.groups[g].items[i];
      }
    }
    return null;
  }

  /* ---------------- Settings → page ---------------- */
  if (SITE.orderUrl) {
    document.querySelectorAll('[data-primary-cta]').forEach(function (a) {
      a.href = SITE.orderUrl;
      var label = a.querySelector('[data-primary-cta-label]');
      if (label) label.textContent = 'Order Online';
    });
    document.querySelectorAll('[data-order-cta]').forEach(function (a) {
      a.href = SITE.orderUrl; a.hidden = false; a.target = '_blank'; a.rel = 'noopener';
    });
  }
  if (SITE.hours) {
    document.querySelectorAll('[data-hours]').forEach(function (s) { s.textContent = SITE.hours; });
  }

  /* ---------------- Mega menu (desktop) ---------------- */
  var megaBtn = document.querySelector('[data-mega-toggle]');
  var mega = document.querySelector('[data-mega]');
  if (megaBtn && mega) {
    var hoverTimer, hoverOpenedAt = 0;
    var setMega = function (open) {
      megaBtn.setAttribute('aria-expanded', String(open));
      mega.classList.toggle('is-open', open);
    };
    megaBtn.addEventListener('click', function () {
      // a click that lands right after hover opened the panel should keep it open
      if (Date.now() - hoverOpenedAt < 600) { setMega(true); return; }
      setMega(megaBtn.getAttribute('aria-expanded') !== 'true');
    });
    var li = megaBtn.parentElement;
    var canHover = window.matchMedia('(hover: hover)').matches;
    if (canHover) {
      li.addEventListener('mouseenter', function () {
        clearTimeout(hoverTimer);
        if (megaBtn.getAttribute('aria-expanded') !== 'true') hoverOpenedAt = Date.now();
        setMega(true);
      });
      li.addEventListener('mouseleave', function () { hoverTimer = setTimeout(function () { setMega(false); }, 160); });
    }
    document.addEventListener('click', function (e) { if (!li.contains(e.target)) setMega(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && megaBtn.getAttribute('aria-expanded') === 'true') { setMega(false); megaBtn.focus(); }
    });
    li.addEventListener('focusout', function (e) { if (!li.contains(e.relatedTarget)) setMega(false); });
    mega.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setMega(false); }); });
  }

  /* ---------------- Drawer (phones / tablets) ---------------- */
  var drawer = document.querySelector('[data-drawer]');
  var drawerBtn = document.querySelector('[data-drawer-toggle]');
  if (drawer && drawerBtn) {
    var lastFocus;
    var openDrawer = function (open) {
      drawerBtn.setAttribute('aria-expanded', String(open));
      drawerBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      drawer.classList.toggle('is-open', open);
      document.body.classList.toggle('no-scroll', open);
      if (open) {
        lastFocus = document.activeElement;
        setTimeout(function () { var f = drawer.querySelector('a, button'); if (f) f.focus(); }, 60);
      } else if (lastFocus) { lastFocus.focus(); }
    };
    drawerBtn.addEventListener('click', function () { openDrawer(drawerBtn.getAttribute('aria-expanded') !== 'true'); });
    drawer.querySelector('[data-drawer-close]').addEventListener('click', function () { openDrawer(false); });
    drawer.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { openDrawer(false); }); });
    document.addEventListener('keydown', function (e) {
      if (!drawer.classList.contains('is-open')) return;
      if (e.key === 'Escape') openDrawer(false);
      if (e.key === 'Tab') { // keep focus inside the open drawer
        var f = drawer.querySelectorAll('a[href], button');
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    window.addEventListener('resize', function () { if (window.innerWidth >= 1000 && drawer.classList.contains('is-open')) openDrawer(false); });
  }

  /* ---------------- Home: display-case shelves ---------------- */
  var shelvesHost = document.querySelector('[data-shelves]');
  if (shelvesHost) {
    var shelves = [
      { title: "Homie's Favourites", link: 'menu.html#favourites', items: ['Elmo', 'Peanut Butter & Jelly', 'Homers', 'Cookie Monster', 'Biscoff', 'Mille-Feuille'] },
      { title: 'Signature Donuts', link: 'menu.html#signature', items: ['Dubai', 'Crème Brûlée', 'Pistachio', 'Black Forest', 'Chocolate Boston Cream', "Reese's"] },
      { title: 'The Classics', link: 'menu.html#classics', items: ['Glazed', 'Sugar', 'Cinnamon Sugar', 'Choco Glazed', 'Choco Sprinkles', 'Lil Homies'] },
      { title: 'New & Seasonal', link: 'menu.html#new', items: ['Pumpkin Spice', 'Apple Pecan', 'Matcha White Chocolate'] }
    ];
    shelves.forEach(function (s, si) {
      var row = el('div', { class: 'shelf-row', role: 'list' });
      s.items.forEach(function (name) {
        var it = findItem('donuts', name);
        if (!it) return;
        row.appendChild(el('div', { class: 'shelf-item', role: 'listitem' }, [
          el('div', { class: 'pic' }, [el('img', { src: it.img, alt: it.name + ' donut', loading: si > 0 ? 'lazy' : 'eager', width: '380', height: '330' })]),
          el('span', { class: 'tagline', text: it.name })
        ]));
      });
      var head = el('div', { class: 'shelf-head' }, [
        el('h3', { text: s.title }),
        el('a', { href: s.link, text: 'See all →', 'aria-label': 'See all ' + s.title })
      ]);
      shelvesHost.appendChild(el('div', { class: 'shelf' }, [head, row, el('div', { class: 'shelf-board', 'aria-hidden': 'true' })]));
    });
  }

  /* ---------------- Menu page ---------------- */
  var menuHost = document.querySelector('[data-menu]');
  if (menuHost) {
    menu.forEach(function (cat) {
      var count = cat.groups.reduce(function (n, g) { return n + g.items.length; }, 0);
      var head = el('div', { class: 'section-head reveal' }, [
        el('span', { class: 'eyebrow', text: cat.kicker }),
        el('h2', { id: cat.id + '-title', text: cat.title }),
        cat.savory ? el('span', { class: 'savory-note', text: 'Savory side' }) : null,
        el('div', {}, [el('span', { class: 'count', text: count + (cat.drinks ? ' drinks' : ' to choose from') })])
      ]);
      var wrap = el('div', { class: 'wrap' }, [head]);
      if (cat.banner) wrap.appendChild(el('figure', { class: 'cat-banner reveal' }, [el('img', { src: cat.banner.img, alt: cat.banner.alt, loading: 'lazy', width: '1100', height: '733' })]));
      cat.groups.forEach(function (g) {
        var grid = el('div', { class: 'grid' + (cat.drinks ? ' grid--drinks' : ''), role: 'list' });
        g.items.forEach(function (it, i) {
          var fig = el('figure', { class: 'card reveal', role: 'listitem', style: '--rd:' + (Math.min(i, 7) * 0.04) + 's' }, [
            it.tag ? el('span', { class: 'tag', 'data-tag': it.tag, text: it.tag }) : null,
            el('div', { class: 'plate' }, [el('img', { src: it.img, alt: it.name + (cat.drinks ? '' : ' — ' + cat.title.replace(/s$/, '')), loading: 'lazy', width: cat.drinks ? '440' : '600', height: cat.drinks ? '860' : '600' })]),
            el('figcaption', { text: it.name })
          ]);
          grid.appendChild(fig);
        });
        var group = el('div', { class: 'group', id: g.title ? g.id : null }, [
          g.title ? el('h3', { class: 'group-title' }, [document.createTextNode(g.title + ' '), el('span', { class: 'pill', text: String(g.items.length) })]) : null,
          grid
        ]);
        if (!g.title) group.removeAttribute('id');
        wrap.appendChild(group);
      });
      menuHost.appendChild(el('section', { class: 'menu-section', id: cat.id, 'aria-labelledby': cat.id + '-title' }, [wrap]));
    });

    // re-apply hash scroll now that sections exist
    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) requestAnimationFrame(function () {
        var top = target.getBoundingClientRect().top + window.pageYOffset - (document.querySelector('.site-header').offsetHeight + 56);
        window.scrollTo({ top: top, behavior: 'instant' });
      });
    }

    // scrollspy for the category bar
    var barLinks = document.querySelectorAll('.cat-bar a');
    if ('IntersectionObserver' in window && barLinks.length) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          barLinks.forEach(function (a) {
            var on = a.getAttribute('href') === '#' + en.target.id;
            a.classList.toggle('is-active', on);
            if (on) {
              a.setAttribute('aria-current', 'true');
              var ul = a.closest('ul');
              if (ul) ul.scrollTo({ left: a.offsetLeft - ul.clientWidth / 2 + a.clientWidth / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
            } else a.removeAttribute('aria-current');
          });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      document.querySelectorAll('.menu-section').forEach(function (s) { spy.observe(s); });
    }
  }

  /* ---------------- Hero: the box opens ---------------- */
  var heroBox = document.querySelector('[data-hero-box]');
  if (heroBox) {
    var setState = function (cls) { heroBox.classList.add(cls); };
    if (reduceMotion) {
      setState('is-open');
    } else {
      var imgs = Array.prototype.slice.call(heroBox.querySelectorAll('img'));
      var ready = Promise.all(imgs.map(function (im) {
        return im.decode ? im.decode().catch(function () {}) : Promise.resolve();
      }));
      // never leave the box shut if an image is slow
      Promise.race([ready, new Promise(function (r) { setTimeout(r, 2500); })]).then(function () {
        setState('is-in');
        setTimeout(function () { setState('is-wiggle'); }, 750);
        setTimeout(function () { setState('is-opening'); }, 1450);
        setTimeout(function () { setState('is-open'); }, 2150);
      });
    }
    // phones: tap a donut to make it pop for a moment
    heroBox.querySelectorAll('.dz .hit').forEach(function (hit) {
      hit.addEventListener('click', function () {
        var dz = hit.parentElement;
        heroBox.querySelectorAll('.dz.is-pop').forEach(function (d) { if (d !== dz) d.classList.remove('is-pop'); });
        dz.classList.add('is-pop');
        clearTimeout(dz._popT);
        dz._popT = setTimeout(function () { dz.classList.remove('is-pop'); }, 1100);
      });
    });
  }

  /* ---------------- Creator video ---------------- */
  var reel = document.querySelector('[data-reel]');
  if (reel) {
    var soundBtn = document.querySelector('[data-reel-sound]');
    var soundLabel = document.querySelector('[data-reel-label]');
    var userPaused = false;
    if (!reduceMotion && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !userPaused) { reel.play().catch(function () {}); }
          else if (!en.isIntersecting) { reel.pause(); }
        });
      }, { threshold: 0.45 }).observe(reel);
    }
    reel.addEventListener('click', function () {
      if (reel.paused) { userPaused = false; reel.play().catch(function () {}); }
      else { userPaused = true; reel.pause(); }
    });
    soundBtn.addEventListener('click', function () {
      reel.muted = !reel.muted;
      if (!reel.muted && reel.paused) { userPaused = false; reel.play().catch(function () {}); }
      soundBtn.setAttribute('aria-pressed', String(!reel.muted));
      soundLabel.textContent = reel.muted ? 'Tap for sound' : 'Sound on';
    });
  }

  /* ---------------- Reveal on scroll ---------------- */
  var reveals = document.querySelectorAll('.reveal');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (r) { io.observe(r); });
  } else {
    reveals.forEach(function (r) { r.classList.add('is-in'); });
  }
})();
