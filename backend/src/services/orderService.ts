import { config } from '../config.js';
import { badRequest, conflict, notFound } from '../errors/apiError.js';
import { claimedQuantity, claimsForOrder } from '../repositories/claimRepository.js';
import { insertOrderWithItems, itemsForOrder, listOrdersByUser, findOrderByNo, orderNoExists } from '../repositories/orderRepository.js';
import { adjustLocalStock } from '../repositories/productRepository.js';
import { LOCAL_BUSINESS } from '../store/seed.js';
import { ORDER_NO_PATTERN, type Order, type ShippingFields } from '../types/order.js';
import type { User } from '../types/user.js';
import { isEmail, lineTotal, newOrderNo, optionalString, positiveInt, requiredString, sumBaht, toBaht, toSatang } from '../utils/index.js';
import { findProduct } from './productService.js';

const FREE_SHIPPING_FROM = 1500;
const SHIPPING_FEE = 60;

export function parseShipping(body: Record<string, unknown>): ShippingFields {
  const email = requiredString(body.customer_email, 'customer_email', 254).toLowerCase();
  if (!isEmail(email)) throw badRequest('VALIDATION_ERROR', 'Enter a valid email address', { field: 'customer_email' });
  return {
    customer_name: requiredString(body.customer_name, 'customer_name', 160),
    customer_email: email,
    customer_phone: requiredString(body.customer_phone, 'customer_phone', 40),
    shipping_address_line1: requiredString(body.shipping_address_line1, 'shipping_address_line1'),
    shipping_address_line2: optionalString(body.shipping_address_line2, 'shipping_address_line2'),
    shipping_district: requiredString(body.shipping_district, 'shipping_district', 120),
    shipping_province: requiredString(body.shipping_province, 'shipping_province', 120),
    shipping_postal_code: requiredString(body.shipping_postal_code, 'shipping_postal_code', 20),
    shipping_country: requiredString(body.shipping_country, 'shipping_country', 120),
  };
}

type CartLine = { business: string; product_id: string; quantity: number };

function parseItems(raw: unknown): CartLine[] {
  if (!Array.isArray(raw) || raw.length === 0) throw badRequest('VALIDATION_ERROR', 'Your cart is empty', { field: 'items' });
  if (raw.length > 50) throw badRequest('VALIDATION_ERROR', 'Too many cart lines', { field: 'items' });
  const seen = new Set<string>();
  return raw.map((line, index) => {
    const l = (line ?? {}) as Record<string, unknown>;
    const business = requiredString(l.business, `items[${index}].business`, 50);
    const product_id = requiredString(l.product_id, `items[${index}].product_id`);
    const key = `${business}:${product_id}`;
    if (seen.has(key)) throw badRequest('VALIDATION_ERROR', 'The same product appears twice in the cart', { field: 'items' });
    seen.add(key);
    return { business, product_id, quantity: positiveInt(l.quantity, `items[${index}].quantity`) };
  });
}

