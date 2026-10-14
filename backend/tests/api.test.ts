// Integration tests against a real app instance on an ephemeral port (in-memory data).
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

process.env.JWT_SECRET ??= 'api-test-secret-at-least-16-chars';
process.env.GEMINI_API_KEY = '';
process.env.PARTNER_APIS = 'down|Offline Partner|http://127.0.0.1:9/api/products';

const { createApp } = await import('../src/app.js');
const { seed, SEED_ACCOUNTS } = await import('../src/store/seed.js');

let base = '';
let close: () => void;

before(async () => {
  seed();
  const server = createApp().listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  close = () => server.close();
});
after(() => close());

function client() {
  let cookie = '';
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0]!;
    return { status: res.status, body: (await res.json()) as any };
  };
}

const SHIP = {
  customer_name: 'Test', customer_email: 't@example.com', customer_phone: '0800000000', shipping_address_line1: '1 Rd',
  shipping_district: 'D', shipping_province: 'P', shipping_postal_code: '10000', shipping_country: 'Thailand',
};

test('one failing partner never removes the store’s own products', async () => {
  const { body } = await client()('GET', '/products');
  assert.ok(body.data.length > 0);
  const down = body.businesses.find((b: any) => b.business === 'down');
  assert.equal(down.status, 'unavailable');
  assert.equal(body.businesses.find((b: any) => b.business === 'delux').status, 'online');
});

test('checkout uses the live price and rejects too-large quantities', async () => {
  const c = client();
  await c('POST', '/auth/login', { email: SEED_ACCOUNTS.customer.email, password: SEED_ACCOUNTS.customer.password });
  const product = (await c('GET', '/products/delux/8')).body.data;

  const over = await c('POST', '/orders', { ...SHIP, items: [{ business: 'delux', product_id: '8', quantity: product.stock + 1 }] });
  assert.equal(over.status, 409);
  assert.equal(over.body.error.code, 'INSUFFICIENT_STOCK');

  const ok = await c('POST', '/orders', { ...SHIP, items: [{ business: 'delux', product_id: '8', quantity: 2, price: 1, unit_price: 1 }] });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.data.subtotal, product.price * 2);
  assert.equal((await c('GET', '/products/delux/8')).body.data.stock, product.stock - 2);
});

test('orders and claims need a session; another user’s order is a 404', async () => {
  const anon = client();
  assert.equal((await anon('GET', '/orders')).status, 401);

  const owner = client();
  await owner('POST', '/auth/login', { email: SEED_ACCOUNTS.customer.email, password: SEED_ACCOUNTS.customer.password });
  const orderNo = (await owner('GET', '/orders')).body.data[0].order_no;

  const other = client();
  await other('POST', '/auth/register', { name: 'Other', email: 'other@example.com', password: 'longenough1' });
  const res = await other('GET', `/orders/${orderNo}`);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'ORDER_NOT_FOUND');
  assert.equal((await other('GET', '/admin/dashboard')).status, 403);
});

test('AI routes answer 503 when no key is configured', async () => {
  const res = await client()('POST', '/ai/search', { query: 'shoes' });
  assert.equal(res.status, 503);
  assert.equal(res.body.error.code, 'AI_NOT_CONFIGURED');
});

test('admin can add, rename and delete categories; a category in use is protected', async () => {
  const a = client();
  await a('POST', '/auth/login', { email: SEED_ACCOUNTS.admin.email, password: SEED_ACCOUNTS.admin.password });

  const created = await a('POST', '/admin/categories', { name: 'Badminton' });
  assert.equal(created.status, 201);
  assert.equal((await a('POST', '/admin/categories', { name: 'badminton' })).body.error.code, 'CATEGORY_EXISTS');

  const golf = (await a('GET', '/admin/categories')).body.data.find((c: any) => c.name === 'Golf');
  assert.ok(golf.product_count > 0);
  assert.equal((await a('DELETE', `/admin/categories/${golf.id}`)).body.error.code, 'CATEGORY_IN_USE');

  await a('PUT', `/admin/categories/${golf.id}`, { name: 'Golf & Putting' });
  const products = (await client()('GET', '/products')).body.data;
  assert.ok(products.some((p: any) => p.category === 'Golf & Putting'));
  assert.ok(!products.some((p: any) => p.category === 'Golf'));

  assert.equal((await a('DELETE', `/admin/categories/${created.body.data.id}`)).status, 200);
});

test('admin can add and delete a partner store, but not the own catalogue', async () => {
  const a = client();
  await a('POST', '/auth/login', { email: SEED_ACCOUNTS.admin.email, password: SEED_ACCOUNTS.admin.password });
  const added = await a('POST', '/admin/businesses', { key: 'racket-hub', name: 'Racket Hub', api_url: 'http://127.0.0.1:9/api/products' });
  assert.equal(added.status, 201);
  assert.equal((await a('DELETE', `/admin/businesses/${added.body.data.id}`)).status, 200);
  const own = (await a('GET', '/admin/businesses')).body.data.find((b: any) => b.key === 'delux');
  assert.equal((await a('DELETE', `/admin/businesses/${own.id}`)).body.error.code, 'BUSINESS_PROTECTED');
});

test('admin can edit shipping and delete an unshipped order, which restocks it', async () => {
  const c = client();
  await c('POST', '/auth/login', { email: SEED_ACCOUNTS.customer.email, password: SEED_ACCOUNTS.customer.password });
  const before = (await c('GET', '/products/delux/9')).body.data.stock;
  const order = (await c('POST', '/orders', { ...SHIP, items: [{ business: 'delux', product_id: '9', quantity: 3 }] })).body.data;

  const a = client();
  await a('POST', '/auth/login', { email: SEED_ACCOUNTS.admin.email, password: SEED_ACCOUNTS.admin.password });
  const edited = await a('PUT', `/admin/orders/${order.order_no}`, { ...SHIP, shipping_province: 'Chiang Mai' });
  assert.equal(edited.body.data.shipping_province, 'Chiang Mai');

  assert.equal((await a('DELETE', `/admin/orders/${order.order_no}`)).status, 200);
  assert.equal((await a('GET', `/admin/orders/${order.order_no}`)).status, 404);
  assert.equal((await c('GET', '/products/delux/9')).body.data.stock, before);
});
