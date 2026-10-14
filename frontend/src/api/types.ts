export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

export type Product = {
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
  sold_quantity?: number;
};

export type BusinessAvailability = { business: string; business_name: string; status: 'online' | 'unavailable' | 'inactive'; product_count: number };

export type ProductsResponse = { data: Product[]; businesses: BusinessAvailability[]; source: string };

export type User = {
  id: number;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  profile_image_url: string | null;
  created_at: string;
};

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'completed' | 'cancelled';

export type OrderItem = {
  id: number;
  product_id: string;
  business: string;
  business_name: string;
  product_name: string;
  category: string | null;
  image_url: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type Order = {
  order_no: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address_line1: string;
  shipping_address_line2: string | null;
  shipping_district: string;
  shipping_province: string;
  shipping_postal_code: string;
  shipping_country: string;
  subtotal: number;
  shipping_fee: number;
  discount: number;
  total: number;
  status: OrderStatus;
  completed_at: string | null;
  created_at: string;
  items: OrderItem[];
  item_count?: number;
  claim_eligibility?: { ok: boolean; reason?: string };
  allowed_transitions?: OrderStatus[];
};

export type ClaimStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'processing' | 'completed' | 'cancelled';
export type ClaimReason = 'damaged' | 'defective' | 'wrong_item' | 'missing_parts' | 'other';

export type ClaimSummary = {
  claim_number: string;
  order_no: string;
  status: ClaimStatus;
  reason: ClaimReason;
  item_count: number;
  businesses: string[];
  created_at: string;
  updated_at: string;
  customer_name?: string;
};

export type ClaimHistory = {
  previous_status: ClaimStatus | null;
  new_status: ClaimStatus;
  changed_by_role: 'customer' | 'admin';
  note: string | null;
  created_at: string;
  visibility?: 'customer' | 'internal';
  changed_by_name?: string | null;
};

export type ClaimDetail = {
  claim_number: string;
  order_no: string;
  status: ClaimStatus;
  reason: ClaimReason;
  description: string;
  contact_phone: string | null;
  admin_note: string | null;
  items: Array<{ order_item_id: number; quantity: number; product_name: string; business_name: string; unit_price: number; line_total: number; image_url: string | null }>;
  evidence: Array<{ id: number; image_url: string; mime_type: string; file_size: number }>;
  history: ClaimHistory[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  allowed_transitions?: ClaimStatus[];
  customer?: { id: number; name: string; email: string; phone: string | null } | null;
  order?: { order_no: string; status: OrderStatus; total: number; created_at: string } | null;
};

export type ClaimableItem = OrderItem & { claimed_quantity: number; claimable_quantity: number };
