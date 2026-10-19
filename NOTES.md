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
- Drinks: shorter cups scaled up so every cup matches the coffee milkshake cup (about 550px on a shared 480x960
  canvas); cups that were already that tall were left alone.
- Extra "favorite" donut photos not in the brief's map were added under Homie's Favourites:
  Homers, Cookie Monster, Biscoff, Mille-Feuille, Mousse Cake, Maple, Pecan (names need confirming).
- Hero box (js/hero-box.js): the base + donuts are the supplied open-box photo, cut cleanly (img/hero/box-base.webp)
  with a soft SVG contact shadow instead of the photo's ragged one. The camera was recovered from the box rim
  (focal ~2240px, box ratio 1.41:1), and the lid is drawn as textured faces projected through that camera, so it
  hinges on the real back edge, closes over the whole box, and opens to 135°. Lid textures were flattened from
  the photos: inside (logo + MADE IN THE NEIGHBOURHOOD) from the open box, outside rings from the closed box.
  The box now holds the six favourites. Cookie Monster, Homers and Elmo come from the supplied box photo; the
  photo's other three donuts (not favourites) were replaced with the real Biscoff, Mille-Feuille and PB&J photos
  (img/hero/donut-biscoff|mille-feuille|pbj.webp), foreshortened to the box angle with a fried-dough side.
  Each donut is a button that opens its detail view. The box starts closed on every page load; the falling
  donut in the hero scene below is what opens it.
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

## Hero box donut overlay
- js/box-overlay.js: only the six donuts in the hero box ([data-donut]) open it. Centred panel with the real favourite
  photo (img/fav/*.webp), name, a short description of what's visible, Order Now, and an X. Each donut has its own
  colour mood, surface pattern and flavour particles (Cookie Monster: blue sprinkles; Elmo: red sprinkles; Homers:
  rainbow sprinkles; Biscoff: falling crumbs; Mille-Feuille: swaying pastry flakes; PB&J: rising jelly drops), kept to
  the backdrop and the panel's outer edges. Close with X, Escape or a click outside.

## Favourite detail views (menu and shelf cards)
- The six mockups (img/fav-detail/01-Elmo-Donut.webp … 06-Mille-Feuille-Donut.webp) are the supplied files, unchanged.
  They arrived as unnamed .webp attachments and were matched to names by content.
- Wide screens show the whole mockup (object-fit: contain, never cropped or enlarged, no filters). Real links/buttons sit
  exactly over its drawn Order Now, Back to favourites and X. Narrow/portrait screens rebuild the layout in HTML with the
  mockup's own donut artwork (*-donut.webp, an unfiltered crop) and the mockup's wording.
- Clicking a donut in the hero box flies it into its spot in the mockup; closing flies it back.

## Reviews
- Three verbatim Google reviews (Moses, Lola D, Diana Gray) from Google's place data for Homie's Donuts,
  place ID ChIJ_73tSwBLO4gRcI0Y92rwg_Q, fetched 18 Oct 2026. Rating 4.5 from 311 reviews at that date.
- Leave a Review: https://search.google.com/local/writereview?placeid=ChIJ_73tSwBLO4gRcI0Y92rwg_Q (opens Google sign-in).
- Read all: https://www.google.com/maps?cid=17619190509406293360

## Hero box scene (js/hero-scene.js)
- Every fresh load / refresh: the box sits closed and still; a chocolate-sprinkle donut falls in already tilted and
  levels out smoothly as it comes down, hits the lid, and the lid gives under the hit and swings open with momentum
  (gravity about the hinge, damping, a small bounce on its 135° stop). The donut carries on in one ballistic arc
  (no pause, no straight drop): off the lid, one flip, down onto the ground well clear of the box, a short slide,
  settled. Then a small gray silhouette runs in from the right, bends, picks it up, turns round gradually (the
  donut swings over its head to the other side) and runs off with it. It starts once the box is on screen and
  plays once per load.
- Lid: drawn as real 3D cardboard (board thickness, cut edges, matching front and side flaps, a rounded hinge fold,
  baked fold/hinge shading, light and shadows, a contact shadow on the walls) in its own canvas inside the lid
  layer, so an open lid still sits behind the box. The flat CSS faces in js/hero-box.js remain as the fallback.
- Donut: img/hero/sprinkle-donut.glb, built by tools/make_donut.py from the chocolate-sprinkle product photo
  (traced outline, raised sprinkles, satin glaze, an evenly golden fried underside with the pale fry line).
  Usage: py -3.12 -I tools/make_donut.py photo.webp out.glb
- Mascot: a small, flat 2D gray silhouette (about the donut's size): rounded body fuller at the lower belly, slim
  legs, smooth featureless head. Drawn on a 2D canvas above the 3D layer (the donut's outline is cut out of it
  wherever the donut is in front). A little skeleton underneath walks on the real ground: legs and arms use
  two-bone IK, feet are planted on footprints laid along its path, and the turn foreshortens it gradually like a
  cut-out instead of flipping.
- Where it happens adapts to the screen: beside the box on wide screens, in front of the box's right corner on
  laptops, tablets and phones (the hero and the phone layout have extra floor below the box for this). If that
  patch of ground is below the fold, the donut waits there and the mascot runs in once it scrolls into view.
- Reduced motion: the box is shown open with the mascot standing beside it holding the donut up. No WebGL / library
  unavailable: the lid opens on its own (CSS lid) after a short wait.
- Debug: index.html?dropslow=1000 then HomiesDonutDrop.seek(seconds) or .frame(seconds); .times has the key moments.
