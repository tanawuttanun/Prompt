import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { Product, ProductsResponse } from '../api/types';
import { AiSearchBar } from '../components/ai';
import { ProductCard } from '../components/ProductCard';
import { Empty, ErrorAlert, Spinner } from '../components/ui';
import { useApi } from '../hooks/useApi';

type Sort = 'featured' | 'price_asc' | 'price_desc' | 'name' | 'newest';

export function useProducts() {
  const { raw, error, loading, reload } = useApi<Product[]>('/products');
  const response = raw as unknown as ProductsResponse | null;
  return { products: response?.data ?? [], businesses: response?.businesses ?? [], error, loading, reload };
}

export default function Products() {
  const { products, businesses, error, loading } = useProducts();
  const [params, setParams] = useSearchParams();
  const [aiResults, setAiResults] = useState<{ products: Product[]; query: string } | null>(null);

  const search = params.get('q') ?? '';
  const business = params.get('business') ?? '';
  const category = params.get('category') ?? '';
  const stock = params.get('stock') ?? '';
  const sort = (params.get('sort') as Sort) ?? 'featured';
  const minPrice = params.get('min') ?? '';
  const maxPrice = params.get('max') ?? '';

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const categories = useMemo(() => [...new Set(products.map(p => p.category))].sort(), [products]);

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    const list = products.filter(p => {
      if (q && !`${p.name} ${p.category} ${p.business_name}`.toLowerCase().includes(q)) return false;
      if (business && p.business !== business) return false;
      if (category && p.category !== category) return false;
      if (stock === 'in' && p.stock <= 0) return false;
      if (stock === 'low' && p.status !== 'Low Stock') return false;
      if (minPrice && p.price < Number(minPrice)) return false;
      if (maxPrice && p.price > Number(maxPrice)) return false;
      return true;
    });
    const sorted = [...list];
    if (sort === 'price_asc') sorted.sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') sorted.sort((a, b) => b.price - a.price);
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'newest') sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    if (sort === 'featured') sorted.sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));
    return sorted;
  }, [products, search, business, category, stock, sort, minPrice, maxPrice]);

  const offline = businesses.filter(b => b.status === 'unavailable');
  const shown = aiResults ? aiResults.products : visible;

  return (
    <>
      <div className="v-page-head">
        <div>
          <h1 className="v-h1">The <span className="gold-text">Delux</span> Pro Shop</h1>
          <p className="v-muted">{products.length} products from {businesses.filter(b => b.status === 'online').length} store(s)</p>
        </div>
      </div>

      <AiSearchBar onResults={(list, query) => setAiResults(list ? { products: list, query } : null)} />

      <div className="v-filters">
        <input className="v-input" placeholder="Search products…" value={search} onChange={e => set('q', e.target.value)} aria-label="Search" />
        <select className="v-select" value={category} onChange={e => set('category', e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="v-select" value={business} onChange={e => set('business', e.target.value)} aria-label="Store">
          <option value="">All stores</option>
          {businesses.map(b => <option key={b.business} value={b.business}>{b.business_name}</option>)}
        </select>
        <select className="v-select" value={stock} onChange={e => set('stock', e.target.value)} aria-label="Stock">
          <option value="">Any stock</option>
          <option value="in">In stock only</option>
          <option value="low">Low stock</option>
        </select>
        <select className="v-select" value={sort} onChange={e => set('sort', e.target.value)} aria-label="Sort">
          <option value="featured">Featured</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="name">Name A–Z</option>
          <option value="newest">Recently updated</option>
        </select>
      </div>
      <div className="v-row" style={{ marginBottom: 18 }}>
        <span className="v-muted v-small">Price (฿)</span>
        <input className="v-input" style={{ width: 110 }} inputMode="numeric" placeholder="Min" value={minPrice} onChange={e => set('min', e.target.value.replace(/\D/g, ''))} aria-label="Minimum price" />
        <input className="v-input" style={{ width: 110 }} inputMode="numeric" placeholder="Max" value={maxPrice} onChange={e => set('max', e.target.value.replace(/\D/g, ''))} aria-label="Maximum price" />
        {params.toString() && <button className="v-link" onClick={() => setParams({}, { replace: true })}>Clear filters</button>}
      </div>

      {offline.map(b => (
        <div key={b.business} className="v-alert v-alert-warn" style={{ marginBottom: 12 }}>
          {b.business_name} store is offline right now — its products will be back when it reconnects.
        </div>
      ))}
      {aiResults && (
        <div className="v-alert v-alert-info v-between" style={{ marginBottom: 16 }}>
          <span>✨ AI results for “{aiResults.query}” — {aiResults.products.length} match(es)</span>
          <button className="v-link" onClick={() => setAiResults(null)}>Show all products</button>
        </div>
      )}

      <ErrorAlert error={error} />
      {loading ? <Spinner /> : shown.length === 0 ? <Empty>No products match your filters.</Empty> : (
        <div className="v-products">{shown.map((p, i) => <ProductCard key={`${p.business}:${p.id}`} product={p} index={i} />)}</div>
      )}
    </>
  );
}
