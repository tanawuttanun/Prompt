import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { api } from '../../api/client';
import type { Order, OrderStatus } from '../../api/types';
import { Empty, ErrorAlert, Pager, Spinner, StatusBadge } from '../../components/ui';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { baht, dateTime, label } from '../../lib/format';
import { OrderItems, ShippingBlock } from '../Orders';

const STATUSES = ['all', 'pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled'];

export default function AdminOrders() {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ status, search, from, to, page: String(page), page_size: '15' });
  const { data: orders, pagination, error, loading } = useApi<Order[]>(`/admin/orders?${qs}`);

  return (
    <>
      <h1 className="v-h1" style={{ marginBottom: 16 }}>Orders</h1>
      <div className="v-row" style={{ marginBottom: 14 }}>
        <input className="v-input" style={{ maxWidth: 260 }} placeholder="Order no, name or email" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} aria-label="Search orders" />
        <select className="v-select" style={{ width: 150 }} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
          {STATUSES.map(s => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <input className="v-input" style={{ width: 160 }} type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} aria-label="From date" />
        <input className="v-input" style={{ width: 160 }} type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} aria-label="To date" />
      </div>
      <ErrorAlert error={error} />
      {loading ? <Spinner /> : orders?.length === 0 ? <Empty>No orders match.</Empty> : (
        <div className="v-panel v-table-wrap" style={{ padding: 0 }}>
          <table className="v-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Placed</th></tr></thead>
            <tbody>
              {orders?.map(o => (
                <tr key={o.order_no}>
                  <td><Link className="v-link" to={`/admin/orders/${o.order_no}`}>{o.order_no}</Link></td>
                  <td>{o.customer_name}<div className="v-muted v-small">{o.customer_email}</div></td>
                  <td>{o.item_count}</td>
                  <td>{baht(o.total)}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td className="v-small">{dateTime(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager pagination={pagination} onPage={setPage} />
    </>
  );
}

const SHIPPING_FIELDS: Array<{ name: keyof Order; label: string; wide?: boolean; optional?: boolean }> = [
  { name: 'customer_name', label: 'Full name' },
  { name: 'customer_email', label: 'Email' },
  { name: 'customer_phone', label: 'Phone' },
  { name: 'shipping_address_line1', label: 'Address', wide: true },
  { name: 'shipping_address_line2', label: 'Address line 2', wide: true, optional: true },
  { name: 'shipping_district', label: 'District / city' },
  { name: 'shipping_province', label: 'Province' },
  { name: 'shipping_postal_code', label: 'Postal code' },
  { name: 'shipping_country', label: 'Country' },
];

function ShippingModal({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: (o: Order) => void }) {
  const [form, setForm] = useState(() => Object.fromEntries(SHIPPING_FIELDS.map(f => [f.name, String(order[f.name] ?? '')])));
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.put<Order>(`/admin/orders/${order.order_no}`, form));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="v-modal-bg" onClick={onClose}>
      <form className="v-panel v-modal v-form" onClick={e => e.stopPropagation()} onSubmit={save}>
        <h2 className="v-h2">Edit shipping details</h2>
        <div className="v-grid v-grid-2">
          {SHIPPING_FIELDS.map(f => (
            <label key={f.name} className="v-field" style={f.wide ? { gridColumn: '1 / -1' } : undefined}>
              <span>{f.label}</span>
              <input className="v-input" required={!f.optional} value={form[f.name] ?? ''} onChange={e => setForm({ ...form, [f.name]: e.target.value })} />
            </label>
          ))}
        </div>
        <ErrorAlert error={error} />
        <div className="v-row"><button className="v-btn v-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="v-btn" onClick={onClose}>Cancel</button></div>
      </form>
    </div>
  );
}

const EDITABLE: OrderStatus[] = ['pending', 'confirmed', 'processing'];

export function AdminOrderDetail() {
  const { orderNo = '' } = useParams();
  const navigate = useNavigate();
  const { data: order, setData, error, loading } = useApi<Order>(`/admin/orders/${encodeURIComponent(orderNo)}`);
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  if (loading) return <Spinner />;
  if (error || !order) return <ErrorAlert error={error} />;

  const move = async (status: OrderStatus) => {
    if (status === 'cancelled' && !(await confirm({ title: 'Cancel this order?', message: 'Its items go back into stock.', confirmLabel: 'Cancel order', danger: true }))) return;
    setBusy(true);
    setActionError(null);
    try {
      setData(await api.patch<Order>(`/admin/orders/${order.order_no}/status`, { status }));
      toast(`Order marked ${label(status)}`, { detail: order.order_no, icon: '📦' });
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const restock = EDITABLE.includes(order.status);
    if (!(await confirm({ title: `Delete order ${order.order_no}?`, message: restock ? 'It has not shipped, so its items go back into stock. This cannot be undone.' : 'This cannot be undone.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await api.del(`/admin/orders/${order.order_no}`);
      toast('Order deleted', { detail: order.order_no, icon: '🗑' });
      navigate('/admin/orders');
    } catch (err) {
      setActionError(err);
    }
  };

  return (
    <>
      <p style={{ marginBottom: 12 }}><Link className="v-link" to="/admin/orders">← Orders</Link></p>
      <div className="v-page-head">
        <div><h1 className="v-h1">{order.order_no}</h1><p className="v-muted">Placed {dateTime(order.created_at)}</p></div>
        <div className="v-row">
          <StatusBadge status={order.status} />
          <button className="v-btn v-btn-sm v-btn-danger" onClick={remove}>Delete order</button>
        </div>
      </div>
      <div className="v-split">
        <div className="v-panel"><OrderItems order={order} /></div>
        <aside className="v-stack">
          <div className="v-panel">
            <h2 className="v-h3">Update status</h2>
            {order.allowed_transitions?.length ? (
              <div className="v-row">
                {order.allowed_transitions.map(s => (
                  <button key={s} className={`v-btn v-btn-sm ${s === 'cancelled' ? 'v-btn-danger' : 'v-btn-primary'}`} disabled={busy} onClick={() => move(s)}>
                    Mark {label(s)}
                  </button>
                ))}
              </div>
            ) : <p className="v-muted v-small">This order is {order.status}; no further changes.</p>}
            <ErrorAlert error={actionError} />
          </div>
          <div className="v-panel">
            <div className="v-between" style={{ marginBottom: 8 }}>
              <h2 className="v-h3" style={{ margin: 0 }}>Customer</h2>
              {EDITABLE.includes(order.status) && <button className="v-btn v-btn-sm" onClick={() => setEditing(true)}>Edit</button>}
            </div>
            <ShippingBlock order={order} />
          </div>
        </aside>
      </div>
      {editing && (
        <ShippingModal
          order={order}
          onClose={() => setEditing(false)}
          onSaved={o => {
            setData(o);
            setEditing(false);
            toast('Shipping details updated', { detail: o.order_no, icon: '✎' });
          }}
        />
      )}
    </>
  );
}
