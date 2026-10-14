import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { Product } from '../api/types';
import { AiDescription, RelatedProducts } from '../components/ai';
import { ErrorAlert, QtyInput, Spinner, StatusBadge } from '../components/ui';
import { sparkleBurst } from '../components/sparkle';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useApi } from '../hooks/useApi';
import { baht, date } from '../lib/format';

export default function ProductDetail() {
  const { business = '', id = '' } = useParams();
  const { data: product, error, loading } = useApi<Product>(`/products/${encodeURIComponent(business)}/${encodeURIComponent(id)}`);
  const { add, lines, isFavorite, toggleFavorite } = useCart();
  const toast = useToast();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (loading) return <Spinner />;
  if (error || !product) return <><ErrorAlert error={error ?? new Error('Product not found')} /><p style={{ marginTop: 16 }}><Link className="v-link" to="/products">← Back to shop</Link></p></>;

  const inCart = lines.find(l => l.business === product.business && l.product_id === product.id)?.quantity ?? 0;
  const canAdd = Math.max(0, product.stock - inCart);
  const fav = isFavorite(product.business, product.id);

  return (
    <>
      <p style={{ marginBottom: 16 }}><Link className="v-link" to="/products">← Back to shop</Link></p>
      <div className="v-detail">
        <div className="v-detail-img">{product.image_url && <img src={product.image_url} alt={product.name} />}</div>
        <div className="v-stack">
          <span className="v-muted">{product.category} · sold by {product.business_name}</span>
          <h1 className="v-h1">{product.name}</h1>
          <div className="v-row">
            <span className="v-price" style={{ fontSize: 28 }}>{baht(product.price)}</span>
            <StatusBadge status={product.status} />
          </div>
          <p className="v-muted v-small">{product.stock > 0 ? `${product.stock} ${product.unit} available` : 'Currently out of stock'} · updated {date(product.updated_at)}</p>
          {product.description && product.description.trim().length >= 30 && <p>{product.description}</p>}
          {product.description && product.description.trim().length < 30 && <p className="v-muted">{product.description}</p>}
          <AiDescription product={product} />
          <div className="v-divider" />
          <div className="v-row">
            <QtyInput value={Math.min(qty, Math.max(1, canAdd))} max={Math.max(1, canAdd)} onChange={setQty} />
            <button
              className="v-btn v-btn-primary"
              disabled={canAdd <= 0}
              onClick={e => {
                add(product.business, product.id, Math.min(qty, canAdd));
                sparkleBurst(e.currentTarget, 18);
                toast('Added to cart', { detail: `${Math.min(qty, canAdd)} × ${product.name}`, icon: '🛒' });
                setAdded(true);
                setTimeout(() => setAdded(false), 1500);
              }}
            >
              {product.stock <= 0 ? 'Sold out' : canAdd <= 0 ? 'All stock in your cart' : added ? 'Added ✓' : 'Add to cart'}
            </button>
            <button className="v-btn" aria-pressed={fav} onClick={() => toggleFavorite(product.business, product.id)}>{fav ? '♥ Saved' : '♡ Save'}</button>
          </div>
          {inCart > 0 && <p className="v-small v-muted">{inCart} already in your <Link className="v-link" to="/cart">cart</Link>.</p>}
        </div>
      </div>
      <RelatedProducts product={product} />
    </>
  );
}
