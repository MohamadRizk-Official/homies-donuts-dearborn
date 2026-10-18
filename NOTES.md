# Homie's Donuts (Dearborn) site: phase 1 notes

Static site, no build step. Open with any local server (e.g. `py -m http.server --directory homies-site`).

- `index.html`: home (pink-box hero, display case, menu preview, peek inside, visit, catering, closing)
- `menu.html`: full menu with anchors `#donuts #pizza-donuts #bunz #beignewiches #desserts #drinks`.
  Generated from index.html's header/footer by `node build-menu.js`, so re-run it after editing the header.
- `js/menu-data.js`: every menu item (name, image, tag). Items marked `verify: true` need a name check.
- `js/main.js`: `SITE.orderUrl` and `SITE.hours` at the top. Fill these in once confirmed.

## Images
Source zip filenames didn't match the brief, so each photo was matched by eye and saved as WebP under the
brief's filename (e.g. `img/donuts/Donut-Menu-Choco-Glazed.webp`). The zip had no `library_upload_*` folders.
- Oreo: used `Oreo.png` (sharper) over `Half-and-half Oreo ring donut-4.png`.
- Egg & Cheese: used `-8` over `-7`.
- Dubai donut: used `Dubai donut front view.png` over `Chocolate pistachio kataifi donut-3.png`.
- Drinks: every cup scaled to the same cup-body width on a shared canvas, so cups match in size.
- Extra "favorite" donut photos not in the brief's map were added under Homie's Favourites:
  Homers, Cookie Monster, Biscoff, Mille-Feuille, Mousse Cake, Maple, Pecan (names need confirming).
- Not used: `Pink frosted rainbow sprinkle donut` (duplicate of Homers), `Biscoff biscuit-topped crumb donut`,
  `Vibrant Cereal-Topped Donut Delight`, `Pink Donut Catering Spread`, `Three Donuts in a Long Bakery Box`,
  `pizza donuts.png`, `Inviting storefront at twilight`, `Cozy ghost latte`, `Dubai Donut Hero Experience`
  (a website mockup), `HalalFoodJunky.mp4`.
- Shop photos used: display case, interior, neon sign. Confirm they were taken at the Dearborn shop.

## Facts used vs. left out
Used: address 23780 Michigan Ave, Dearborn, MI 48124; phone (313) 722-4477 (Apple Maps + listings agree).
Left out until confirmed:
- Hours (listings disagree: 9am–10:40pm, 9am–10:50pm, 9am–11pm, 6am–11pm). The site says "call for today's hours".
- Official online ordering link (only DoorDash, Uber Eats and Yelp third-party listings were found).
- Halal wording (brief filenames say "Halal Bacon"; images show beef bacon). Shown as "Bacon".
- Drive-through, arcade, parking, seating, 30+ varieties, daily prep, food truck, app.
- Catering: shown only as "call the shop to plan a big order".
- "BEIGNEwiches" spelling: press coverage writes "beignwichs". Confirm the current branding.

## Missing assets
- Simpsonfont (Sharkshock): wired in from the DEMO file `fonts/Simpsonfont-DEMO.otf`, which is free for personal use only.
  A commercial licence (contact dennis@sharkshock.net, see sharkshock.net/license) is needed before launch.
  The demo has limited punctuation; missing characters fall back to Paytone One.
- A real pink-box product photo: the hero box is built in CSS 3D around real donut cutouts. A studio photo of the
  actual box, lid open at about 120°, could replace it later.
