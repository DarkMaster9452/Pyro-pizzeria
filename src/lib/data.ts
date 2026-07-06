import type {
  Restaurant,
  Product,
  Category,
  Coupon,
  Allergen,
} from "./types";

export const CATEGORIES: Category[] = [
  { id: "pizza", name: "Pizza", icon: "🍕" },
  { id: "burgers", name: "Burgery", icon: "🍔" },
  { id: "pasta", name: "Cestoviny", icon: "🍝" },
  { id: "salads", name: "Šaláty", icon: "🥗" },
  { id: "sides", name: "Prílohy", icon: "🍟" },
  { id: "desserts", name: "Dezerty", icon: "🍰" },
  { id: "drinks", name: "Nápoje", icon: "🥤" },
];

export const ALLERGENS: Allergen[] = [
  { code: "1", name: "Obilniny s lepkom" },
  { code: "3", name: "Vajcia" },
  { code: "7", name: "Mlieko" },
  { code: "8", name: "Orechy" },
  { code: "9", name: "Zeler" },
  { code: "10", name: "Horčica" },
  { code: "11", name: "Sezam" },
];

const PIZZA_SIZES = [
  { id: "s", label: "26 cm", priceDelta: 0 },
  { id: "m", label: "32 cm", priceDelta: 2.2 },
  { id: "l", label: "40 cm", priceDelta: 4.5 },
];

const ONE_SIZE = [{ id: "std", label: "Štandard", priceDelta: 0 }];

export const RESTAURANTS: Restaurant[] = [
  {
    id: "pyro",
    name: "Pyro Pizzeria",
    tagline: "Pravá pec, pravá chuť.",
    city: "Kamenná Poruba",
    address: "Kamenná Poruba 215, 013 14",
    phone: "+421 907 111 222",
    email: "objednavky@pyropizzeria.sk",
    image:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1595854341625-f33ee10dbf94?w=800&q=80",
      "https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?w=800&q=80",
      "https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=800&q=80",
    ],
    lat: 49.1725,
    lng: 18.6231,
    prepTimeMinutes: 25,
    accent: "#B22222",
    openingHours: [
      { day: 0, open: "10:30", close: "22:00" },
      { day: 1, open: "10:30", close: "22:00" },
      { day: 2, open: "10:30", close: "22:00" },
      { day: 3, open: "10:30", close: "22:00" },
      { day: 4, open: "10:30", close: "23:00" },
      { day: 5, open: "11:00", close: "23:00" },
      { day: 6, open: "11:00", close: "21:30" },
    ],
    deliveryZones: [
      {
        id: "pyro-a",
        name: "Zóna A",
        minimumOrder: 10,
        deliveryFee: 0,
        estimatedMinutes: 35,
        areas: ["Kamenná Poruba", "Poluvsie", "Hlavná", "Školská", "Záhradná"],
      },
      {
        id: "pyro-b",
        name: "Zóna B",
        minimumOrder: 15,
        deliveryFee: 2,
        estimatedMinutes: 45,
        areas: ["Rajecké Teplice", "Konská", "Kunerad", "Kaplna"],
      },
      {
        id: "pyro-c",
        name: "Zóna C",
        minimumOrder: 20,
        deliveryFee: 3,
        estimatedMinutes: 55,
        areas: ["Zbyňov", "Kľače", "Jasenové", "Ďurčiná"],
      },
    ],
  },
  {
    id: "polomarik",
    name: "Polomárik",
    tagline: "Domáca pohoda pod Malou Fatrou.",
    city: "Stráňavy",
    address: "Stráňavy 435, 013 25",
    phone: "+421 908 333 444",
    email: "objednavky@polomarik.sk",
    image:
      "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
      "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80",
      "https://images.unsplash.com/photo-1552539618-7eec9b4d1796?w=800&q=80",
    ],
    lat: 49.171,
    lng: 18.8342,
    prepTimeMinutes: 30,
    accent: "#E85D04",
    openingHours: [
      { day: 0, open: "11:00", close: "21:30" },
      { day: 1, open: "11:00", close: "21:30" },
      { day: 2, open: "11:00", close: "21:30" },
      { day: 3, open: "11:00", close: "22:00" },
      { day: 4, open: "11:00", close: "22:30" },
      { day: 5, open: "11:00", close: "22:30" },
      { day: 6, open: "12:00", close: "21:00", closed: false },
    ],
    deliveryZones: [
      {
        id: "polo-a",
        name: "Zóna A",
        minimumOrder: 10,
        deliveryFee: 0,
        estimatedMinutes: 35,
        areas: ["Stráňavy", "Nová", "Pri Potoku", "Fatranská"],
      },
      {
        id: "polo-b",
        name: "Zóna B",
        minimumOrder: 15,
        deliveryFee: 2,
        estimatedMinutes: 45,
        areas: ["Strečno", "Nezbudská Lúčka", "Dolná Tižina"],
      },
      {
        id: "polo-c",
        name: "Zóna C",
        minimumOrder: 20,
        deliveryFee: 3,
        estimatedMinutes: 55,
        areas: ["Gbeľany", "Kotrčiná Lúčka", "Varín"],
      },
    ],
  },
];

