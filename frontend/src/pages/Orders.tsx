import { Link, useLocation, useParams } from 'react-router-dom';

import type { Order } from '../api/types';
import { Empty, ErrorAlert, Spinner, StatusBadge } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { baht, date, dateTime } from '../lib/format';

export function OrderItems({ order }: { order: Order }) {
  return (
    <>
      {order.items.map(item => (
        <div key={item.id} className="v-line">
          {item.image_url ? <img className="v-thumb" src={item.image_url} alt="" /> : <div className="v-thumb" />}
          <div style={{ flex: 1 }}>
            <b>{item.product_name}</b>
            <div className="v-muted v-small">{item.business_name}{item.category ? ` · ${item.category}` : ''} · {baht(item.unit_price)} × {item.quantity}</div>
          </div>
          <b>{baht(item.line_total)}</b>
        </div>
      ))}
      <div className="v-divider" />
      <div className="v-total"><span>Subtotal</span><span>{baht(order.subtotal)}</span></div>
      <div className="v-total"><span>Shipping</span><span>{order.shipping_fee ? baht(order.shipping_fee) : 'Free'}</span></div>
      {order.discount > 0 && <div className="v-total"><span>Discount</span><span>−{baht(order.discount)}</span></div>}
      <div className="v-total v-grand"><span>Total</span><span>{baht(order.total)}</span></div>
    </>
  );
}

export function ShippingBlock({ order }: { order: Order }) {
  return (
    <dl className="v-kv">
      <dt>Name</dt><dd>{order.customer_name}</dd>
      <dt>Email</dt><dd>{order.customer_email}</dd>
      <dt>Phone</dt><dd>{order.customer_phone}</dd>
      <dt>Address</dt>
      <dd>
        {order.shipping_address_line1}{order.shipping_address_line2 ? `, ${order.shipping_address_line2}` : ''}<br />
        {order.shipping_district}, {order.shipping_province} {order.shipping_postal_code}<br />
        {order.shipping_country}
      </dd>
    </dl>
  );
}

export default function Orders() {
  const { data: orders, error, loading } = useApi<Order[]>('/orders');
  if (loading) return <Spinner />;
  return (
    <>
      <h1 className="v-h1" style={{ marginBottom: 20 }}>My orders</h1>
      <ErrorAlert error={error} />
      {orders?.length === 0 && <Empty>No orders yet. <Link className="v-link" to="/products">Start shopping</Link></Empty>}
      <div className="v-stack">
        {orders?.map(o => (
          <Link key={o.order_no} to={`/orders/${o.order_no}`} className="v-panel v-between" style={{ textDecoration: 'none' }}>
            <div className="v-row">
              {o.items.slice(0, 3).map(i => (i.image_url ? <img key={i.id} className="v-thumb v-thumb-sm" src={i.image_url} alt="" /> : null))}
              <div>
                <b>{o.order_no}</b>
                <div className="v-muted v-small">{date(o.created_at)} · {o.items.reduce((s, i) => s + i.quantity, 0)} item(s)</div>
              </div>
            </div>
            <div className="v-row"><StatusBadge status={o.status} /><b>{baht(o.total)}</b></div>
          </Link>
        ))}
      </div>
    </>
  );
}

export function OrderDetail() {
  const { orderNo = '' } = useParams();
  const location = useLocation();
  const { data: order, error, loading } = useApi<Order>(`/orders/${encodeURIComponent(orderNo)}`);
  if (loading) return <Spinner />;
  if (error || !order) return <ErrorAlert error={error} />;
  const justPlaced = (location.state as { justPlaced?: boolean } | null)?.justPlaced;

  return (
    <>
      {justPlaced && <div className="v-alert v-alert-ok" style={{ marginBottom: 16 }}>🎉 Thank you! Your order has been placed.</div>}
      <p style={{ marginBottom: 12 }}><Link className="v-link" to="/orders">← My orders</Link></p>
      <div className="v-page-head">
        <div>
          <h1 className="v-h1">{order.order_no}</h1>
          <p className="v-muted">Placed {dateTime(order.created_at)}{order.completed_at ? ` · completed ${date(order.completed_at)}` : ''}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="v-split">
        <div className="v-panel"><OrderItems order={order} /></div>
        <aside className="v-stack">
          <div className="v-panel"><h2 className="v-h3">Shipping</h2><ShippingBlock order={order} /></div>
          <div className="v-panel">
            <h2 className="v-h3">Claim / Warranty</h2>
            <div className="v-stack">
              <Link className="v-btn" to={`/orders/${order.order_no}/warranty`}>View claim / warranty document</Link>
              {order.claim_eligibility?.ok ? (
                <Link className="v-btn v-btn-primary" to={`/orders/${order.order_no}/claim`}>Submit a claim</Link>
              ) : (
                <p className="v-small v-muted">{order.claim_eligibility?.reason}</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
