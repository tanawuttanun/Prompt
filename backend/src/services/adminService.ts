import bcrypt from 'bcryptjs';

import { ApiError, badRequest, conflict, notFound } from '../errors/apiError.js';
import { allOrderItems, findOrderByNo, itemsForOrder, listOrders, setOrderStatus, userHasOrders } from '../repositories/orderRepository.js';
import {
  adjustLocalStock, createLocalProduct, deleteLocalProduct, ensureCategory, findBusinessById, findLocalProduct, listBusinesses, listCategories, listLocalProducts,
  recentSyncLogs, updateBusiness, updateLocalProduct,
} from '../repositories/productRepository.js';
import { countAdmins, createUser, deleteUser, findUserByEmail, findUserById, listUsers, updateUser } from '../repositories/userRepository.js';
import { LOCAL_BUSINESS } from '../store/seed.js';
import { ORDER_NO_PATTERN, ORDER_STATUSES, ORDER_TRANSITIONS, type OrderStatus } from '../types/order.js';
import type { Role, User } from '../types/user.js';
import { toPublicUser } from '../types/user.js';
import { getStockStatus, isEmail, nonNegativeNumber, paginate, pageParams, queryString, requiredString, sumBaht } from '../utils/index.js';
import { PASSWORD_MIN } from './authService.js';
import { adminClaimStats } from './claimService.js';
import { orderWithItems } from './orderService.js';
import { invalidatePartnerCache } from './productService.js';

const revenueOrders = () => listOrders().filter(o => o.status !== 'cancelled');

// ---------- dashboard & analytics ----------
export function dashboard() {
  const orders = listOrders();
  const products = listLocalProducts();
  return {
    orders: orders.length,
    revenue: sumBaht(revenueOrders().map(o => o.total)),
    customers: listUsers().filter(u => u.role === 'customer').length,
    orders_by_status: Object.fromEntries(ORDER_STATUSES.map(s => [s, orders.filter(o => o.status === s).length])),
    claims: adminClaimStats(),
    low_stock: products
      .filter(p => p.stock <= 5)
      .map(p => ({ id: p.id, name: p.name, stock: p.stock, status: getStockStatus(p.stock) })),
    recent_orders: orders.slice(0, 5).map(o => ({ order_no: o.order_no, customer_name: o.customer_name, total: o.total, status: o.status, created_at: o.created_at })),
  };
}

export function analytics(query: Record<string, unknown>) {
  const days = Math.min(365, Math.max(7, Number(query.days) || 30));
  const since = Date.now() - days * 86_400_000;
  const orders = revenueOrders().filter(o => Date.parse(o.created_at) >= since);
  const orderIds = new Set(orders.map(o => o.id));
  const items = allOrderItems().filter(i => orderIds.has(i.order_id));

  const salesByDay = new Map<string, { date: string; revenue: number; orders: number }>();
  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
    salesByDay.set(date, { date, revenue: 0, orders: 0 });
  }
  for (const order of orders) {
    const entry = salesByDay.get(order.created_at.slice(0, 10));
    if (entry) {
      entry.revenue = sumBaht([entry.revenue, order.total]);
      entry.orders += 1;
    }
  }

  const group = (keyOf: (i: (typeof items)[number]) => string) => {
    const map = new Map<string, { key: string; revenue: number; units: number }>();
    for (const item of items) {
      const key = keyOf(item);
      const entry = map.get(key) ?? { key, revenue: 0, units: 0 };
      entry.revenue = sumBaht([entry.revenue, item.line_total]);
      entry.units += item.quantity;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  };

  return {
    days,
    total_revenue: sumBaht(orders.map(o => o.total)),
    total_orders: orders.length,
    average_order: orders.length ? Math.round((sumBaht(orders.map(o => o.total)) / orders.length) * 100) / 100 : 0,
    sales_by_day: [...salesByDay.values()],
    by_business: group(i => i.business_name),
    by_category: group(i => i.category ?? 'Other'),
    top_products: group(i => i.product_name).slice(0, 10),
  };
}

// ---------- orders ----------
export function adminListOrders(query: Record<string, unknown>) {
  const status = queryString(query.status);
  const search = queryString(query.search).toLowerCase();
  const from = queryString(query.from);
  const to = queryString(query.to);
  if (status && status !== 'all' && !ORDER_STATUSES.includes(status as OrderStatus)) throw badRequest('VALIDATION_ERROR', 'Unknown order status');
  const fromMs = from ? Date.parse(`${from}T00:00:00Z`) : -Infinity;
  const toMs = to ? Date.parse(`${to}T00:00:00Z`) + 86_400_000 : Infinity;
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) throw badRequest('INVALID_DATE', 'Dates must be YYYY-MM-DD');
  const { page, pageSize } = pageParams(query);
  const orders = listOrders().filter(o => {
    if (status && status !== 'all' && o.status !== status) return false;
    const created = Date.parse(o.created_at);
    if (created < fromMs || created >= toMs) return false;
    if (search && ![o.order_no, o.customer_name, o.customer_email].join(' ').toLowerCase().includes(search)) return false;
    return true;
  });
  const { items, pagination } = paginate(orders, page, pageSize);
  return { items: items.map(o => ({ ...o, item_count: itemsForOrder(o.id).reduce((s, i) => s + i.quantity, 0) })), pagination };
}