// Shared menu template applied per restaurant with small price/name variance.
function buildMenu(restaurantId: string, priceMod: number): Product[] {
  const P = (n: number) => Math.round((n + priceMod) * 100) / 100;
  return [
    // ---------------- PIZZA ----------------
    {
      id: `${restaurantId}-margherita`,
      restaurantId,
      category: "pizza",
      name: "Margherita",
      description:
        "Paradajkový základ San Marzano, mozzarella fior di latte, čerstvá bazalka, olivový olej.",
      image:
        "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=800&q=80",
      basePrice: P(6.9),
      sizes: PIZZA_SIZES,
      ingredients: ["Paradajkový základ", "Mozzarella", "Bazalka", "Olivový olej"],
      allergens: ["1", "7"],
      badges: ["vegetarian", "bestseller"],
      available: true,
    },
    {
      id: `${restaurantId}-diavola`,
      restaurantId,
      category: "pizza",
      name: "Diavola",
      description:
        "Pikantná saláma, čili, mozzarella, paradajkový základ a kvapka medu.",
      image:
        "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800&q=80",
      basePrice: P(8.5),
      sizes: PIZZA_SIZES,
      ingredients: ["Paradajkový základ", "Mozzarella", "Pikantná saláma", "Čili"],
      allergens: ["1", "7"],
      badges: ["spicy", "recommended"],
      available: true,
    },
    {
      id: `${restaurantId}-quattro`,
      restaurantId,
      category: "pizza",
      name: "Quattro Formaggi",
      description:
        "Mozzarella, gorgonzola, parmezán a údený syr na smotanovom základe.",
      image:
        "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80",
      basePrice: P(9.2),
      sizes: PIZZA_SIZES,
      ingredients: ["Smotanový základ", "Mozzarella", "Gorgonzola", "Parmezán", "Údený syr"],
      allergens: ["1", "7"],
      badges: ["vegetarian"],
      available: true,
    },
    {
      id: `${restaurantId}-prosciutto`,
      restaurantId,
      category: "pizza",
      name: "Prosciutto e Funghi",
      description: "Šunka, čerstvé šampiňóny, mozzarella, oregano.",
      image:
        "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=800&q=80",
      basePrice: P(8.9),
      sizes: PIZZA_SIZES,
      ingredients: ["Paradajkový základ", "Mozzarella", "Šunka", "Šampiňóny"],
      allergens: ["1", "7"],
      badges: ["bestseller"],
      available: true,
    },
    {
      id: `${restaurantId}-pyrospecial`,
      restaurantId,
      category: "pizza",
      name: restaurantId === "pyro" ? "Pyro Special" : "Polomárik Special",
      description:
        "Domáca špecialita – klobása, slanina, cibuľa, jalapeño, dvojitý syr.",
      image:
        "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=800&q=80",
      basePrice: P(10.9),
      sizes: PIZZA_SIZES,
      ingredients: ["Paradajkový základ", "Mozzarella", "Klobása", "Slanina", "Cibuľa", "Jalapeño"],
      allergens: ["1", "7"],
      badges: ["new", "spicy", "recommended"],
      available: true,
    },
    {
      id: `${restaurantId}-vegetariana`,
      restaurantId,
      category: "pizza",
      name: "Vegetariana",
      description: "Cuketa, baklažán, paprika, cherry paradajky, rukola.",
      image:
        "https://images.unsplash.com/photo-1511689660979-10d2b1aada49?w=800&q=80",
      basePrice: P(8.4),
      sizes: PIZZA_SIZES,
      ingredients: ["Paradajkový základ", "Mozzarella", "Cuketa", "Baklažán", "Paprika", "Rukola"],
      allergens: ["1", "7"],
      badges: ["vegetarian"],
      available: true,
    },
    // ---------------- BURGERS ----------------
    {
      id: `${restaurantId}-classic-burger`,
      restaurantId,
      category: "burgers",
      name: "Classic Beef Burger",
      description: "150g hovädzie mäso, cheddar, slanina, karamelizovaná cibuľa, BBQ.",
      image:
        "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80",
      basePrice: P(8.9),
      sizes: ONE_SIZE,
      ingredients: ["Hovädzie mäso", "Cheddar", "Slanina", "Cibuľa", "BBQ omáčka"],
      allergens: ["1", "3", "7", "10"],
      badges: ["bestseller"],
      available: true,
    },
    {
      id: `${restaurantId}-spicy-burger`,
      restaurantId,
      category: "burgers",
      name: "Firestarter Burger",
      description: "Pikantné kuracie mäso, jalapeño, chipotle majonéza, ľadový šalát.",
      image:
        "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&q=80",
      basePrice: P(8.5),
      sizes: ONE_SIZE,
      ingredients: ["Kuracie mäso", "Jalapeño", "Chipotle majonéza", "Ľadový šalát"],
      allergens: ["1", "3", "10"],
      badges: ["spicy", "new"],
      available: true,
    },
    // ---------------- PASTA ----------------
    {
      id: `${restaurantId}-carbonara`,
      restaurantId,
      category: "pasta",
      name: "Spaghetti Carbonara",
      description: "Pravá carbonara – guanciale, žĺtok, pecorino, čierne korenie.",
      image:
        "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&q=80",
      basePrice: P(8.2),
      sizes: ONE_SIZE,
      ingredients: ["Špagety", "Guanciale", "Žĺtok", "Pecorino"],
      allergens: ["1", "3", "7"],
      badges: ["recommended"],
      available: true,
    },
    {
      id: `${restaurantId}-arrabbiata`,
      restaurantId,
      category: "pasta",
      name: "Penne Arrabbiata",
      description: "Penne v pikantnej paradajkovej omáčke s cesnakom a čili.",
      image:
        "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80",
      basePrice: P(7.4),
      sizes: ONE_SIZE,
      ingredients: ["Penne", "Paradajky", "Cesnak", "Čili"],
      allergens: ["1"],
      badges: ["vegetarian", "spicy"],
      available: true,
    },
    // ---------------- SALADS ----------------
    {
      id: `${restaurantId}-caesar`,
      restaurantId,
      category: "salads",
      name: "Caesar Salát",
      description: "Rímsky šalát, grilované kura, parmezán, krutóny, caesar dresing.",
      image:
        "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=800&q=80",
      basePrice: P(7.9),
      sizes: ONE_SIZE,
      ingredients: ["Rímsky šalát", "Kuracie mäso", "Parmezán", "Krutóny"],
      allergens: ["1", "3", "7"],
      badges: ["bestseller"],
      available: true,
    },
    {
      id: `${restaurantId}-caprese`,
      restaurantId,
      category: "salads",
      name: "Caprese",
      description: "Buvolia mozzarella, paradajky, bazalka, balzamikový krém.",
      image:
        "https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=800&q=80",
      basePrice: P(7.2),
      sizes: ONE_SIZE,
      ingredients: ["Mozzarella", "Paradajky", "Bazalka", "Balzamiko"],
      allergens: ["7"],
      badges: ["vegetarian"],
      available: true,
    },
    // ---------------- SIDES ----------------
    {
      id: `${restaurantId}-fries`,
      restaurantId,
      category: "sides",
      name: "Hranolčeky s dipom",
      description: "Chrumkavé hranolčeky s domácim cesnakovým dipom.",
      image:
        "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=80",
      basePrice: P(3.5),
      sizes: ONE_SIZE,
      ingredients: ["Zemiaky", "Cesnakový dip"],
      allergens: ["7"],
      badges: ["vegetarian"],
      available: true,
    },
    {
      id: `${restaurantId}-garlic-bread`,
      restaurantId,
      category: "sides",
      name: "Cesnakový chlieb",
      description: "Pečený chlieb s cesnakovým maslom a bylinkami.",
      image:
        "https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=800&q=80",
      basePrice: P(3.9),
      sizes: ONE_SIZE,
      ingredients: ["Chlieb", "Cesnakové maslo", "Bylinky"],
      allergens: ["1", "7"],
      badges: ["vegetarian", "recommended"],
      available: true,
    },
    // ---------------- DESSERTS ----------------
    {
      id: `${restaurantId}-tiramisu`,
      restaurantId,
      category: "desserts",
      name: "Tiramisu",
      description: "Klasické talianske tiramisu s mascarpone a espressom.",
      image:
        "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&q=80",
      basePrice: P(4.5),
      sizes: ONE_SIZE,
      ingredients: ["Mascarpone", "Espresso", "Piškóty", "Kakao"],
      allergens: ["1", "3", "7"],
      badges: ["bestseller"],
      available: true,
    },
    {
      id: `${restaurantId}-brownie`,
      restaurantId,
      category: "desserts",
      name: "Čokoládové brownie",
      description: "Teplé brownie s vanilkovou zmrzlinou.",
      image:
        "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&q=80",
      basePrice: P(4.9),
      sizes: ONE_SIZE,
      ingredients: ["Čokoláda", "Vanilková zmrzlina"],
      allergens: ["1", "3", "7", "8"],
      badges: ["new"],
      available: true,
    },
    // ---------------- DRINKS ----------------
    {
      id: `${restaurantId}-cola`,
      restaurantId,
      category: "drinks",
      name: "Coca-Cola 0,33l",
      description: "Vychladená Coca-Cola.",
      image:
        "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&q=80",
      basePrice: P(1.8),
      sizes: ONE_SIZE,
      ingredients: ["Coca-Cola"],
      allergens: [],
      badges: [],
      available: true,
    },
    {
      id: `${restaurantId}-water`,
      restaurantId,
      category: "drinks",
      name: "Minerálka 0,5l",
      description: "Perlivá / neperlivá minerálna voda.",
      image:
        "https://images.unsplash.com/photo-1560023907-5f339617ea30?w=800&q=80",
      basePrice: P(1.5),
      sizes: ONE_SIZE,
      ingredients: ["Minerálna voda"],
      allergens: [],
      badges: ["vegetarian"],
      available: true,
    },
  ];
}

