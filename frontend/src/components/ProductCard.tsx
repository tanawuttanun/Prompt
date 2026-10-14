import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import type { Product } from '../api/types';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { baht } from '../lib/format';
import { sparkleBurst } from './sparkle';
import { StatusBadge } from './ui';

export function productPath(p: Pick<Product, 'business' | 'id'>) {
  return `/products/${encodeURIComponent(p.business)}/${encodeURIComponent(p.id)}`;
}

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { add, isFavorite, toggleFavorite } = useCart();
  const toast = useToast();
  const [added, setAdded] = useState(false);
  const fav = isFavorite(product.business, product.id);
  const soldOut = product.stock <= 0;

  return (
    <article className="v-pcard v-reveal" style={{ '--i': index } as CSSProperties}>
      <Link to={productPath(product)} className="v-pcard-img" aria-label={product.name}>
        {product.image_url && <img src={product.image_url} alt={product.name} loading="lazy" />}
        <StatusBadge status={product.status} />
      </Link>
      <button
        className={`v-icon-btn v-pcard-fav ${fav ? 'is-fav' : ''}`}
        aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
        aria-pressed={fav}
        onClick={e => {
          if (!fav) {
            sparkleBurst(e.currentTarget, 8);
            toast('Saved to favorites', { detail: product.name, icon: '♥' });
          }
          toggleFavorite(product.business, product.id);
        }}
      >
        {fav ? '♥' : '♡'}
      </button>
      <div className="v-pcard-body">
        <span className="v-muted v-small">{product.category} · {product.business_name}</span>
        <h3><Link to={productPath(product)}>{product.name}</Link></h3>
        <div className="v-between" style={{ marginTop: 'auto' }}>
          <span className="v-price">{baht(product.price)}</span>
          <button
            className="v-btn v-btn-sm v-btn-primary"
            disabled={soldOut}
            onClick={e => {
              add(product.business, product.id);
              sparkleBurst(e.currentTarget);
              toast('Added to cart', { detail: product.name, icon: '🛒' });
              setAdded(true);
              setTimeout(() => setAdded(false), 1200);
            }}
          >
            {soldOut ? 'Sold out' : added ? 'Added ✓' : 'Add to cart'}
          </button>
        </div>
      </div>
    </article>
  );
}
