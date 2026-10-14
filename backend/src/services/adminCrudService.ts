// Admin add / edit / delete for categories, partner stores, orders and closed claims.
import { badRequest, conflict, notFound } from '../errors/apiError.js';
import { deleteStoredFile } from '../middleware/upload.js';
import { claimsForOrder, deleteClaim } from '../repositories/claimRepository.js';
import { deleteOrder, itemsForOrder, updateOrderFields } from '../repositories/orderRepository.js';
import {
  adjustLocalStock, countProductsInCategory, createBusiness, createCategory, deleteBusiness, deleteCategory, findBusinessById,
  findBusinessByKey, findCategoryById, findCategoryByName, listCategories, renameCategory,
} from '../repositories/productRepository.js';
import { LOCAL_BUSINESS } from '../store/seed.js';
import { TERMINAL_CLAIM_STATUSES } from '../types/claim.js';
import { requiredString } from '../utils/index.js';
import { adminGetOrder } from './adminService.js';
import { adminGetClaim } from './claimService.js';
import { parseShipping } from './orderService.js';
import { invalidatePartnerCache } from './productService.js';

// ---------- categories ----------
export const adminListCategories = () =>
  listCategories().map(c => ({ ...c, product_count: countProductsInCategory(c.name) }));

function categoryName(value: unknown) {
  return requiredString(value, 'name', 120);
}

export function adminCreateCategory(body: Record<string, unknown>) {
  const name = categoryName(body.name);
  if (findCategoryByName(name)) throw conflict('CATEGORY_EXISTS', 'A category with this name already exists');
  return createCategory(name);
}

export function adminRenameCategory(id: number, body: Record<string, unknown>) {
  const category = findCategoryById(id);
  if (!category) throw notFound('CATEGORY_NOT_FOUND', 'Category not found');
  const name = categoryName(body.name);
  const other = findCategoryByName(name);
  if (other && other.id !== id) throw conflict('CATEGORY_EXISTS', 'A category with this name already exists');
  return renameCategory(id, name)!;
}

export function adminDeleteCategory(id: number) {
  const category = findCategoryById(id);
  if (!category) throw notFound('CATEGORY_NOT_FOUND', 'Category not found');
  const used = countProductsInCategory(category.name);
  if (used > 0) throw conflict('CATEGORY_IN_USE', `${used} product(s) still use this category — move or delete them first`);
  deleteCategory(id);
}

// ---------- partner stores ----------
function apiUrl(value: unknown) {
  const url = requiredString(value, 'api_url', 2048);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
  } catch {
    throw badRequest('VALIDATION_ERROR', 'api_url must be an http(s) URL', { field: 'api_url' });
  }
  return url;
}

export function adminCreateBusiness(body: Record<string, unknown>) {
  const key = requiredString(body.key, 'key', 50).toLowerCase();
  if (!/^[a-z0-9-]+$/.test(key)) throw badRequest('VALIDATION_ERROR', 'Key may use lowercase letters, numbers and dashes only', { field: 'key' });
  if (findBusinessByKey(key)) throw conflict('BUSINESS_EXISTS', 'A store with this key already exists');
  return createBusiness({ key, name: requiredString(body.name, 'name', 120), api_url: apiUrl(body.api_url) });
}

export function adminDeleteBusiness(id: number) {
  const business = findBusinessById(id);
  if (!business) throw notFound('BUSINESS_NOT_FOUND', 'Store not found');
  if (business.kind === 'local' || business.key === LOCAL_BUSINESS.key) throw conflict('BUSINESS_PROTECTED', 'The store’s own catalogue cannot be deleted');
  invalidatePartnerCache(business.key);
  deleteBusiness(id); // past orders keep their own snapshot of the store name
}

// ---------- orders ----------
const EDITABLE_ORDER = ['pending', 'confirmed', 'processing'];

export function adminUpdateOrderShipping(orderNo: string, body: Record<string, unknown>) {
  const order = adminGetOrder(orderNo);
  if (!EDITABLE_ORDER.includes(order.status)) throw conflict('ORDER_NOT_EDITABLE', 'Shipping details can only change before the order ships');
  updateOrderFields(order.id, parseShipping(body));
  return adminGetOrder(orderNo);
}

export function adminDeleteOrder(orderNo: string) {
  const order = adminGetOrder(orderNo);
  if (claimsForOrder(order.id).length) throw conflict('ORDER_HAS_CLAIMS', 'This order has claims — delete the closed claims first');
  // an order that never shipped hands its units back to the store's own stock
  if (EDITABLE_ORDER.includes(order.status)) {
    for (const item of itemsForOrder(order.id)) {
      if (item.business === LOCAL_BUSINESS.key) adjustLocalStock(Number(item.product_id), item.quantity);
    }
  }
  deleteOrder(order.id);
}

// ---------- claims ----------
export function adminDeleteClaim(claimNo: string) {
  const claim = adminGetClaim(claimNo);
  if (!TERMINAL_CLAIM_STATUSES.includes(claim.status)) {
    throw conflict('CLAIM_NOT_CLOSED', 'Only rejected, completed or cancelled claims can be deleted');
  }
  deleteClaim(claim.id).forEach(deleteStoredFile);
}
