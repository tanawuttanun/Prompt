import { db, nextId } from '../store/db.js';
import type { Order, OrderItem, OrderStatus } from '../types/order.js';
import { nowIso } from '../utils/index.js';

const newestFirst = (a: Order, b: Order) => b.created_at.localeCompare(a.created_at) || b.id - a.id;

export const listOrders = () => [...db.orders].sort(newestFirst);
export const listOrdersByUser = (userId: number) => db.orders.filter(o => o.user_id === userId).sort(newestFirst);
export const findOrderByNo = (orderNo: string) => db.orders.find(o => o.order_no === orderNo);
export const findOrderById = (id: number) => db.orders.find(o => o.id === id);
export const orderNoExists = (orderNo: string) => db.orders.some(o => o.order_no === orderNo);
export const itemsForOrder = (orderId: number) => db.orderItems.filter(i => i.order_id === orderId);
export const findOrderItem = (id: number) => db.orderItems.find(i => i.id === id);
export const allOrderItems = () => [...db.orderItems];
export const userHasOrders = (userId: number) => db.orders.some(o => o.user_id === userId);

// Inserts the order and its item snapshot together (the in-memory "transaction").
export function insertOrderWithItems(
  order: Omit<Order, 'id' | 'created_at' | 'updated_at'>,
  items: Array<Omit<OrderItem, 'id' | 'order_id' | 'created_at'>>,
): Order {
  const now = nowIso();
  const stored: Order = { ...order, id: nextId('orders'), created_at: now, updated_at: now };
  const storedItems = items.map(item => ({ ...item, id: nextId('orderItems'), order_id: stored.id, created_at: now }));
  db.orders.push(stored);
  db.orderItems.push(...storedItems);
  return stored;
}

export function setOrderStatus(id: number, status: OrderStatus): Order | undefined {
  const order = findOrderById(id);
  if (!order) return undefined;
  order.status = status;
  order.updated_at = nowIso();
  if (status === 'completed') order.completed_at = order.updated_at;
  return order;
}

export function updateOrderFields(id: number, patch: Partial<Order>): Order | undefined {
  const order = findOrderById(id);
  if (!order) return undefined;
  Object.assign(order, patch, { updated_at: nowIso() });
  return order;
}

// Removes the order and its item snapshot together.
export function deleteOrder(id: number): boolean {
  const index = db.orders.findIndex(o => o.id === id);
  if (index < 0) return false;
  db.orders.splice(index, 1);
  for (let i = db.orderItems.length - 1; i >= 0; i--) if (db.orderItems[i]!.order_id === id) db.orderItems.splice(i, 1);
  return true;
}