export function adminGetOrder(orderNo: string) {
  if (!ORDER_NO_PATTERN.test(orderNo)) throw badRequest('INVALID_ORDER_NUMBER', 'The order number is malformed');
  const order = findOrderByNo(orderNo);
  if (!order) throw notFound('ORDER_NOT_FOUND', 'Order not found');
  return { ...orderWithItems(order), allowed_transitions: ORDER_TRANSITIONS[order.status] };
}

export function adminUpdateOrderStatus(orderNo: string, body: Record<string, unknown>) {
  const order = adminGetOrder(orderNo);
  const to = body.status as OrderStatus;
  if (!ORDER_STATUSES.includes(to)) throw badRequest('VALIDATION_ERROR', 'Unknown order status');
  if (to === order.status) throw conflict('ORDER_STATUS_UNCHANGED', 'The order already has this status');
  if (!ORDER_TRANSITIONS[order.status].includes(to)) throw conflict('INVALID_ORDER_TRANSITION', `A ${order.status} order cannot move to ${to}`);
  // a cancelled order hands its units back to the store's own stock
  if (to === 'cancelled') {
    for (const item of order.items) if (item.business === LOCAL_BUSINESS.key) adjustLocalStock(Number(item.product_id), item.quantity);
  }
  setOrderStatus(order.id, to);
  return adminGetOrder(orderNo);
}

// ---------- local products ----------
function parseProduct(body: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  const has = (k: string) => body[k] !== undefined;
  if (!partial || has('name')) out.name = requiredString(body.name, 'name');
  if (!partial || has('category')) out.category = ensureCategory(requiredString(body.category, 'category', 120));
  if (!partial || has('price')) out.price = Math.round(nonNegativeNumber(body.price, 'price') * 100) / 100;
  if (!partial || has('stock')) {
    const stock = nonNegativeNumber(body.stock, 'stock');
    if (!Number.isInteger(stock)) throw badRequest('VALIDATION_ERROR', 'stock must be a whole number', { field: 'stock' });
    out.stock = stock;
  }
  if (!partial || has('unit')) out.unit = typeof body.unit === 'string' && body.unit.trim() ? body.unit.trim().slice(0, 50) : 'pcs';
  if (!partial || has('image_url')) out.image_url = typeof body.image_url === 'string' ? body.image_url.trim().slice(0, 2048) : '';
  if (!partial || has('description')) out.description = typeof body.description === 'string' ? body.description.trim().slice(0, 2000) : '';
  return out;
}

const assertLocal = (business: string) => {
  if (business !== LOCAL_BUSINESS.key) throw badRequest('VALIDATION_ERROR', 'Only the store’s own products can be edited here; partner stock is managed by the partner');
};

export const adminListProducts = () => listLocalProducts().map(p => ({ ...p, business: LOCAL_BUSINESS.key, status: getStockStatus(p.stock) }));

export function adminGetProduct(business: string, id: number) {
  assertLocal(business);
  const product = findLocalProduct(id);
  if (!product) throw notFound('PRODUCT_NOT_FOUND', 'Product not found');
  return { ...product, business, status: getStockStatus(product.stock) };
}

export const adminCreateProduct = (body: Record<string, unknown>) =>
  createLocalProduct(parseProduct(body, false) as Parameters<typeof createLocalProduct>[0]);

export function adminUpdateProduct(business: string, id: number, body: Record<string, unknown>) {
  assertLocal(business);
  const updated = updateLocalProduct(id, parseProduct(body, true));
  if (!updated) throw notFound('PRODUCT_NOT_FOUND', 'Product not found');
  return updated;
}

export function adminDeleteProduct(business: string, id: number) {
  assertLocal(business);
  if (!deleteLocalProduct(id)) throw notFound('PRODUCT_NOT_FOUND', 'Product not found');
}

export function productOptions() {
  return {
    categories: listCategories().map(c => c.name),
    businesses: listBusinesses().map(b => ({ key: b.key, name: b.name, kind: b.kind })),
    units: ['pcs', 'pair', 'set', 'pack'],
  };
}

