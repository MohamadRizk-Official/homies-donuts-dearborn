/* Homie's Donuts — menu data (Dearborn, Michigan Ave)
 *
 * Image files are named after the brief's category map so placement is easy to audit.
 * Names are display names only: no prices, ingredients or dietary claims are listed
 * until the shop confirms them. Items marked `verify` need a name check before launch.
 */
window.HOMIES_MENU = [
  {
    id: 'donuts',
    title: 'Donuts',
    kicker: 'Sweet rings & wild ideas',
    groups: [
      {
        id: 'classics',
        title: 'The Classics',
        items: [
          { name: 'Glazed', img: 'img/donuts/Traditional-Glazed-Donut.webp' },
          { name: 'Sugar', img: 'img/donuts/Traditional-Sugar-Donut.webp' },
          { name: 'Cinnamon Sugar', img: 'img/donuts/Traditional-Cinnamon-Sugar-Donut.webp' },
          { name: 'Choco Glazed', img: 'img/donuts/Donut-Menu-Choco-Glazed.webp' },
          { name: 'Choco Sprinkles', img: 'img/donuts/Donut-Menu-Choco-Sprinkles.webp' },
          { name: 'Lil Homies', img: 'img/donuts/Donut-Menu-Lil-Homies.webp' }
        ]
      },
      {
        id: 'signature',
        title: 'Signature Donuts',
        items: [
          { name: 'Apple Fritter', img: 'img/donuts/Donut-Menu-Apple-Fritter.webp' },
          { name: 'Black Forest', img: 'img/donuts/Donut-Menu-Black-Forest.webp' },
          { name: 'Cannoli', img: 'img/donuts/Donut-Menu-Cannoli.webp' },
          { name: 'Cheesecake', img: 'img/donuts/Donut-Menu-Cheesecake.webp' },
          { name: 'Chocolate Boston Cream', img: 'img/donuts/Donut-Menu-Chocolate-Boston-Cream.webp' },
          { name: 'Choco Croquant', img: 'img/donuts/Donut-Menu-Choco-Croquant.webp' },
          { name: 'Citron Crumble', img: 'img/donuts/Donut-Menu-Citron-Crumble.webp' },
          { name: 'Crème Brûlée', img: 'img/donuts/Donut-Menu-Creme-Brulee.webp' },
          { name: 'Dubai', img: 'img/donuts/Donut-Menu-Dubai.webp' },
          { name: 'Dulce de Leche', img: 'img/donuts/Donut-Menu-Dulce-de-Leche.webp' },
          { name: 'KitKat', img: 'img/donuts/Donut-Menu-KitKat.webp' },
          { name: 'Maple Bacon', img: 'img/donuts/Donut-Menu-Maple-Bacon.webp', verify: true },
          { name: 'Nutella', img: 'img/donuts/Donut-Menu-Nutella.webp' },
          { name: 'Oreo', img: 'img/donuts/Donut-Menu-Oreo.webp' },
          { name: 'Pistachio', img: 'img/donuts/Donut-Menu-Pistachio.webp' },
          { name: "Reese's", img: 'img/donuts/Donut-Menu-Reeses.webp' }
        ]
      },
      {
        id: 'favourites',
        title: "Homie's Favourites",
        items: [
          { name: 'Elmo', img: 'img/donuts/Homies-Favourites-Elmo-Donut.webp', tag: 'Favourite' },
          { name: 'Peanut Butter & Jelly', img: 'img/donuts/Homies-Favourites-Peanut-Butter-Jelly-Donut.webp', tag: 'Favourite' },
          /* Extra "favorite" photos found in the zip but not in the brief's map — confirm names */
          { name: 'Homers', img: 'img/donuts/Extra-Favourite-Homers.webp', tag: 'Favourite', verify: true },
          { name: 'Cookie Monster', img: 'img/donuts/Extra-Favourite-Cookie-Monster.webp', tag: 'Favourite', verify: true },
          { name: 'Biscoff', img: 'img/donuts/Extra-Favourite-Biscoff.webp', tag: 'Favourite', verify: true },
          { name: 'Mille-Feuille', img: 'img/donuts/Extra-Favourite-Mille-Feuille.webp', tag: 'Favourite', verify: true },
          { name: 'Mousse Cake', img: 'img/donuts/Extra-Favourite-Mousse-Cake.webp', tag: 'Favourite', verify: true },
          { name: 'Maple', img: 'img/donuts/Extra-Favourite-Maple.webp', tag: 'Favourite', verify: true },
          { name: 'Pecan', img: 'img/donuts/Extra-Favourite-Pecan.webp', tag: 'Favourite', verify: true }
        ]
      },
      {
        id: 'new',
        title: 'New & Seasonal',
        items: [
          { name: 'Pumpkin Spice', img: 'img/donuts/New-Pumpkin-Spice-Donut.webp', tag: 'Seasonal' },
          { name: 'Apple Pecan', img: 'img/donuts/New-Apple-Pecan-Donut.webp', tag: 'New' },
          { name: 'Matcha White Chocolate', img: 'img/donuts/New-Matcha-White-Chocolate-Donut.webp', tag: 'New' }
        ]
      }
    ]
  },
  {
    id: 'pizza-donuts',
    title: 'Pizza Donuts',
    kicker: 'The savory side of the box',
    savory: true,
    groups: [
      {
        id: 'pizza',
        title: '',
        items: [
          { name: 'Cheese', img: 'img/pizza/Cheese-Pizza-Donut.webp' },
          { name: 'Pepperoni, Cheese & Hot Honey', img: 'img/pizza/Pepperoni-Cheese-Hot-Honey-Pizza-Donut.webp' },
          { name: 'Jalapeño Cheddar Ranch', img: 'img/pizza/Jalapeno-Cheddar-Ranch-Pizza-Donut.webp' },
          { name: 'Pesto Pistachio', img: 'img/pizza/Pesto-Pistachio-Pizza-Donut.webp' },
          { name: 'Dill Pickle Ranch', img: 'img/pizza/Dill-Pickle-Ranch-Pizza-Donut.webp' },
          { name: 'Tomato Parsley', img: 'img/pizza/Tomato-Parsley-Pizza-Donut.webp' }
        ]
      }
    ]
  },
  {
    id: 'bunz',
    title: 'BUNZ',
    kicker: 'Big, swirly cinnamon buns',
    groups: [
      {
        id: 'bunz-all',
        title: '',
        items: [
          { name: 'Classic', img: 'img/bunz/BUNZ-Classic.webp' },
          { name: 'Biscoff', img: 'img/bunz/BUNZ-Biscoff.webp' },
          { name: 'Caramel Pecan', img: 'img/bunz/BUNZ-Caramel-Pecan.webp' },
          { name: 'Oreo Cheesecake', img: 'img/bunz/BUNZ-Oreo-Cheesecake.webp' },
          { name: 'Pistachio Raspberry', img: 'img/bunz/BUNZ-Pistachio-Raspberry.webp' },
          { name: 'Tiramisu', img: 'img/bunz/BUNZ-Tiramisu.webp' }
        ]
      }
    ]
  },
  {
    id: 'beignewiches',
    title: 'BEIGNEwiches',
    kicker: 'Stacked savory sandwiches',
    savory: true,
    groups: [
      {
        id: 'beignewiches-all',
        title: '',
        /* Brief filenames say "Halal Bacon": halal wording is left off until confirmed */
        items: [
          { name: 'Cheeseburger', img: 'img/beignewiches/Savory-Donuts-Cheeseburger.webp' },
          { name: 'Egg & Cheese', img: 'img/beignewiches/Savory-Donuts-Egg-and-Cheese.webp' },
          { name: 'Egg, Bacon & Cheese', img: 'img/beignewiches/Savory-Donuts-Egg-Halal-Bacon-and-Cheese.webp', verify: true },
          { name: 'Fried Chicken, Cheese & Bacon', img: 'img/beignewiches/Savory-Donuts-Fried-Chicken-Cheese-Halal-Bacon.webp', verify: true },
          { name: 'Fried Chicken, Pickle & Chipotle Mayo', img: 'img/beignewiches/Savory-Donuts-Fried-Chicken-Pickle-Chipotle-Mayo.webp' },
          { name: 'Steak ’n Cheese', img: 'img/beignewiches/Savory-Donuts-Steak-N-Cheese.webp' },
          { name: 'Steak ’n Egg', img: 'img/beignewiches/Savory-Donuts-Steak-N-Egg.webp' },
          { name: 'Loaded Potatoes & Steak', img: 'img/beignewiches/Savory-Donuts-Loaded-Potatoes-Steak.webp' }
        ]
      }
    ]
  },
  {
    id: 'desserts',
    title: 'Desserts',
    kicker: 'Little treats, big feelings',
    groups: [
      {
        id: 'desserts-all',
        title: '',
        items: [
          { name: 'Dubai Chocolate', img: 'img/desserts/Desserts-Dubai-Chocolate.webp' },
          { name: 'Macarons', img: 'img/desserts/Desserts-Macarons.webp' }
        ]
      }
    ]
  },
  {
    id: 'drinks',
    title: 'Drinks',
    kicker: 'Shakes, matcha & refreshers',
    drinks: true,
    groups: [
      {
        id: 'milkshakes',
        title: 'Milkshakes',
        items: [
          { name: 'Vanilla', img: 'img/drinks/Milkshakes-Vanilla.webp' },
          { name: 'Chocolate', img: 'img/drinks/Milkshakes-Chocolate.webp' },
          { name: 'Strawberry', img: 'img/drinks/Milkshakes-Strawberry.webp' },
          { name: 'Banana', img: 'img/drinks/Milkshakes-Banana.webp' },
          { name: 'Choco Banana', img: 'img/drinks/Milkshakes-Choco-Banana.webp' },
          { name: 'Coffee', img: 'img/drinks/Milkshakes-Coffee.webp' },
          { name: 'Bubblegum', img: 'img/drinks/Milkshakes-Bubblegum.webp' },
          { name: 'Raspberry', img: 'img/drinks/Milkshakes-Raspberry.webp' },
          { name: 'Cookie Monster', img: 'img/drinks/Milkshakes-Cookie-Monster.webp' },
          { name: 'Oreo', img: 'img/drinks/Milkshakes-Oreo.webp' },
          { name: 'Biscoff', img: 'img/drinks/Milkshakes-Biscoff.webp' },
          { name: 'Dubai', img: 'img/drinks/Milkshakes-Dubai.webp' },
          { name: 'KitKat', img: 'img/drinks/Milkshakes-KitKat.webp' },
          { name: "Reese's", img: 'img/drinks/Milkshakes-Reeses.webp' },
          { name: 'Skor', img: 'img/drinks/Milkshakes-Skor.webp' },
          { name: 'Smarties', img: 'img/drinks/Milkshakes-Smarties.webp' }
        ]
      },
      {
        id: 'matcha',
        title: 'Matcha',
        items: [
          { name: 'Strawberry Matcha', img: 'img/drinks/Matcha-Strawberry.webp' },
          { name: 'Vanilla Matcha Latte', img: 'img/drinks/Matcha-Vanilla-Latte.webp' }
        ]
      },
      {
        id: 'tropical',
        title: 'Tropical Refreshers',
        items: [
          { name: 'Açaí', img: 'img/drinks/Tropical-Drinks-Acai.webp' },
          { name: 'Dragon Fruit Refresher', img: 'img/drinks/Tropical-Drinks-Dragon-Fruit-Refresher.webp' },
          { name: 'Mango', img: 'img/drinks/Tropical-Drinks-Mango.webp' }
        ]
      }
    ]
  }
];
