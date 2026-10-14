import { db, nextId } from '../store/db.js';
import type { Business, LocalProduct, SyncLog } from '../types/product.js';
import { nowIso } from '../utils/index.js';

// ---------- local catalogue ----------
export const listLocalProducts = () => db.products.map(p => ({ ...p }));

export const findLocalProduct = (id: number) => db.products.find(p => p.id === id);

export function createLocalProduct(input: Omit<LocalProduct, 'id' | 'created_at' | 'updated_at'>): LocalProduct {
  const now = nowIso();
  const product = { ...input, id: nextId('products'), created_at: now, updated_at: now };
  db.products.push(product);
  return product;
}

export function updateLocalProduct(id: number, patch: Partial<Omit<LocalProduct, 'id' | 'created_at'>>): LocalProduct | undefined {
  const product = findLocalProduct(id);
  if (!product) return undefined;
  Object.assign(product, patch, { updated_at: nowIso() });
  return product;
}

export function deleteLocalProduct(id: number): boolean {
  const index = db.products.findIndex(p => p.id === id);
  if (index < 0) return false;
  db.products.splice(index, 1);
  return true;
}

// Adjusts stock by `delta`; returns false (and changes nothing) if it would go negative.
export function adjustLocalStock(id: number, delta: number): boolean {
  const product = findLocalProduct(id);
  if (!product || product.stock + delta < 0) return false;
  product.stock += delta;
  product.updated_at = nowIso();
  return true;
}

// ---------- businesses ----------
export const listBusinesses = () => db.businesses.map(b => ({ ...b }));
export const findBusinessByKey = (key: string) => db.businesses.find(b => b.key === key);
export const findBusinessById = (id: number) => db.businesses.find(b => b.id === id);

export function updateBusiness(id: number, patch: Partial<Pick<Business, 'name' | 'status' | 'api_url' | 'last_checked_at'>>) {
  const business = findBusinessById(id);
  if (!business) return undefined;
  Object.assign(business, patch);
  return business;
}

// ---------- sync logs ----------
export function addSyncLog(log: Omit<SyncLog, 'id' | 'synced_at'>) {
  db.syncLogs.push({ ...log, id: nextId('syncLogs'), synced_at: nowIso() });
  if (db.syncLogs.length > 500) db.syncLogs.splice(0, db.syncLogs.length - 500);
}

export const recentSyncLogs = (businessKey: string, limit = 5) =>
  db.syncLogs.filter(l => l.business_key === businessKey).slice(-limit).reverse();

// ---------- categories ----------
export const listCategories = () => [...db.categories].sort((a, b) => a.name.localeCompare(b.name));
export const findCategoryById = (id: number) => db.categories.find(c => c.id === id);
export const findCategoryByName = (name: string) => db.categories.find(c => c.name.toLowerCase() === name.toLowerCase());
export const countProductsInCategory = (name: string) => db.products.filter(p => p.category === name).length;

export function createCategory(name: string) {
  const category = { id: nextId('categories'), name, created_at: nowIso() };
  db.categories.push(category);
  return category;
}

// Renaming a category moves its products along with it.
export function renameCategory(id: number, name: string) {
  const category = findCategoryById(id);
  if (!category) return undefined;
  for (const p of db.products) if (p.category === category.name) p.category = name;
  category.name = name;
  return category;
}

export function deleteCategory(id: number): boolean {
  const index = db.categories.findIndex(c => c.id === id);
  if (index < 0) return false;
  db.categories.splice(index, 1);
  return true;
}

// Products may name a new category: it is created so the list stays in sync,
// and an existing one is matched case-insensitively.
export function ensureCategory(name: string) {
  return (findCategoryByName(name) ?? createCategory(name)).name;
}

// ---------- partner businesses ----------
export function createBusiness(input: Pick<Business, 'key' | 'name' | 'api_url'>): Business {
  const business: Business = { ...input, id: nextId('businesses'), kind: 'partner', status: 'active', last_checked_at: null };
  db.businesses.push(business);
  return business;
}

export function deleteBusiness(id: number): boolean {
  const index = db.businesses.findIndex(b => b.id === id);
  if (index < 0) return false;
  db.businesses.splice(index, 1);
  return true;
}