export const PRODUCTS: Product[] = [
  ...buildMenu("pyro", 0),
  ...buildMenu("polomarik", 0.4),
];

export const COUPONS: Coupon[] = [
  {
    code: "PYRO10",
    restaurantId: "pyro",
    type: "percentage",
    value: 10,
    minSubtotal: 15,
    label: "-10% na celú objednávku",
  },
  {
    code: "FREEDELIVERY",
    restaurantId: "all",
    type: "free_delivery",
    value: 0,
    minSubtotal: 20,
    label: "Doprava zdarma nad 20€",
  },
  {
    code: "HAPPY5",
    restaurantId: "all",
    type: "fixed",
    value: 5,
    minSubtotal: 25,
    label: "-5€ Happy Hour",
  },
];

export const EXTRA_INGREDIENTS = [
  { name: "Extra mozzarella", price: 1.2 },
  { name: "Slanina", price: 1.5 },
  { name: "Šunka", price: 1.4 },
  { name: "Kukurica", price: 0.9 },
  { name: "Jalapeño", price: 0.9 },
  { name: "Cibuľa", price: 0.7 },
  { name: "Olivy", price: 1.0 },
  { name: "Rukola", price: 1.1 },
];

export const EXTRA_CHEESE_PRICE = 1.5;
export const STUFFED_CRUST_PRICE = 2.5;

export const REVIEWS = [
  {
    name: "Martina K.",
    rating: 5,
    text: "Najlepšia pizza v okolí! Cesto ako z pravej pece. Doručenie rýchle a horúce.",
    verified: true,
    restaurantId: "pyro",
    date: "2026-06-28",
  },
  {
    name: "Peter H.",
    rating: 5,
    text: "Objednávam pravidelne, kvalita stabilne výborná. Pyro Special je bomba.",
    verified: true,
    restaurantId: "pyro",
    date: "2026-06-15",
  },
  {
    name: "Lucia B.",
    rating: 4,
    text: "Skvelé cestoviny a milá obsluha. Doručenie do Stráňav za 40 minút.",
    verified: true,
    restaurantId: "polomarik",
    date: "2026-06-30",
  },
  {
    name: "Jozef M.",
    rating: 5,
    text: "Polomárik Special a domáca pohoda. Odporúčam každému!",
    verified: true,
    restaurantId: "polomarik",
    date: "2026-06-20",
  },
];

export const DAY_NAMES = [
  "Pondelok",
  "Utorok",
  "Streda",
  "Štvrtok",
  "Piatok",
  "Sobota",
  "Nedeľa",
];