// ---------- users ----------
const ROLES: Role[] = ['customer', 'admin'];

export const adminListUsers = () =>
  listUsers().map(u => ({ ...toPublicUser(u), order_count: listOrders().filter(o => o.user_id === u.id).length }));

export async function adminCreateUser(body: Record<string, unknown>) {
  const name = requiredString(body.name, 'name', 160);
  const email = requiredString(body.email, 'email', 254).toLowerCase();
  if (!isEmail(email)) throw badRequest('VALIDATION_ERROR', 'Enter a valid email address', { field: 'email' });
  if (findUserByEmail(email)) throw conflict('EMAIL_TAKEN', 'An account with this email already exists');
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < PASSWORD_MIN) throw badRequest('VALIDATION_ERROR', `Password must be at least ${PASSWORD_MIN} characters`, { field: 'password' });
  const role = (body.role as Role) ?? 'customer';
  if (!ROLES.includes(role)) throw badRequest('VALIDATION_ERROR', 'Role must be customer or admin', { field: 'role' });
  return toPublicUser(createUser({ name, email, role, password_hash: await bcrypt.hash(password, 10) }));
}

export async function adminUpdateUser(actor: User, id: number, body: Record<string, unknown>) {
  const user = findUserById(id);
  if (!user) throw notFound('USER_NOT_FOUND', 'User not found');
  const patch: Partial<User> = {};
  if (body.name !== undefined) patch.name = requiredString(body.name, 'name', 160);
  if (body.email !== undefined) {
    const email = requiredString(body.email, 'email', 254).toLowerCase();
    if (!isEmail(email)) throw badRequest('VALIDATION_ERROR', 'Enter a valid email address', { field: 'email' });
    const other = findUserByEmail(email);
    if (other && other.id !== id) throw conflict('EMAIL_TAKEN', 'An account with this email already exists');
    patch.email = email;
  }
  if (body.role !== undefined) {
    const role = body.role as Role;
    if (!ROLES.includes(role)) throw badRequest('VALIDATION_ERROR', 'Role must be customer or admin', { field: 'role' });
    if (user.role === 'admin' && role !== 'admin' && countAdmins() <= 1) throw conflict('LAST_ADMIN', 'The last administrator cannot be demoted');
    if (actor.id === id && role !== 'admin') throw conflict('SELF_DEMOTION', 'You cannot remove your own admin role');
    patch.role = role;
  }
  if (typeof body.password === 'string' && body.password) {
    if (body.password.length < PASSWORD_MIN) throw badRequest('VALIDATION_ERROR', `Password must be at least ${PASSWORD_MIN} characters`, { field: 'password' });
    patch.password_hash = await bcrypt.hash(body.password, 10);
  }
  return toPublicUser(updateUser(id, patch)!);
}

export function adminDeleteUser(actor: User, id: number) {
  const user = findUserById(id);
  if (!user) throw notFound('USER_NOT_FOUND', 'User not found');
  if (actor.id === id) throw conflict('SELF_DELETE', 'You cannot delete your own account');
  if (user.role === 'admin' && countAdmins() <= 1) throw conflict('LAST_ADMIN', 'The last administrator cannot be deleted');
  if (userHasOrders(id)) throw conflict('USER_HAS_ORDERS', 'This user has orders and cannot be deleted');
  deleteUser(id);
}

// ---------- businesses ----------
export const adminListBusinesses = () => listBusinesses().map(b => ({ ...b, recent_syncs: recentSyncLogs(b.key) }));

export function adminUpdateBusiness(id: number, body: Record<string, unknown>) {
  const business = findBusinessById(id);
  if (!business) throw notFound('BUSINESS_NOT_FOUND', 'Business not found');
  const patch: Parameters<typeof updateBusiness>[1] = {};
  if (body.name !== undefined) patch.name = requiredString(body.name, 'name', 120);
  if (body.status !== undefined) {
    if (body.status !== 'active' && body.status !== 'inactive') throw badRequest('VALIDATION_ERROR', 'Status must be active or inactive');
    patch.status = body.status;
  }
  if (body.api_url !== undefined) {
    if (business.kind === 'local') throw badRequest('VALIDATION_ERROR', 'The store’s own catalogue has no API URL');
    const url = requiredString(body.api_url, 'api_url', 2048);
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
    } catch {
      throw badRequest('VALIDATION_ERROR', 'api_url must be an http(s) URL', { field: 'api_url' });
    }
    patch.api_url = url;
  }
  if (!Object.keys(patch).length) throw new ApiError(400, 'VALIDATION_ERROR', 'Nothing to update');
  invalidatePartnerCache(business.key);
  return updateBusiness(id, patch);
}
