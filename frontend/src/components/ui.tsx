import type { ReactNode } from 'react';

import type { Pagination } from '../api/client';
import { label } from '../lib/format';

export const Spinner = () => <div className="v-spinner" role="status" aria-label="Loading" />;

export function ErrorAlert({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return <div className="v-alert v-alert-error" role="alert">{message}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="v-empty">{children}</div>;
}

const TONE: Record<string, string> = {
  'In Stock': 'ok', 'Low Stock': 'warn', 'Out of Stock': 'bad',
  online: 'ok', unavailable: 'bad', inactive: 'muted', active: 'ok',
  pending: 'muted', confirmed: 'info', processing: 'info', shipped: 'info', completed: 'ok', cancelled: 'bad',
  submitted: 'info', under_review: 'warn', approved: 'ok', rejected: 'bad',
  customer: 'muted', admin: 'info',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`v-badge v-badge-${TONE[status] ?? 'muted'}`}>{label(status)}</span>;
}

export function Pager({ pagination, onPage }: { pagination?: Pagination; onPage: (page: number) => void }) {
  if (!pagination || pagination.total_pages <= 1) return null;
  return (
    <div className="v-pager">
      <button className="v-btn v-btn-sm" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>← Prev</button>
      <span className="v-muted v-small">Page {pagination.page} of {pagination.total_pages}</span>
      <button className="v-btn v-btn-sm" disabled={pagination.page >= pagination.total_pages} onClick={() => onPage(pagination.page + 1)}>Next →</button>
    </div>
  );
}

export function QtyInput({ value, max, onChange }: { value: number; max?: number; onChange: (n: number) => void }) {
  const clamp = (n: number) => Math.max(1, Math.min(max ?? 999, Math.floor(n) || 1));
  return (
    <span className="v-qty">
      <button type="button" aria-label="Decrease" onClick={() => onChange(clamp(value - 1))}>−</button>
      <input aria-label="Quantity" inputMode="numeric" value={value} onChange={e => onChange(clamp(Number(e.target.value)))} />
      <button type="button" aria-label="Increase" onClick={() => onChange(clamp(value + 1))}>+</button>
    </span>
  );
}
