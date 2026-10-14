import bcrypt from 'bcryptjs';

import { config } from '../config.js';
import type { LocalProduct } from '../types/product.js';
import { lineTotal, sumBaht } from '../utils/index.js';
import { db, nextId } from './db.js';

// DEV-ONLY demo accounts, recreated on every start (data is in memory).
// Change or remove these before using the app anywhere real.
export const SEED_ACCOUNTS = {
  admin: { name: 'Delux Admin', email: 'admin@delux.test', password: 'Admin@1234' },
  customer: { name: 'Demo Customer', email: 'customer@delux.test', password: 'Customer@1234' },
};

export const LOCAL_BUSINESS = { key: 'delux', name: 'Delux Sport Club' };

const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=75`;

const PRODUCTS: Array<Omit<LocalProduct, 'id' | 'created_at' | 'updated_at' | 'unit'>> = [
  { name: 'Court Classic Sneaker', category: 'Footwear', price: 2490, stock: 18, image_url: img('1608231387042-66d1773070a5'), description: 'Clean leather court shoe with a cushioned insole and non-marking rubber outsole for indoor courts.' },
  { name: 'Air Runner Pro', category: 'Running', price: 3290, stock: 4, image_url: img('1542291026-7eec264c27ff'), description: 'Lightweight knit running shoe.' },
  { name: 'Cloud Trainer', category: 'Footwear', price: 2890, stock: 12, image_url: img('1600185365483-26d7a4cc7519'), description: 'Everyday trainer with responsive foam that goes from the gym floor to a 5K without missing a step.' },
  { name: 'Pro Tennis Balls (3-pack)', category: 'Tennis', price: 390, stock: 60, image_url: img('1587280501635-68a0e82cd5ff'), description: 'Tour-grade pressurised felt balls, consistent bounce on hard and clay courts.' },
  { name: 'Graphite Tennis Racket', category: 'Tennis', price: 4590, stock: 6, image_url: img('1622279457486-62dcc4a431d6'), description: '' },
  { name: 'Indoor Basketball', category: 'Basketball', price: 1290, stock: 25, image_url: img('1515523110800-9415d13b84a8'), description: 'Size 7 composite leather ball with deep channels for grip on wooden courts.' },
  { name: 'Pro Hoop Net', category: 'Basketball', price: 590, stock: 0, image_url: img('1546519638-68e109498ffc'), description: 'Heavy-duty all-weather net.' },
  { name: 'Match Football Size 5', category: 'Football', price: 990, stock: 30, image_url: img('1579952363873-27f3bade9f55'), description: 'Thermo-bonded match ball with a true flight path, approved for club league play.' },
  { name: 'Football Training Cones (20)', category: 'Football', price: 450, stock: 40, image_url: img('1560272564-c83b66b1ad12'), description: 'Flexible marker cones for drills, agility work and small-sided games.' },
  { name: 'Hex Dumbbell Set 2–10 kg', category: 'Fitness', price: 3890, stock: 7, image_url: img('1576678927484-cc907957088c'), description: 'Five pairs of rubber-coated hex dumbbells that stay put on the floor between sets.' },
  { name: 'Olympic Barbell 20 kg', category: 'Fitness', price: 5490, stock: 3, image_url: img('1517836357463-d25dfeac3438'), description: 'Knurled steel bar rated to 300 kg.' },
  { name: 'Battle Rope 12 m', category: 'Fitness', price: 1890, stock: 9, image_url: img('1599058917212-d750089bc07e'), description: 'Poly-dacron conditioning rope with heat-shrunk handles for full-body HIIT.' },
  { name: 'Weightlifting Belt', category: 'Fitness', price: 1190, stock: 14, image_url: img('1556817411-31ae72fa3ea0'), description: '10 mm leather belt with a single-prong buckle for heavy squats and deadlifts.' },
  { name: 'Yoga Mat Pro 6 mm', category: 'Yoga', price: 890, stock: 22, image_url: img('1518611012118-696072aa579a'), description: 'Non-slip natural rubber mat with alignment lines.' },
  { name: 'Competition Swim Goggles', category: 'Swimming', price: 690, stock: 35, image_url: img('1530549387789-4c1017266635'), description: 'Low-profile anti-fog racing goggles with interchangeable nose bridges.' },
  { name: 'Road Cycling Helmet', category: 'Cycling', price: 2590, stock: 5, image_url: img('1517649763962-0c623066013b'), description: 'Aero road helmet with 18 vents and a dial-fit retention system.' },
  { name: 'Run Club Singlet', category: 'Running', price: 590, stock: 50, image_url: img('1552674605-db6ffd4facb5'), description: 'Breathable mesh singlet.' },
  { name: 'Tour Golf Balls (12-pack)', category: 'Golf', price: 1590, stock: 28, image_url: img('1587174486073-ae5e5cff23aa'), description: 'Three-piece urethane tour balls with soft feel around the green and low spin off the driver.' },
  { name: 'Forged Iron Set 5–PW', category: 'Golf', price: 28900, stock: 4, image_url: img('1530028828-25e8270793c5'), description: 'Six forged carbon-steel irons with a satin finish, built for consistent contact and feel.' },
  { name: 'Club Performance Polo', category: 'Golf', price: 1290, stock: 16, image_url: img('1611374243147-44a702c2d44c'), description: 'Moisture-wicking stretch polo.' },
];

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export function seed() {
  const now = new Date().toISOString();

  db.businesses.push({ id: nextId('businesses'), key: LOCAL_BUSINESS.key, name: LOCAL_BUSINESS.name, kind: 'local', api_url: null, status: 'active', last_checked_at: now });
  for (const partner of config.partners) {
    if (partner.key === LOCAL_BUSINESS.key) continue;
    db.businesses.push({ id: nextId('businesses'), key: partner.key, name: partner.name, kind: 'partner', api_url: partner.url, status: 'active', last_checked_at: null });
  }

  for (const p of PRODUCTS) {
    db.products.push({ ...p, id: nextId('products'), unit: 'pcs', created_at: now, updated_at: now });
  }
  for (const name of [...new Set(PRODUCTS.map(p => p.category))].sort()) {
    db.categories.push({ id: nextId('categories'), name, created_at: now });
  }

  const admin = SEED_ACCOUNTS.admin;
  const customer = SEED_ACCOUNTS.customer;
  db.users.push({
    id: nextId('users'), name: admin.name, email: admin.email, password_hash: bcrypt.hashSync(admin.password, 10), role: 'admin',
    phone: null, address: null, city: null, province: null, postal_code: null, country: null, profile_image_url: null, created_at: daysAgo(60), updated_at: daysAgo(60),
  });
  const customerId = nextId('users');
  db.users.push({
    id: customerId, name: customer.name, email: customer.email, password_hash: bcrypt.hashSync(customer.password, 10), role: 'customer',
    phone: '081-234-5678', address: '99 Sukhumvit Rd', city: 'Watthana', province: 'Bangkok', postal_code: '10110', country: 'Thailand', profile_image_url: null, created_at: daysAgo(45), updated_at: daysAgo(45),
  });

  // Demo orders so the history, warranty and claim flows can be tried straight away.
  seedOrder(customerId, [[1, 1], [4, 2]], 'completed', 12);
  seedOrder(customerId, [[10, 1]], 'shipped', 4);
  seedOrder(customerId, [[8, 2], [9, 1]], 'confirmed', 1);
  seedOrder(customerId, [[6, 1], [14, 1]], 'completed', 20);
}

function seedOrder(userId: number, lines: Array<[productId: number, qty: number]>, status: 'completed' | 'shipped' | 'confirmed', ageDays: number) {
  const user = db.users.find(u => u.id === userId)!;
  const orderId = nextId('orders');
  const created = daysAgo(ageDays);
  const items = lines.map(([productId, quantity]) => {
    const p = db.products.find(prod => prod.id === productId)!;
    return {
      id: nextId('orderItems'), order_id: orderId, product_id: String(p.id), business: LOCAL_BUSINESS.key, business_name: LOCAL_BUSINESS.name,
      product_name: p.name, category: p.category, image_url: p.image_url, unit_price: p.price, quantity, line_total: lineTotal(p.price, quantity), created_at: created,
    };
  });
  const subtotal = sumBaht(items.map(i => i.line_total));
  const datePart = created.slice(0, 10).replace(/-/g, '');
  db.orders.push({
    id: orderId, user_id: userId, order_no: `DLX-${datePart}-${(0xa10000 + orderId).toString(16).toUpperCase()}`,
    customer_name: user.name, customer_email: user.email, customer_phone: user.phone ?? '', shipping_address_line1: user.address ?? '',
    shipping_address_line2: null, shipping_district: user.city ?? '', shipping_province: user.province ?? '', shipping_postal_code: user.postal_code ?? '',
    shipping_country: user.country ?? '', subtotal, shipping_fee: 0, discount: 0, total: subtotal, status,
    completed_at: status === 'completed' ? daysAgo(Math.max(0, ageDays - 3)) : null, created_at: created, updated_at: created,
  });
  db.orderItems.push(...items);
}
