// Customer-facing AI features. The model only proposes filters, ids or text;
// every product and order shown comes from real data looked up here in TypeScript.
import { badRequest } from '../../errors/apiError.js';
import { itemsForOrder, listOrdersByUser } from '../../repositories/orderRepository.js';
import type { NormalizedProduct } from '../../types/product.js';
import type { User } from '../../types/user.js';
import { getAllProducts, findProduct } from '../productService.js';
import { assertAiConfigured, generateJson, generateText } from './geminiClient.js';

// ---------- small TTL cache: stores only the AI's decision, never prices or stock ----------
const CACHE_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();
function cached<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;
  cache.delete(key);
  return undefined;
}
const remember = (key: string, value: unknown) => cache.set(key, { at: Date.now(), value });

const catalogLine = (p: NormalizedProduct) =>
  `${p.business}:${p.id} | ${p.name} | ${p.category} | ฿${p.price} | ${p.status}`;

// ---------- search ----------
type Filters = { keywords: string[]; category: string | null; business: string | null; min_price: number | null; max_price: number | null; in_stock: boolean };

function readFilters(raw: unknown, categories: string[], businesses: string[]): Filters {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
  const match = (v: unknown, list: string[]) => (typeof v === 'string' ? list.find(x => x.toLowerCase() === v.toLowerCase()) ?? null : null);
  return {
    keywords: Array.isArray(r.keywords) ? r.keywords.filter((k): k is string => typeof k === 'string' && k.length < 40).slice(0, 6) : [],
    category: match(r.category, categories),
    business: match(r.business, businesses),
    min_price: num(r.min_price),
    max_price: num(r.max_price),
    in_stock: r.in_stock === true,
  };
}

export async function aiSearch(body: Record<string, unknown>) {
  assertAiConfigured();
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query || query.length > 300) throw badRequest('VALIDATION_ERROR', 'Type what you are looking for (300 characters max)');
  const { data } = await getAllProducts();
  const categories = [...new Set(data.map(p => p.category))];
  const businesses = [...new Set(data.map(p => p.business))];
  const raw = await generateJson(
    `Shopper request: "${query}"\nCategories: ${categories.join(', ')}\nStores: ${businesses.join(', ')}\n` +
      'Return JSON {"keywords": string[], "category": string|null, "business": string|null, "min_price": number|null, "max_price": number|null, "in_stock": boolean}. ' +
      'Use only the listed categories/stores; prices are in Thai baht.',
    'You turn a sports-equipment shopper request (Thai or English) into structured search filters. Output JSON only.',
  );
  const filters = readFilters(raw, categories, businesses);
  const products = data.filter(p => {
    if (filters.category && p.category !== filters.category) return false;
    if (filters.business && p.business !== filters.business) return false;
    if (filters.min_price !== null && p.price < filters.min_price) return false;
    if (filters.max_price !== null && p.price > filters.max_price) return false;
    if (filters.in_stock && p.stock <= 0) return false;
    if (filters.keywords.length && !filters.category) {
      const text = `${p.name} ${p.category} ${p.description ?? ''}`.toLowerCase();
      return filters.keywords.some(k => text.includes(k.toLowerCase()));
    }
    return true;
  });
  return { filters, products };
}

