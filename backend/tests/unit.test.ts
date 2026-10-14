import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.JWT_SECRET ??= 'unit-test-secret-at-least-16-chars';

const { getStockStatus, lineTotal, sumBaht, sniffImageType } = await import('../src/utils/index.js');
const { normalizePartnerItem, parsePartnerPayload } = await import('../src/adapters/partner.js');
const { canTransition, CLAIM_STATUSES } = await import('../src/types/claim.js');

test('getStockStatus follows the shared thresholds', () => {
  assert.equal(getStockStatus(0), 'Out of Stock');
  assert.equal(getStockStatus(1), 'Low Stock');
  assert.equal(getStockStatus(5), 'Low Stock');
  assert.equal(getStockStatus(6), 'In Stock');
});

test('money math has no float drift', () => {
  assert.equal(lineTotal(0.1, 3), 0.3);
  assert.equal(sumBaht([0.1, 0.2]), 0.3);
  assert.equal(lineTotal(2490, 2), 4980);
});

test('partner payload accepts an array or { data: [] }', () => {
  assert.deepEqual(parsePartnerPayload([{ id: 1 }]), [{ id: 1 }]);
  assert.deepEqual(parsePartnerPayload({ data: [{ id: 2 }] }), [{ id: 2 }]);
  assert.throws(() => parsePartnerPayload({ items: [] }));
});

test('partner items are normalized: numeric ids to strings, string prices to numbers', () => {
  const p = normalizePartnerItem(
    { product_id: 12, product_name: 'Walnut Door', category_name: 'Door', price: '24,500.00', total_stock: 5, image_url: '/img/d.jpg' },
    'door', 'Door', 'http://partner.test/api/products',
  );
  assert.ok(p);
  assert.equal(p.id, '12');
  assert.equal(p.price, 24500);
  assert.equal(p.stock, 5);
  assert.equal(p.status, 'Low Stock');
  assert.equal(p.image_url, 'http://partner.test/img/d.jpg'); // relative path resolved against upstream
});

test('partner items without id, name or numeric price/stock are skipped, never invented', () => {
  const url = 'http://partner.test/';
  assert.equal(normalizePartnerItem({ name: 'No id', price: 1, stock: 1 }, 'x', 'X', url), null);
  assert.equal(normalizePartnerItem({ id: 1, price: 1, stock: 1 }, 'x', 'X', url), null);
  assert.equal(normalizePartnerItem({ id: 1, name: 'Bad price', price: 'abc', stock: 1 }, 'x', 'X', url), null);
  assert.equal(normalizePartnerItem({ id: 1, name: 'No stock', price: 10 }, 'x', 'X', url), null);
});

test('claim state machine allows only the documented transitions', () => {
  const allowed = new Set(['submitted>under_review', 'submitted>cancelled', 'under_review>approved', 'under_review>rejected', 'under_review>cancelled', 'approved>processing', 'processing>completed']);
  for (const from of CLAIM_STATUSES) {
    for (const to of CLAIM_STATUSES) {
      assert.equal(canTransition(from, to), allowed.has(`${from}>${to}`), `${from} -> ${to}`);
    }
  }
});

test('image sniffing checks magic bytes, not the declared type', () => {
  assert.equal(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(sniffImageType(Buffer.from('RIFF0000WEBP')), 'image/webp');
  assert.equal(sniffImageType(Buffer.from('<?php echo 1;')), null);
});
