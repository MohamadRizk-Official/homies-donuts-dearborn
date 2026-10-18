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
- Hero box (js/hero-box.js): the base + donuts are the supplied open-box photo, cut cleanly (img/hero/box-base.webp)
  with a soft SVG contact shadow instead of the photo's ragged one. The camera was recovered from the box rim
  (focal ~2240px, box ratio 1.41:1), and the lid is drawn as textured faces projected through that camera, so it
  hinges on the real back edge, closes over the whole box, and opens to 135°. Lid textures were flattened from
  the photos: inside (logo + MADE IN THE NEIGHBOURHOOD) from the open box, outside rings from the closed box.
  Each donut is still its own layer (hover/tap lifts it, tucked behind the box walls).
- Catering: truck illustration (img/brand/truck.webp) + the catering spread photo.
- Photo wall: display case, Choco Dubai trays, ghost latte, interior, three-donut box, neon sign, cereal donuts.
- Menu page: pizza donut box photo as the Pizza Donuts banner.
- Video: media/homies-halalfoodjunky.mp4 (compressed from HalalFoodJunky.mp4), credited to Halal Food Junkie,
  https://www.instagram.com/halalfoodjunkie/ (125K followers when checked on 18 Oct 2026; recheck before launch).
  Confirm the creator is OK with it being re-hosted on the site.
- Not used: Inviting storefront at twilight (shows a pink storefront; the real Dearborn exterior in the video is blue),
  Dubai Donut Hero Experience (a website mockup), and duplicates (Pink frosted rainbow sprinkle, Biscoff crumb donut).
- Shop photos used: display case, interior, neon sign. Confirm they were taken at the Dearborn shop.

## Ordering, phone and favourites
- js/main.js SITE.orderUrl = the Homie's Dearborn DoorDash listing (the only online ordering destination found for
  23780 Michigan Ave). Every Order Now uses it; clear it and they all fall back to calling the shop.
- Phone (313) 722-4477 matches Apple Maps, Yahoo Local and a directory listing. Not confirmed by an official
  Homie's source.
- Favourites detail view (js/product-view.js): copy describes only what is visible in each photo. Images are
  img/fav/*.webp from the original favourite PNGs (the brief's *-reference.png names weren't in the files).
- Hero headline options considered: "Open up the happiest box in Dearborn." (chosen), "Dearborn's sweetest box of
  happy.", "Six donuts. Zero regrets.", "Life's sweeter by the half-dozen."

## Facts used vs. left out
Used: address 23780 Michigan Ave, Dearborn, MI 48124; phone (313) 722-4477 (Apple Maps + listings agree).
Left out until confirmed:
- Hours (listings disagree: 9am–10:40pm, 9am–10:50pm, 9am–11pm, 6am–11pm). The site says "call for today's hours".
- Official online ordering link (only DoorDash, Uber Eats and Yelp third-party listings were found).
- Halal wording (brief filenames say "Halal Bacon"; images show beef bacon). Shown as "Bacon".
- Drive-through (the creator video shows a box handed through a car window, but it is not advertised), arcade,
  parking, seating, 30+ varieties, daily prep, food truck, app.
- Catering: shown only as "call the shop to plan a big order".
- "BEIGNEwiches" spelling: press coverage writes "beignwichs". Confirm the current branding.

## Missing assets
- Simpsonfont (Sharkshock): wired in from the DEMO file `fonts/Simpsonfont-DEMO.otf`, which is free for personal use only.
  A commercial licence (contact dennis@sharkshock.net, see sharkshock.net/license) is needed before launch.
  The demo has limited punctuation; missing characters fall back to Paytone One.
