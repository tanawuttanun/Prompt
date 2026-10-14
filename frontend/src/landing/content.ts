// All copy and imagery for the landing page lives here so it can be edited
// without touching the layout engine. Photos are from Unsplash (free licence).

const unsplash = (id: string, w = 600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;

export type CardVariant = 'pay' | 'launch' | 'shop' | 'brand' | 'frete' | 'power' | 'off' | 'plain';
export type Shot = { url: string; v: CardVariant; t?: string };

// The ten carousel creatives, cycled across the 37 cards of the ring.
export const SHOTS: Shot[] = [
  { v: 'pay', url: unsplash('1600185365483-26d7a4cc7519') },
  { v: 'launch', url: unsplash('1571019613454-1cb2f99b2d8b') },
  { v: 'shop', url: unsplash('1556817411-31ae72fa3ea0') },
  { v: 'brand', url: unsplash('1530549387789-4c1017266635') },
  { v: 'frete', url: unsplash('1579952363873-27f3bade9f55') },
  { v: 'plain', t: 'GOLF CLUB', url: unsplash('1535131749006-b7f58c99034b') },
  { v: 'power', url: unsplash('1541534741688-6078c6bfb5c5') },
  { v: 'plain', t: 'JUST ARRIVED', url: unsplash('1542291026-7eec264c27ff') },
  { v: 'off', url: unsplash('1546519638-68e109498ffc') },
  { v: 'plain', t: 'TENNIS', url: unsplash('1622279457486-62dcc4a431d6') },
];

export const BRAND = { kicker: 'SPORT CLUB', name: 'DELUX' };

export const NAV_LINKS = [
  { label: 'Shop', to: '/products' },
  { label: 'Tennis', to: '/products?category=Tennis' },
  { label: 'Golf', to: '/products?category=Golf' },
  { label: 'Orders', to: '/orders' },
  { label: 'Claims', to: '/claims' },
];

export const HERO = {
  badge: 'The members’ club for serious players',
  line1: 'Gear up for every',
  line2: 'Victory',
  navCta: 'Join the club',
  cta: 'Shop now',
  // sub line 1 = bold lead + plain tail; sub line 2 = plain
  subLead: 'Pro-grade equipment /',
  subLeadNoBreak: 'Tennis & Golf',
  subTail: 'curated for athletes with',
  sub2: 'fast delivery, expert advice, member-only perks.',
};

export const STORE = {
  address: 'deluxsportclub.com - Pro Shop',
  announcement: 'Free shipping on orders over ฿1,500',
  logo: 'DELUX',
  logoSub: 'SPORT CLUB',
  banner: {
    url: unsplash('1599058917212-d750089bc07e', 1400),
    alt: 'Athlete training with battle ropes in a bright gym',
    kicker: 'New season',
    headline: ['Train hard.', 'Play harder.'],
    cta: 'SHOP NOW',
  },
  sectionTitle: 'Best sellers',
  products: [
    {
      url: unsplash('1608231387042-66d1773070a5', 500),
      alt: 'White leather court sneaker',
      tag: '-24%',
      name: 'Court Classic Sneaker',
      meta: 'Indoor · Size 39–45',
      price: '฿ 2,490',
      was: '฿ 3,290',
    },
    {
      url: unsplash('1587280501635-68a0e82cd5ff', 500),
      alt: 'Tennis ball on a dark court',
      tag: '',
      name: 'Pro Tennis Balls',
      meta: 'Tour grade · 3 balls',
      price: '฿ 390',
      was: '',
    },
    {
      url: unsplash('1576678927484-cc907957088c', 500),
      alt: 'Row of black hex dumbbells on a rack',
      tag: 'SET',
      name: 'Hex Dumbbell Set',
      meta: '2–10 kg · 5 pairs',
      price: '฿ 3,890',
      was: '฿ 4,590',
    },
    {
      url: unsplash('1515523110800-9415d13b84a8', 500),
      alt: 'Basketball dropping through the hoop net',
      tag: 'NEW',
      name: 'Indoor Basketball',
      meta: 'Size 7 · Composite',
      price: '฿ 1,290',
      was: '',
    },
  ],
  perks: ['Free shipping over ฿1,500', 'Pay 0% for 10 months', 'Returns within 30 days', 'Pro-tested gear'],
};
