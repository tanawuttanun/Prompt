import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';
import type { User } from '../api/types';
import { ProductCard } from '../components/ProductCard';
import { Empty, ErrorAlert, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useProducts } from './Products';

const FIELDS: Array<{ name: keyof User; label: string; wide?: boolean }> = [
  { name: 'name', label: 'Full name' },
  { name: 'phone', label: 'Phone' },
  { name: 'address', label: 'Address', wide: true },
  { name: 'city', label: 'District / city' },
  { name: 'province', label: 'Province' },
  { name: 'postal_code', label: 'Postal code' },
  { name: 'country', label: 'Country' },
];

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map(f => [f.name, String(user?.[f.name] ?? '')])));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setUser(await api.put<User>('/profile', form));
      setMessage('Profile saved.');
      toast('Profile saved', { icon: '✔' });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const uploadImage = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set('image', file);
    try {
      setUser(await api.upload<User>('/profile/image', fd));
    } catch (err) {
      setError(err);
    }
  };

  return (
    <>
      <h1 className="v-h1" style={{ marginBottom: 20 }}>My profile</h1>
      <div className="v-split">
        <form className="v-panel v-form" onSubmit={save}>
          <div className="v-grid v-grid-2">
            {FIELDS.map(f => (
              <label key={f.name} className="v-field" style={f.wide ? { gridColumn: '1 / -1' } : undefined}>
                <span>{f.label}</span>
                <input className="v-input" value={form[f.name] ?? ''} required={f.name === 'name'} onChange={e => setForm({ ...form, [f.name]: e.target.value })} />
              </label>
            ))}
          </div>
          <ErrorAlert error={error} />
          {message && <div className="v-alert v-alert-ok">{message}</div>}
          <div><button className="v-btn v-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div>
        </form>
        <aside className="v-panel v-stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          {user.profile_image_url ? (
            <img src={user.profile_image_url} alt="Profile" style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'var(--panel-2)', display: 'grid', placeItems: 'center', fontSize: 42 }}>{user.name[0]}</div>
          )}
          <b>{user.email}</b>
          <span className="v-muted v-small">{user.role === 'admin' ? 'Administrator' : 'Club member'}</span>
          <label className="v-btn v-btn-sm">
            Upload photo
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => uploadImage(e.target.files?.[0])} />
          </label>
          {user.profile_image_url && (
            <button className="v-link v-small" onClick={async () => setUser(await api.del<User>('/profile/image'))}>Remove photo</button>
          )}
        </aside>
      </div>
    </>
  );
}

export function Favorites() {
  const { favorites } = useCart();
  const { products, loading } = useProducts();
  const items = products.filter(p => favorites.includes(`${p.business}:${p.id}`));
  if (loading) return <Spinner />;
  return (
    <>
      <h1 className="v-h1" style={{ marginBottom: 20 }}>Favorites</h1>
      {items.length === 0 ? <Empty>Tap ♡ on any product to save it here. <Link className="v-link" to="/products">Browse the shop</Link></Empty> : (
        <div className="v-products">{items.map((p, i) => <ProductCard key={`${p.business}:${p.id}`} product={p} index={i} />)}</div>
      )}
    </>
  );
}

export function NotFound() {
  return <Empty><h1 className="v-h1">Page not found</h1><Link className="v-btn v-btn-primary" to="/products">Go to the shop</Link></Empty>;
}
