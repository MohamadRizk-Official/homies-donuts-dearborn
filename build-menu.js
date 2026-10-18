// Builds menu.html from index.html's shared header, drawer and footer.
// Run: node build-menu.js
const fs = require('fs');
const idx = fs.readFileSync('index.html', 'utf8');
const head = idx.slice(0, idx.indexOf('<main id="main">'))
  .replace('<title>Homie\'s Donuts · Dearborn, Michigan Ave</title>', '<title>Menu · Homie\'s Donuts Dearborn</title>')
  .replace(/<meta name="description"[^>]*>/, '<meta name="description" content="The Homie\'s Donuts Dearborn menu: donuts, pizza donuts, BUNZ, BEIGNEwiches, desserts, milkshakes, matcha and tropical refreshers.">')
  .replace(' aria-current="page">Home', '>Home')
  .replace('data-mega-toggle>', 'data-mega-toggle aria-current="page">');
const foot = idx.slice(idx.indexOf('  <!-- ================= Footer'));
const body = `<main id="main">
    <section class="menu-hero" aria-labelledby="menu-title">
      <div class="deco" aria-hidden="true" style="inset:0">
        <span class="cloud" style="top:30%;left:-30px;transform:scale(.8)"></span>
        <span class="cloud" style="top:16%;right:-20px;transform:scale(.6)"></span>
        <span class="sprinkle" style="top:60%;left:14%;--c:var(--sky);--r:30deg"></span>
        <span class="sprinkle" style="top:40%;right:14%;--c:var(--lemon);--r:-30deg;--d:-2s"></span>
        <span class="sprinkle" style="top:76%;right:30%;--c:var(--pink);--r:70deg;--d:-4s"></span>
      </div>
      <div class="wrap">
        <span class="eyebrow">Homie's Dearborn</span>
        <h1 id="menu-title">The Menu</h1>
        <p>Sweet rings, savory surprises and cups piled high. Jump to a category below.</p>
      </div>
    </section>

    <nav class="cat-bar" aria-label="Menu categories">
      <ul>
        <li><a href="#donuts">Donuts</a></li>
        <li><a href="#pizza-donuts">Pizza Donuts</a></li>
        <li><a href="#bunz">BUNZ</a></li>
        <li><a href="#beignewiches">BEIGNEwiches</a></li>
        <li><a href="#desserts">Desserts</a></li>
        <li><a href="#drinks">Drinks</a></li>
      </ul>
    </nav>

    <div data-menu></div>
    <noscript><p class="menu-note">Turn on JavaScript to see menu photos, or call (313) 722-4477.</p></noscript>
    <p class="menu-note">Menu and availability can change day to day. Ask at the counter for today's lineup.</p>
  </main>

`;
fs.writeFileSync('menu.html', head + body + foot);
console.log('menu.html written');
