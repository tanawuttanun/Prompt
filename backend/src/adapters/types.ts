import type { NormalizedProduct } from '../types/product.js';

export type ProductAdapter = {
  business: string;
  businessName: string;
  fetchProducts(): Promise<NormalizedProduct[]>;
};