export async function placeOrder(user: User, body: Record<string, unknown>): Promise<Order> {
  const shipping = parseShipping(body);
  const lines = parseItems(body.items);

  // Re-read live inventory for every line: the price comes from here, never from the client.
  const problems: Array<{ business: string; product_id: string; code: string; message: string }> = [];
  const priced = await Promise.all(
    lines.map(async line => {
      const { product, available } = await findProduct(line.business, line.product_id, true);
      if (!available) problems.push({ ...line, code: 'BUSINESS_UNAVAILABLE', message: 'This store is not reachable right now' });
      else if (!product) problems.push({ ...line, code: 'PRODUCT_NOT_FOUND', message: 'This product is no longer sold' });
      else if (line.quantity > product.stock) {
        problems.push({ ...line, code: 'INSUFFICIENT_STOCK', message: `Only ${product.stock} left in stock` });
      }
      return { line, product };
    }),
  );
  if (problems.length) {
    const code = problems.every(p => p.code === 'INSUFFICIENT_STOCK') ? 'INSUFFICIENT_STOCK' : problems[0]!.code;
    throw conflict(code, 'Some items in your cart cannot be ordered', { lines: problems });
  }

  // Reserve the store's own stock first; roll back if any line lost the race.
  const reserved: Array<{ id: number; qty: number }> = [];
  for (const { line } of priced) {
    if (line.business !== LOCAL_BUSINESS.key) continue;
    if (!adjustLocalStock(Number(line.product_id), -line.quantity)) {
      reserved.forEach(r => adjustLocalStock(r.id, r.qty));
      throw conflict('INSUFFICIENT_STOCK', 'Stock changed while you were checking out, please review your cart');
    }
    reserved.push({ id: Number(line.product_id), qty: line.quantity });
  }

  const items = priced.map(({ line, product }) => ({
    product_id: product!.id,
    business: product!.business,
    business_name: product!.business_name,
    product_name: product!.name,
    category: product!.category,
    image_url: product!.image_url || null,
    unit_price: product!.price,
    quantity: line.quantity,
    line_total: lineTotal(product!.price, line.quantity),
  }));
  const subtotal = sumBaht(items.map(i => i.line_total));
  const shippingFee = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;

  let orderNo = newOrderNo();
  while (orderNoExists(orderNo)) orderNo = newOrderNo(); // retry on collision

  return insertOrderWithItems(
    {
      ...shipping,
      user_id: user.id,
      order_no: orderNo,
      subtotal,
      shipping_fee: shippingFee,
      discount: 0,
      total: toBaht(toSatang(subtotal) + toSatang(shippingFee)),
      status: 'confirmed',
      completed_at: null,
    },
    items,
  );
}

export const orderWithItems = (order: Order) => ({ ...order, items: itemsForOrder(order.id) });

export const listMyOrders = (user: User) => listOrdersByUser(user.id).map(orderWithItems);

// Another customer's order answers 404, never 403, so its existence is not confirmed.
export function getMyOrder(user: User, orderNo: string): Order {
  if (!ORDER_NO_PATTERN.test(orderNo)) throw badRequest('INVALID_ORDER_NUMBER', 'The order number is malformed');
  const order = findOrderByNo(orderNo);
  if (!order || order.user_id !== user.id) throw notFound('ORDER_NOT_FOUND', 'Order not found');
  return order;
}

// ---------- claims eligibility ----------
export function claimDeadline(order: Order): Date | null {
  if (config.claimWindowDays === 0) return null;
  const from = order.completed_at ?? order.created_at;
  return new Date(Date.parse(from) + config.claimWindowDays * 86_400_000);
}

export function claimEligibility(order: Order): { ok: boolean; reason?: string } {
  if (order.status !== 'shipped' && order.status !== 'completed') return { ok: false, reason: 'Claims open once the order has shipped' };
  const deadline = claimDeadline(order);
  if (deadline && Date.now() > deadline.getTime()) return { ok: false, reason: 'The claim window for this order has closed' };
  return { ok: true };
}

export function claimableItems(order: Order) {
  return itemsForOrder(order.id).map(item => {
    const claimed = claimedQuantity(item.id);
    return { ...item, claimed_quantity: claimed, claimable_quantity: Math.max(0, item.quantity - claimed) };
  });
}

// Built from the stored order snapshot, so a reprint never shows today's prices.
export function warrantyDocument(order: Order) {
  const deadline = claimDeadline(order);
  return {
    document_type: 'claim_and_warranty',
    store: { name: LOCAL_BUSINESS.name, support_email: 'support@delux.test' },
    order: orderWithItems(order),
    claim_window_days: config.claimWindowDays,
    claim_deadline: deadline ? deadline.toISOString() : null,
    eligibility: claimEligibility(order),
    claims: claimsForOrder(order.id).map(c => ({ claim_number: c.claim_number, status: c.status, created_at: c.created_at })),
    generated_at: new Date().toISOString(),
  };
}
