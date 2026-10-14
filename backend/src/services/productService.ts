import { createPartnerAdapter } from '../adapters/partner.js';
import type { ProductAdapter } from '../adapters/types.js';
import { vertexAdapter } from '../adapters/vertex.js';
import { addSyncLog, findBusinessByKey, listBusinesses, updateBusiness } from '../repositories/productRepository.js';
import { allOrderItems, findOrderById } from '../repositories/orderRepository.js';
import type { BusinessAvailability, NormalizedProduct } from '../types/product.js';
import { nowIso } from '../utils/index.js';

const PARTNER_CACHE_MS = 15_000;
const partnerCache = new Map<string, { at: number; products: NormalizedProduct[] }>();

function adapterFor(key: string): ProductAdapter | null {
  if (key === vertexAdapter.business) return vertexAdapter;
  const business = findBusinessByKey(key);
  if (!business || business.kind !== 'partner') return null;
  return createPartnerAdapter(business.key, business.name, () => findBusinessByKey(key)?.api_url ?? null);
}

type AdapterResult = { availability: BusinessAvailability; products: NormalizedProduct[] };

async function runAdapter(key: string, fresh: boolean): Promise<AdapterResult> {
  const business = findBusinessByKey(key)!;
  const base = { business: business.key, business_name: business.name };
  if (business.status === 'inactive') return { availability: { ...base, status: 'inactive', product_count: 0 }, products: [] };

  const adapter = adapterFor(key);
  const cached = partnerCache.get(key);
  if (business.kind === 'partner' && !fresh && cached && Date.now() - cached.at < PARTNER_CACHE_MS) {
    return { availability: { ...base, status: 'online', product_count: cached.products.length }, products: cached.products };
  }
  try {
    if (!adapter) throw new Error('No adapter for this business');
    const products = await adapter.fetchProducts();
    if (business.kind === 'partner') {
      partnerCache.set(key, { at: Date.now(), products });
      updateBusiness(business.id, { status: 'active', last_checked_at: nowIso() });
      addSyncLog({ business_key: key, status: 'success', products_received: products.length, message: `Received ${products.length} products` });
    }
    return { availability: { ...base, status: 'online', product_count: products.length }, products };
  } catch (error) {
    // one failing upstream never removes products returned by the others
    partnerCache.delete(key);
    updateBusiness(business.id, { status: 'unavailable', last_checked_at: nowIso() });
    addSyncLog({ business_key: key, status: 'failed', products_received: 0, message: error instanceof Error ? error.message : 'Unknown error' });
    return { availability: { ...base, status: 'unavailable', product_count: 0 }, products: [] };
  }
}

export async function getAllProducts(options: { fresh?: boolean } = {}) {
  // inactive is an admin choice, unavailable is retried on every fetch
  const keys = listBusinesses().map(b => b.key);
  const settled = await Promise.allSettled(keys.map(key => runAdapter(key, options.fresh ?? false)));
  const results = settled.flatMap(s => (s.status === 'fulfilled' ? [s.value] : []));
  return {
    data: results.flatMap(r => r.products),
    businesses: results.map(r => r.availability),
    source: 'adapters' as const,
  };
}

// Product identity is the pair (business, id): ids can collide across businesses.
export async function findProduct(business: string, id: string, fresh = false) {
  const business_ = findBusinessByKey(business);
  if (!business_) return { product: null, available: false };
  const result = await runAdapter(business, fresh);
  return {
    product: result.products.find(p => p.id === id) ?? null,
    available: result.availability.status === 'online',
  };
}

export async function getBusinessesAvailability() {
  const { businesses } = await getAllProducts();
  return businesses;
}

export async function getStockSummary() {
  const { data, businesses } = await getAllProducts();
  const per = businesses.map(b => {
    const products = data.filter(p => p.business === b.business);
    return {
      ...b,
      units: products.reduce((s, p) => s + p.stock, 0),
      low_stock: products.filter(p => p.status === 'Low Stock').length,
      out_of_stock: products.filter(p => p.status === 'Out of Stock').length,
    };
  });
  return {
    total_products: data.length,
    total_units: data.reduce((s, p) => s + p.stock, 0),
    low_stock: data.filter(p => p.status === 'Low Stock').length,
    out_of_stock: data.filter(p => p.status === 'Out of Stock').length,
    businesses: per,
  };
}

// Top products by quantity sold (cancelled orders excluded), joined to live data.
export async function getBestSellers(limit = 8) {
  const sold = new Map<string, { business: string; product_id: string; quantity: number }>();
  for (const item of allOrderItems()) {
    if (findOrderById(item.order_id)?.status === 'cancelled') continue;
    const key = `${item.business}:${item.product_id}`;
    const entry = sold.get(key) ?? { business: item.business, product_id: item.product_id, quantity: 0 };
    entry.quantity += item.quantity;
    sold.set(key, entry);
  }
  const { data } = await getAllProducts();
  return [...sold.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .flatMap(entry => {
      const product = data.find(p => p.business === entry.business && p.id === entry.product_id);
      return product ? [{ ...product, sold_quantity: entry.quantity }] : [];
    })
    .slice(0, limit);
}

export const invalidatePartnerCache = (key?: string) => (key ? partnerCache.delete(key) : partnerCache.clear());
