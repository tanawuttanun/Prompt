export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Allowed admin transitions; completed and cancelled are terminal.
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['completed'],
  completed: [],
  cancelled: [],
};

export const ORDER_NO_PATTERN = /^DLX-\d{8}-[0-9A-F]{6}$/;

export type OrderItem = {
  id: number;
  order_id: number;
  product_id: string;
  business: string;
  business_name: string;
  product_name: string;
  category: string | null;
  image_url: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: string;
};

export type ShippingFields = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address_line1: string;
  shipping_address_line2: string | null;
  shipping_district: string;
  shipping_province: string;
  shipping_postal_code: string;
  shipping_country: string;
};

export type Order = ShippingFields & {
  id: number;
  user_id: number | null;
  order_no: string;
  subtotal: number;
  shipping_fee: number;
  discount: number;
  total: number;
  status: OrderStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
