import { Link, useNavigate } from 'react-router-dom';

import type { Product } from '../api/types';
import { productPath } from '../components/ProductCard';
import { Empty, ErrorAlert, QtyInput, Spinner, StatusBadge } from '../components/ui';
import { useCart, type CartLine } from '../context/CartContext';
import { baht } from '../lib/format';
import { useProducts } from './Products';

export const FREE_SHIPPING_FROM = 1500;
export const SHIPPING_FEE = 60;

// Joins cart lines with live inventory; prices shown here are estimates, the server re-prices.
export function useCartLines() {
  const { lines } = useCart();
  const { products, businesses, loading, error } = useProducts();
  const rows = lines.map(line => {
    const product = products.find(p => p.business === line.business && p.id === line.product_id) ?? null;
    const storeOffline = businesses.find(b => b.business === line.business)?.status !== 'online';
    let problem: string | null = null;
    if (!product) problem = storeOffline ? 'Store offline — cannot be checked right now' : 'No longer available';
    else if (product.stock <= 0) problem = 'Out of stock';
    else if (line.quantity > product.stock) problem = `Only ${product.stock} left`;
    return { line, product, problem };
  });
  const subtotal = rows.reduce((s, r) => s + (r.product ? Math.round(r.product.price * 100) * r.line.quantity : 0), 0) / 100;
  const shipping = subtotal >= FREE_SHIPPING_FROM || subtotal === 0 ? 0 : SHIPPING_FEE;
  return { rows, subtotal, shipping, total: subtotal + shipping, loading, error, hasProblems: rows.some(r => r.problem) };
}

export function CartRow({ line, product, problem }: { line: CartLine; product: Product | null; problem: string | null }) {
  const { setQuantity, remove } = useCart();
  return (
    <div className="v-line">
      {product?.image_url ? <img className="v-thumb" src={product.image_url} alt="" /> : <div className="v-thumb" />}
      <div style={{ flex: 1, minWidth: 0 }}>
        {product ? <Link to={productPath(product)} style={{ textDecoration: 'none', fontWeight: 600 }}>{product.name}</Link> : <b>{line.business} #{line.product_id}</b>}
        <div className="v-muted v-small">{product ? `${product.business_name} · ${baht(product.price)} each` : ''}</div>
        {problem ? <div className="v-small" style={{ color: 'var(--bad)' }}>{problem}</div> : product && <StatusBadge status={product.status} />}
      </div>
      <QtyInput value={line.quantity} max={product?.stock || undefined} onChange={n => setQuantity(line.business, line.product_id, n)} />
      <b style={{ width: 90, textAlign: 'right' }}>{product ? baht(product.price * line.quantity) : '—'}</b>
      <button className="v-icon-btn" aria-label="Remove" onClick={() => remove(line.business, line.product_id)}>×</button>
    </div>
  );
}

export default function Cart() {
  const { rows, subtotal, shipping, total, loading, error, hasProblems } = useCartLines();
  const { clear } = useCart();
  const navigate = useNavigate();

  if (rows.length === 0) return <Empty><h1 className="v-h2">Your cart is empty</h1><Link className="v-btn v-btn-primary" to="/products">Start shopping</Link></Empty>;

  return (
    <>
      <div className="v-page-head"><h1 className="v-h1">Your cart</h1><button className="v-link" onClick={clear}>Empty cart</button></div>
      <ErrorAlert error={error} />
      <div className="v-split">
        <div className="v-panel">{loading ? <Spinner /> : rows.map(r => <CartRow key={`${r.line.business}:${r.line.product_id}`} {...r} />)}</div>
        <aside className="v-panel">
          <h2 className="v-h3">Summary</h2>
          <div className="v-total"><span>Subtotal</span><span>{baht(subtotal)}</span></div>
          <div className="v-total"><span>Shipping</span><span>{shipping === 0 ? 'Free' : baht(shipping)}</span></div>
          {subtotal > 0 && subtotal < FREE_SHIPPING_FROM && <p className="v-small v-muted">Add {baht(FREE_SHIPPING_FROM - subtotal)} more for free shipping.</p>}
          <div className="v-total v-grand"><span>Total</span><span>{baht(total)}</span></div>
          {hasProblems && <div className="v-alert v-alert-warn" style={{ marginTop: 12 }}>Fix the highlighted items before checking out.</div>}
          <button className="v-btn v-btn-primary v-btn-block" style={{ marginTop: 14 }} disabled={loading || hasProblems} onClick={() => navigate('/checkout')}>Checkout</button>
          <p className="v-small v-muted" style={{ marginTop: 10 }}>Prices and stock are confirmed again when you place the order.</p>
        </aside>
      </div>
    </>
  );
}
