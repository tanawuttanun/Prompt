// The store's own catalogue (admin-managed, kept in memory).
import { listLocalProducts } from '../repositories/productRepository.js';
import { LOCAL_BUSINESS } from '../store/seed.js';
import type { LocalProduct, NormalizedProduct } from '../types/product.js';
import { getStockStatus } from '../utils/index.js';
import type { ProductAdapter } from './types.js';

export const toNormalized = (p: LocalProduct): NormalizedProduct => ({
  id: String(p.id),
  business: LOCAL_BUSINESS.key,
  business_name: LOCAL_BUSINESS.name,
  name: p.name,
  category: p.category,
  price: p.price,
  stock: p.stock,
  unit: p.unit,
  status: getStockStatus(p.stock),
  image_url: p.image_url,
  updated_at: p.updated_at,
  description: p.description,
});

export const vertexAdapter: ProductAdapter = {
  business: LOCAL_BUSINESS.key,
  businessName: LOCAL_BUSINESS.name,
  async fetchProducts() {
    return listLocalProducts().map(toNormalized);
  },
};
