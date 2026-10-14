export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

export type NormalizedProduct = {
  id: string;
  business: string;
  business_name: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  status: StockStatus;
  image_url: string;
  updated_at: string;
  description?: string;
};

export type BusinessAvailability = {
  business: string;
  business_name: string;
  status: 'online' | 'unavailable' | 'inactive';
  product_count: number;
};

export type Business = {
  id: number;
  key: string;
  name: string;
  kind: 'local' | 'partner';
  api_url: string | null;
  status: 'active' | 'inactive' | 'unavailable';
  last_checked_at: string | null;
};

export type SyncLog = {
  id: number;
  business_key: string;
  status: 'success' | 'failed' | 'partial';
  products_received: number;
  message: string;
  synced_at: string;
};

export type Category = { id: number; name: string; created_at: string };

// A product of the store's own catalogue, managed from the admin pages.
export type LocalProduct = {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  image_url: string;
  description: string;
  created_at: string;
  updated_at: string;
};
