import { randomBytes } from 'node:crypto';

import { badRequest } from '../errors/apiError.js';
import type { StockStatus } from '../types/product.js';

// ---------- stock ----------
export function getStockStatus(stock: number): StockStatus {
  if (stock <= 0) return 'Out of Stock';
  if (stock <= 5) return 'Low Stock';
  return 'In Stock';
}

// ---------- money ----------
// Computed in satang (integers) and turned back into baht only at the edge,
// so float drift never reaches a total.
export const toSatang = (baht: number) => Math.round(baht * 100);
export const toBaht = (satang: number) => satang / 100;
export const lineTotal = (unitPrice: number, quantity: number) => toBaht(toSatang(unitPrice) * quantity);
export const sumBaht = (values: number[]) => toBaht(values.reduce((acc, v) => acc + toSatang(v), 0));

// ---------- ids ----------
export const utcDateKey = (d = new Date()) => d.toISOString().slice(0, 10).replace(/-/g, '');
export const newOrderNo = () => `DLX-${utcDateKey()}-${randomBytes(3).toString('hex').toUpperCase()}`;
export const formatClaimNo = (sequence: number, d = new Date()) => `CLM-${utcDateKey(d)}-${String(sequence).padStart(6, '0')}`;
export const nowIso = () => new Date().toISOString();

// ---------- files ----------
// Confirms an upload's declared MIME type against its magic bytes.
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function sniffImageType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

// ---------- validation ----------
export function requiredString(value: unknown, field: string, max = 255): string {
  if (typeof value !== 'string' || !value.trim()) throw badRequest('VALIDATION_ERROR', `${field} is required`, { field });
  const trimmed = value.trim();
  if (trimmed.length > max) throw badRequest('VALIDATION_ERROR', `${field} must be ${max} characters or fewer`, { field });
  return trimmed;
}

export function optionalString(value: unknown, field: string, max = 255): string | null {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return null;
  return requiredString(value, field, max);
}

export function positiveInt(value: unknown, field: string, code = 'VALIDATION_ERROR'): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) throw badRequest(code, `${field} must be a positive whole number`, { field });
  return n;
}

export function nonNegativeNumber(value: unknown, field: string): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) throw badRequest('VALIDATION_ERROR', `${field} must be zero or more`, { field });
  return n;
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export function pageParams(query: Record<string, unknown>, maxSize = 50) {
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, Math.floor(Number(query.page_size)) || 10));
  return { page, pageSize };
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    pagination: { page, page_size: pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export const queryString = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
