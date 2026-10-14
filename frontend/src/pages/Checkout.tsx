import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { api, ApiError } from '../api/client';
import type { Order } from '../api/types';
import { Empty, ErrorAlert } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { sparkleBurst } from '../components/sparkle';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { baht } from '../lib/format';
import { useCartLines } from './Cart';

const FIELDS: Array<{ name: string; label: string; required?: boolean; type?: string; wide?: boolean }> = [
  { name: 'customer_name', label: 'Full name', required: true },
  { name: 'customer_email', label: 'Email', required: true, type: 'email' },
  { name: 'customer_phone', label: 'Phone', required: true, type: 'tel' },
  { name: 'shipping_address_line1', label: 'Address', required: true, wide: true },
  { name: 'shipping_address_line2', label: 'Address line 2 (optional)', wide: true },
  { name: 'shipping_district', label: 'District / city', required: true },
  { name: 'shipping_province', label: 'Province', required: true },
  { name: 'shipping_postal_code', label: 'Postal code', required: true },
  { name: 'shipping_country', label: 'Country', required: true },
];

export default function Checkout() {
  const { user } = useAuth();
  const { lines, clear } = useCart();
  const { rows, subtotal, shipping, total, hasProblems } = useCartLines();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState<Record<string, string>>(() => ({
    customer_name: user?.name ?? '',
    customer_email: user?.email ?? '',
    customer_phone: user?.phone ?? '',
    shipping_address_line1: user?.address ?? '',
    shipping_address_line2: '',
    shipping_district: user?.city ?? '',
    shipping_province: user?.province ?? '',
    shipping_postal_code: user?.postal_code ?? '',
    shipping_country: user?.country ?? 'Thailand',
  }));
  const [error, setError] = useState<unknown>(null);
  const [lineErrors, setLineErrors] = useState<Array<{ business: string; product_id: string; message: string }>>([]);
  const [busy, setBusy] = useState(false);

  if (lines.length === 0) return <Empty>Your cart is empty. <Link className="v-link" to="/products">Go shopping</Link></Empty>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLineErrors([]);
    try {
      // only identity + quantity are sent; the server sets every price
      const order = await api.post<Order>('/orders', { ...form, items: lines });
      clear();
      sparkleBurst({ x: window.innerWidth / 2, y: window.innerHeight / 3 }, 28);
      toast('Order placed!', { detail: order.order_no, icon: '🎉', duration: 4500 });
      navigate(`/orders/${order.order_no}`, { state: { justPlaced: true } });
    } catch (err) {
      setError(err);
      const details = err instanceof ApiError ? (err.details as { lines?: typeof lineErrors } | undefined) : undefined;
      if (details?.lines) setLineErrors(details.lines);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="v-h1" style={{ marginBottom: 20 }}>Checkout</h1>
      <form className="v-split" onSubmit={submit}>
        <div className="v-panel">
          <h2 className="v-h3">Shipping details</h2>
          <div className="v-grid v-grid-2">
            {FIELDS.map(f => (
              <label key={f.name} className="v-field" style={f.wide ? { gridColumn: '1 / -1' } : undefined}>
                <span>{f.label}</span>
                <input className="v-input" name={f.name} type={f.type ?? 'text'} required={f.required} value={form[f.name] ?? ''} onChange={e => setForm({ ...form, [f.name]: e.target.value })} />
              </label>
            ))}
          </div>
        </div>
        <aside className="v-panel">
          <h2 className="v-h3">Order summary</h2>
          {rows.map(({ line, product }) => {
            const problem = lineErrors.find(l => l.business === line.business && l.product_id === line.product_id);
            return (
              <div key={`${line.business}:${line.product_id}`} className="v-line">
                {product?.image_url ? <img className="v-thumb v-thumb-sm" src={product.image_url} alt="" /> : <div className="v-thumb v-thumb-sm" />}
                <div style={{ flex: 1 }}>
                  <div className="v-small">{product?.name ?? line.product_id} × {line.quantity}</div>
                  {problem && <div className="v-small" style={{ color: 'var(--bad)' }}>{problem.message}</div>}
                </div>
                <span className="v-small">{product ? baht(product.price * line.quantity) : '—'}</span>
              </div>
            );
          })}
          <div className="v-total"><span>Subtotal</span><span>{baht(subtotal)}</span></div>
          <div className="v-total"><span>Shipping</span><span>{shipping === 0 ? 'Free' : baht(shipping)}</span></div>
          <div className="v-total v-grand"><span>Total</span><span>{baht(total)}</span></div>
          <ErrorAlert error={error} />
          <button className="v-btn v-btn-primary v-btn-block" style={{ marginTop: 14 }} disabled={busy || hasProblems}>{busy ? 'Placing order…' : 'Place order'}</button>
          <p className="v-small v-muted" style={{ marginTop: 10 }}>Demo store: no payment is taken.</p>
        </aside>
      </form>
    </>
  );
}