// ---------- chat ----------
export async function aiChat(body: Record<string, unknown>, user: User | undefined) {
  assertAiConfigured();
  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages = raw
    .flatMap(m => {
      const msg = (m ?? {}) as Record<string, unknown>;
      const text = typeof msg.text === 'string' ? msg.text.trim().slice(0, 1000) : '';
      const role = msg.role === 'assistant' ? 'model' : 'user';
      return text ? [{ role: role as 'user' | 'model', text }] : [];
    })
    .slice(-10);
  if (!messages.length || messages[messages.length - 1]!.role !== 'user') throw badRequest('VALIDATION_ERROR', 'Send a message to the assistant');

  const { data } = await getAllProducts();
  const catalog = data.slice(0, 120).map(catalogLine).join('\n');
  // only the verified session's own orders, never a userId from the request body
  const orders = user
    ? listOrdersByUser(user.id)
        .slice(0, 10)
        .map(o => `${o.order_no} | ${o.status} | ฿${o.total} | ${o.created_at.slice(0, 10)} | ${itemsForOrder(o.id).map(i => `${i.product_name} x${i.quantity}`).join(', ')}`)
        .join('\n')
    : null;

  const system =
    'You are the friendly concierge of Delux Sport Club, a premium sports equipment club store. Answer in Thai unless the shopper writes in another language. ' +
    'Only recommend products from the catalogue below and never invent products, prices, stock or orders. Keep answers short.\n' +
    `CATALOGUE (store:id | name | category | price | stock):\n${catalog}\n` +
    (orders !== null
      ? `THIS SHOPPER'S ORDERS (order no | status | total | date | items):\n${orders || '(no orders yet)'}`
      : 'The shopper is not signed in: for questions about their orders, politely ask them to sign in first.');
  return { reply: (await generateText(messages, system)).trim() };
}

// ---------- recommendations ----------
export async function aiRecommend(productId: string, businessParam: unknown) {
  assertAiConfigured();
  const { data } = await getAllProducts();
  const business = typeof businessParam === 'string' && businessParam ? businessParam : undefined;
  const product = data.find(p => p.id === productId && (!business || p.business === business));
  if (!product) throw badRequest('PRODUCT_NOT_FOUND', 'Product not found');
  const key = `rec:${product.business}:${product.id}`;
  let ids = cached<string[]>(key);
  if (!ids) {
    const candidates = data.filter(p => !(p.business === product.business && p.id === product.id));
    const raw = await generateJson(
      `Product: ${catalogLine(product)}\nCandidates:\n${candidates.map(catalogLine).join('\n')}\n` +
        'Pick the 4 candidates a shopper of this product is most likely to also buy. Return JSON {"ids": ["store:id", ...]} using ids exactly as listed.',
      'You recommend related sports products. Output JSON only.',
    );
    const proposed = raw && typeof raw === 'object' && Array.isArray((raw as { ids?: unknown }).ids) ? (raw as { ids: unknown[] }).ids : [];
    const valid = new Set(candidates.map(p => `${p.business}:${p.id}`));
    ids = proposed.filter((id): id is string => typeof id === 'string' && valid.has(id)).slice(0, 4);
    remember(key, ids);
  }
  // re-read live price and stock on every request
  let picks = ids.flatMap(id => data.filter(p => `${p.business}:${p.id}` === id));
  if (picks.length < 4) {
    const fill = data.filter(p => p.category === product.category && p !== product && !picks.includes(p));
    picks = [...picks, ...fill].slice(0, 4);
  }
  return picks;
}

// ---------- descriptions ----------
export async function aiDescribe(body: Record<string, unknown>) {
  assertAiConfigured();
  const business = typeof body.business === 'string' ? body.business : '';
  const productId = typeof body.product_id === 'string' ? body.product_id : '';
  const { product } = await findProduct(business, productId);
  if (!product) throw badRequest('PRODUCT_NOT_FOUND', 'Product not found');
  if ((product.description ?? '').trim().length >= 30) return { description: product.description, ai_generated: false };
  const key = `desc:${product.business}:${product.id}`;
  let text = cached<string>(key);
  if (!text) {
    text = (
      await generateText(
        [{ role: 'user', text: `Write a 2-sentence Thai product description for "${product.name}" (category ${product.category}). No prices, no stock, no claims you cannot know.` }],
        'You write short, factual Thai copy for Delux Sport Club, a premium sports equipment store.',
      )
    )
      .trim()
      .slice(0, 600);
    remember(key, text);
  }
  return { description: text, ai_generated: true, label: 'AI-generated description' };
}
