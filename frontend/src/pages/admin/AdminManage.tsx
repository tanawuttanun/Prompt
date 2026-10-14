import { useState, type FormEvent } from 'react';

import { api, errorMessage } from '../../api/client';
import type { User } from '../../api/types';
import { ErrorAlert, Spinner, StatusBadge } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { baht, date, dateTime } from '../../lib/format';

// Shared delete flow: themed confirm, then the request, then a toast either way.
function useDelete() {
  const confirm = useConfirm();
  const toast = useToast();
  return async (opts: { title: string; message?: string; path: string; done: string; onDone: () => void }) => {
    if (!(await confirm({ title: opts.title, message: opts.message ?? 'This cannot be undone.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await api.del(opts.path);
      toast(opts.done, { icon: '🗑' });
      opts.onDone();
    } catch (err) {
      toast('Could not delete', { detail: errorMessage(err), tone: 'error', icon: '!' });
    }
  };
}

// ---------- products ----------
type AdminProduct = { id: number; business: string; name: string; category: string; price: number; stock: number; unit: string; image_url: string; description: string; status: string };
type ProductOptions = { categories: string[]; units: string[] };
const EMPTY_PRODUCT = { name: '', category: '', price: '', stock: '', unit: 'pcs', image_url: '', description: '' };

export function AdminProducts() {
  const { data: products, error, loading, reload } = useApi<AdminProduct[]>('/admin/products');
  const { data: options, reload: reloadOptions } = useApi<ProductOptions>('/admin/product-options');
  const [editing, setEditing] = useState<AdminProduct | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const remove = useDelete();

  const list = (products ?? []).filter(
    p => `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()) && (!category || p.category === category),
  );

  return (
    <>
      <div className="v-page-head">
        <div>
          <h1 className="v-h1">Products</h1>
          <p className="v-muted v-small">{products?.length ?? 0} products in the Delux catalogue</p>
        </div>
        <div className="v-row">
          <input className="v-input" style={{ width: 200 }} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search products" />
          <select className="v-select" style={{ width: 160 }} value={category} onChange={e => setCategory(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {options?.categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <button className="v-btn v-btn-primary" onClick={() => setEditing('new')}>+ New product</button>
        </div>
      </div>
      <ErrorAlert error={error} />
      {loading ? <Spinner /> : (
        <div className="v-panel v-table-wrap" style={{ padding: 0 }}>
          <table className="v-table">
            <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th /></tr></thead>
            <tbody>
              {list.map(p => (
                <tr key={p.id}>
                  <td><div className="v-row">{p.image_url ? <img className="v-thumb v-thumb-sm" src={p.image_url} alt="" /> : <div className="v-thumb v-thumb-sm" />}<b>{p.name}</b></div></td>
                  <td>{p.category}</td>
                  <td>{baht(p.price)}</td>
                  <td><div className="v-row">{p.stock} <StatusBadge status={p.status} /></div></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="v-btn v-btn-sm" onClick={() => setEditing(p)}>Edit</button>{' '}
                    <button
                      className="v-btn v-btn-sm v-btn-danger"
                      onClick={() => remove({ title: `Delete “${p.name}”?`, path: `/admin/products/${p.business}/${p.id}`, done: 'Product deleted', onDone: reload })}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} className="v-muted" style={{ textAlign: 'center' }}>No products match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <ProductModal
          product={editing === 'new' ? null : editing}
          options={options}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
            reloadOptions();
          }}
        />
      )}
    </>
  );
}

function ProductModal({ product, options, onClose, onSaved }: { product: AdminProduct | null; options: ProductOptions | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(() =>
    product ? { name: product.name, category: product.category, price: String(product.price), stock: String(product.stock), unit: product.unit, image_url: product.image_url, description: product.description } : EMPTY_PRODUCT,
  );
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k: keyof typeof form, v: string) => setForm({ ...form, [k]: v });

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.set('image', file);
    try {
      set('image_url', (await api.upload<{ image_url: string }>('/admin/products/upload-image', fd)).image_url);
    } catch (err) {
      setError(err);
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = { ...form, price: Number(form.price), stock: Number(form.stock) };
    try {
      if (product) await api.put(`/admin/products/${product.business}/${product.id}`, body);
      else await api.post('/admin/products', body);
      toast(product ? 'Product updated' : 'Product created', { detail: form.name, icon: '🏷' });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="v-modal-bg" onClick={onClose}>
      <form className="v-panel v-modal v-form" onClick={e => e.stopPropagation()} onSubmit={save}>
        <h2 className="v-h2">{product ? 'Edit product' : 'New product'}</h2>
        <label className="v-field"><span>Name</span><input className="v-input" required value={form.name} onChange={e => set('name', e.target.value)} /></label>
        <div className="v-grid v-grid-2">
          <label className="v-field"><span>Category (type a new one to create it)</span>
            <input className="v-input" required list="v-categories" value={form.category} onChange={e => set('category', e.target.value)} />
            <datalist id="v-categories">{options?.categories.map(c => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="v-field"><span>Unit</span>
            <select className="v-select" value={form.unit} onChange={e => set('unit', e.target.value)}>{(options?.units ?? ['pcs']).map(u => <option key={u}>{u}</option>)}</select>
          </label>
          <label className="v-field"><span>Price (฿)</span><input className="v-input" required type="number" min="0" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} /></label>
          <label className="v-field"><span>Stock</span><input className="v-input" required type="number" min="0" step="1" value={form.stock} onChange={e => set('stock', e.target.value)} /></label>
        </div>
        <label className="v-field"><span>Image URL</span><input className="v-input" value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://… or upload below" /></label>
        <div className="v-row">
          {form.image_url && <img className="v-thumb" src={form.image_url} alt="" />}
          <label className="v-btn v-btn-sm">Upload image<input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e => upload(e.target.files?.[0])} /></label>
        </div>
        <label className="v-field"><span>Description</span><textarea className="v-textarea" maxLength={2000} value={form.description} onChange={e => set('description', e.target.value)} /></label>
        <ErrorAlert error={error} />
        <div className="v-row"><button className="v-btn v-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="v-btn" onClick={onClose}>Cancel</button></div>
      </form>
    </div>
  );
}

// ---------- categories ----------
type AdminCategory = { id: number; name: string; product_count: number; created_at: string };

export function AdminCategories() {
  const { data: categories, error, loading, reload } = useApi<AdminCategory[]>('/admin/categories');
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [actionError, setActionError] = useState<unknown>(null);
  const toast = useToast();
  const remove = useDelete();

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await api.post('/admin/categories', { name });
      toast('Category added', { detail: name, icon: '🏷' });
      setName('');
      reload();
    } catch (err) {
      setActionError(err);
    }
  };

  const rename = async (c: AdminCategory) => {
    setActionError(null);
    try {
      await api.put(`/admin/categories/${c.id}`, { name: draft });
      toast('Category renamed', { detail: `${c.name} → ${draft}${c.product_count ? ` (${c.product_count} products moved)` : ''}`, icon: '✎' });
      setEditingId(null);
      reload();
    } catch (err) {
      setActionError(err);
    }
  };

  return (
    <>
      <h1 className="v-h1" style={{ marginBottom: 6 }}>Categories</h1>
      <p className="v-muted" style={{ marginBottom: 18 }}>Renaming moves every product along with it. A category can be deleted once no product uses it.</p>
      <form className="v-panel v-row" style={{ marginBottom: 16 }} onSubmit={add}>
        <input className="v-input" style={{ flex: 1, minWidth: 200 }} placeholder="New category name, e.g. Badminton" required value={name} onChange={e => setName(e.target.value)} aria-label="New category name" />
        <button className="v-btn v-btn-primary">+ Add category</button>
      </form>
      <ErrorAlert error={error ?? actionError} />
      {loading ? <Spinner /> : (
        <div className="v-panel v-table-wrap" style={{ padding: 0 }}>
          <table className="v-table">
            <thead><tr><th>Name</th><th>Products</th><th>Created</th><th /></tr></thead>
            <tbody>
              {categories?.map(c => (
                <tr key={c.id}>
                  <td>
                    {editingId === c.id ? (
                      <form className="v-row" onSubmit={e => { e.preventDefault(); rename(c); }}>
                        <input className="v-input" style={{ maxWidth: 240 }} autoFocus required value={draft} onChange={e => setDraft(e.target.value)} aria-label="Category name" />
                        <button className="v-btn v-btn-sm v-btn-primary">Save</button>
                        <button type="button" className="v-btn v-btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                      </form>
                    ) : <b>{c.name}</b>}
                  </td>
                  <td>{c.product_count}</td>
                  <td className="v-small">{date(c.created_at)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {editingId !== c.id && <button className="v-btn v-btn-sm" onClick={() => { setEditingId(c.id); setDraft(c.name); }}>Rename</button>}{' '}
                    <button
                      className="v-btn v-btn-sm v-btn-danger"
                      disabled={c.product_count > 0}
                      title={c.product_count > 0 ? 'Move or delete its products first' : undefined}
                      onClick={() => remove({ title: `Delete category “${c.name}”?`, path: `/admin/categories/${c.id}`, done: 'Category deleted', onDone: reload })}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ---------- users ----------
type AdminUser = User & { order_count: number };

export function AdminUsers() {
  const { user: me } = useAuth();
  const { data: users, error, loading, reload } = useApi<AdminUser[]>('/admin/users');
  const [editing, setEditing] = useState<AdminUser | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const remove = useDelete();
  const list = (users ?? []).filter(u => `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="v-page-head">
        <h1 className="v-h1">Users</h1>
        <div className="v-row">
          <input className="v-input" style={{ width: 220 }} placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search users" />
          <button className="v-btn v-btn-primary" onClick={() => setEditing('new')}>+ New user</button>
        </div>
      </div>
      <ErrorAlert error={error} />
      {loading ? <Spinner /> : (
        <div className="v-panel v-table-wrap" style={{ padding: 0 }}>
          <table className="v-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Orders</th><th>Joined</th><th /></tr></thead>
            <tbody>
              {list.map(u => (
                <tr key={u.id}>
                  <td><b>{u.name}</b>{u.id === me?.id && <span className="v-muted v-small"> (you)</span>}</td>
                  <td>{u.email}</td>
                  <td><StatusBadge status={u.role} /></td>
                  <td>{u.order_count}</td>
                  <td className="v-small">{date(u.created_at)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="v-btn v-btn-sm" onClick={() => setEditing(u)}>Edit</button>{' '}
                    <button
                      className="v-btn v-btn-sm v-btn-danger"
                      disabled={u.id === me?.id}
                      onClick={() => remove({ title: `Delete ${u.email}?`, message: 'Users who have placed orders cannot be deleted (their order history must stay).', path: `/admin/users/${u.id}`, done: 'User deleted', onDone: reload })}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <UserModal user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

function UserModal({ user, onClose, onSaved }: { user: AdminUser | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', role: user?.role ?? 'customer', password: '' });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (user) await api.put(`/admin/users/${user.id}`, { ...form, password: form.password || undefined });
      else await api.post('/admin/users', form);
      toast(user ? 'User updated' : 'User created', { detail: form.email, icon: '👤' });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="v-modal-bg" onClick={onClose}>
      <form className="v-panel v-modal v-form" onClick={e => e.stopPropagation()} onSubmit={save}>
        <h2 className="v-h2">{user ? 'Edit user' : 'New user'}</h2>
        <label className="v-field"><span>Name</span><input className="v-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label className="v-field"><span>Email</span><input className="v-input" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
        <label className="v-field"><span>Role</span>
          <select className="v-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as User['role'] })}><option value="customer">Customer</option><option value="admin">Admin</option></select>
        </label>
        <label className="v-field"><span>{user ? 'New password (leave blank to keep)' : 'Password (8+ characters)'}</span>
          <input className="v-input" type="password" autoComplete="new-password" required={!user} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        </label>
        <ErrorAlert error={error} />
        <div className="v-row"><button className="v-btn v-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="v-btn" onClick={onClose}>Cancel</button></div>
      </form>
    </div>
  );
}

// ---------- businesses ----------
type AdminBusiness = {
  id: number; key: string; name: string; kind: 'local' | 'partner'; api_url: string | null; status: string; last_checked_at: string | null;
  recent_syncs: Array<{ id: number; status: string; products_received: number; message: string; synced_at: string }>;
};

export function AdminBusinesses() {
  const { data: businesses, error, loading, reload } = useApi<AdminBusiness[]>('/admin/businesses');
  const [actionError, setActionError] = useState<unknown>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ key: '', name: '', api_url: '' });
  const toast = useToast();
  const remove = useDelete();

  const update = async (b: AdminBusiness, body: Record<string, string>, done: string) => {
    setActionError(null);
    try {
      await api.put(`/admin/businesses/${b.id}`, body);
      toast(done, { detail: b.name, icon: '🏬' });
      reload();
    } catch (err) {
      setActionError(err);
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await api.post('/admin/businesses', form);
      toast('Partner store added', { detail: form.name, icon: '🏬' });
      setForm({ key: '', name: '', api_url: '' });
      setAdding(false);
      reload();
    } catch (err) {
      setActionError(err);
    }
  };

  return (
    <>
      <div className="v-page-head">
        <div>
          <h1 className="v-h1">Stores</h1>
          <p className="v-muted v-small">The club’s own catalogue plus partner stock APIs.</p>
        </div>
        <button className="v-btn v-btn-primary" onClick={() => setAdding(a => !a)}>{adding ? 'Close' : '+ Add partner store'}</button>
      </div>
      {adding && (
        <form className="v-panel v-form" style={{ marginBottom: 16 }} onSubmit={add}>
          <h2 className="v-h3">New partner store</h2>
          <div className="v-grid v-grid-2">
            <label className="v-field"><span>Key (lowercase, e.g. racket-hub)</span><input className="v-input" required pattern="[a-z0-9-]+" value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} /></label>
            <label className="v-field"><span>Display name</span><input className="v-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          </div>
          <label className="v-field"><span>Products API URL</span><input className="v-input" type="url" required placeholder="https://partner.example/api/products" value={form.api_url} onChange={e => setForm({ ...form, api_url: e.target.value })} /></label>
          <div><button className="v-btn v-btn-primary">Add store</button></div>
        </form>
      )}
      <ErrorAlert error={error ?? actionError} />
      {loading ? <Spinner /> : (
        <div className="v-stack">
          {businesses?.map(b => (
            <div key={b.id} className="v-panel">
              <div className="v-between">
                <div><b>{b.name}</b> <span className="v-muted v-small">({b.key} · {b.kind === 'local' ? 'own catalogue' : 'partner API'})</span></div>
                <div className="v-row">
                  <StatusBadge status={b.status} />
                  <button className="v-btn v-btn-sm" onClick={() => update(b, { status: b.status === 'inactive' ? 'active' : 'inactive' }, b.status === 'inactive' ? 'Store activated' : 'Store deactivated')}>
                    {b.status === 'inactive' ? 'Activate' : 'Deactivate'}
                  </button>
                  {b.kind === 'partner' && (
                    <button
                      className="v-btn v-btn-sm v-btn-danger"
                      onClick={() => remove({ title: `Delete store “${b.name}”?`, message: 'Its products disappear from the shop. Past orders keep their records.', path: `/admin/businesses/${b.id}`, done: 'Store deleted', onDone: reload })}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              {b.kind === 'partner' && (
                <form className="v-row" style={{ marginTop: 12 }} onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); update(b, { name: String(fd.get('name')), api_url: String(fd.get('api_url')) }, 'Store updated'); }}>
                  <input className="v-input" style={{ width: 180 }} name="name" defaultValue={b.name} aria-label="Store name" />
                  <input className="v-input" style={{ flex: 1, minWidth: 220 }} name="api_url" defaultValue={b.api_url ?? ''} aria-label="API URL" />
                  <button className="v-btn v-btn-sm">Save</button>
                </form>
              )}
              <p className="v-small v-muted" style={{ marginTop: 10 }}>Last checked: {dateTime(b.last_checked_at)}</p>
              {b.recent_syncs.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {b.recent_syncs.map(s => <div key={s.id} className="v-row v-small"><StatusBadge status={s.status === 'success' ? 'online' : 'unavailable'} /><span className="v-muted">{dateTime(s.synced_at)}</span><span>{s.message}</span></div>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
