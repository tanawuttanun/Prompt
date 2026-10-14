// A partner store's external stock API, configured in PARTNER_APIS.
// The mapping below lists, per normalized field, the source field names tried in
// order; edit it when a partner names a field differently.
import type { NormalizedProduct } from '../types/product.js';
import { getStockStatus } from '../utils/index.js';
import type { ProductAdapter } from './types.js';

const REQUEST_TIMEOUT_MS = 10_000;

const FIELD_MAP = {
  id: ['id', 'product_id', 'productId', 'sku', '_id'],
  name: ['name', 'product_name', 'productName', 'title'],
  category: ['category', 'category_name', 'categoryName', 'type'],
  price: ['price', 'unit_price', 'unitPrice'],
  stock: ['stock', 'total_stock', 'quantity', 'qty', 'inventory'],
  image: ['image_url', 'imageUrl', 'image', 'thumbnail', 'img'],
  updated: ['updated_at', 'updatedAt', 'modified_at'],
  description: ['description', 'detail', 'details'],
} as const;

type Raw = Record<string, unknown>;

const pick = (raw: Raw, keys: readonly string[]) => {
  for (const key of keys) if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') return raw[key];
  return undefined;
};

const toNumber = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/,/g, '')) : NaN;
  return Number.isFinite(n) ? n : null;
};

// Relative image paths are resolved against the upstream origin.
const resolveImage = (value: unknown, apiUrl: string) => {
  if (typeof value !== 'string' || !value) return '';
  try {
    return new URL(value, apiUrl).toString();
  } catch {
    return '';
  }
};

export function normalizePartnerItem(raw: Raw, business: string, businessName: string, apiUrl: string): NormalizedProduct | null {
  const id = pick(raw, FIELD_MAP.id);
  const name = pick(raw, FIELD_MAP.name);
  const price = toNumber(pick(raw, FIELD_MAP.price));
  const stock = toNumber(pick(raw, FIELD_MAP.stock));
  // never invent: skip items without an id, a name, or a numeric price/stock
  if ((typeof id !== 'string' && typeof id !== 'number') || typeof name !== 'string' || price === null || stock === null) return null;
  const updated = pick(raw, FIELD_MAP.updated);
  const description = pick(raw, FIELD_MAP.description);
  const category = pick(raw, FIELD_MAP.category);
  const safeStock = Math.max(0, Math.floor(stock));
  return {
    id: String(id),
    business,
    business_name: businessName,
    name: name.trim(),
    category: typeof category === 'string' && category.trim() ? category.trim() : businessName,
    price,
    stock: safeStock,
    unit: 'pcs',
    status: getStockStatus(safeStock),
    image_url: resolveImage(pick(raw, FIELD_MAP.image), apiUrl),
    updated_at: typeof updated === 'string' && !Number.isNaN(Date.parse(updated)) ? new Date(updated).toISOString() : new Date().toISOString(),
    description: typeof description === 'string' ? description : undefined,
  };
}

export function parsePartnerPayload(payload: unknown): Raw[] {
  if (Array.isArray(payload)) return payload as Raw[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) return (payload as { data: Raw[] }).data;
  throw new Error('Response is neither an array nor { data: [...] }');
}

export function createPartnerAdapter(business: string, businessName: string, getUrl: () => string | null): ProductAdapter {
  return {
    business,
    businessName,
    async fetchProducts() {
      const url = getUrl();
      if (!url) throw new Error('No API URL configured');
      const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`Upstream answered HTTP ${response.status}`);
      const items = parsePartnerPayload(await response.json());
      return items.flatMap(raw => {
        const product = raw && typeof raw === 'object' ? normalizePartnerItem(raw, business, businessName, url) : null;
        return product ? [product] : [];
      });
    },
  };
}
