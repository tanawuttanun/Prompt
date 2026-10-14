import { Link } from 'react-router-dom';

import { ErrorAlert, Spinner, StatusBadge } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { baht, date } from '../../lib/format';

type DashboardData = {
  orders: number;
  revenue: number;
  customers: number;
  orders_by_status: Record<string, number>;
  claims: { total: number; open_claims: number; by_status: Record<string, number> };
  low_stock: Array<{ id: number; name: string; stock: number; status: string }>;
  recent_orders: Array<{ order_no: string; customer_name: string; total: number; status: string; created_at: string }>;
};

type Analytics = {
  days: number;
  total_revenue: number;
  total_orders: number;
  average_order: number;
  sales_by_day: Array<{ date: string; revenue: number; orders: number }>;
  by_business: Array<{ key: string; revenue: number; units: number }>;
  by_category: Array<{ key: string; revenue: number; units: number }>;
  top_products: Array<{ key: string; revenue: number; units: number }>;
};

export default function Dashboard() {
  const { data: d, error, loading } = useApi<DashboardData>('/admin/dashboard');
  if (loading) return <Spinner />;
  if (error || !d) return <ErrorAlert error={error} />;
  return (
    <>
      <h1 className="v-h1" style={{ marginBottom: 20 }}>Dashboard</h1>
      <div className="v-grid v-grid-4" style={{ marginBottom: 16 }}>
        <div className="v-stat"><span>Revenue</span><b>{baht(d.revenue)}</b></div>
        <div className="v-stat"><span>Orders</span><b>{d.orders}</b></div>
        <div className="v-stat"><span>Customers</span><b>{d.customers}</b></div>
        <div className="v-stat"><span>Open claims</span><b>{d.claims.open_claims}</b></div>
      </div>
      <div className="v-grid v-grid-2">
        <div className="v-panel">
          <h2 className="v-h3">Orders by status</h2>
          {Object.entries(d.orders_by_status).map(([s, n]) => <div key={s} className="v-total"><StatusBadge status={s} /><b>{n}</b></div>)}
        </div>
        <div className="v-panel">
          <h2 className="v-h3">Claims by status</h2>
          {Object.entries(d.claims.by_status).map(([s, n]) => <div key={s} className="v-total"><StatusBadge status={s} /><b>{n}</b></div>)}
          <Link className="v-link v-small" to="/admin/claims">Manage claims →</Link>
        </div>
        <div className="v-panel">
          <h2 className="v-h3">Recent orders</h2>
          {d.recent_orders.map(o => (
            <Link key={o.order_no} to={`/admin/orders/${o.order_no}`} className="v-line" style={{ textDecoration: 'none' }}>
              <div style={{ flex: 1 }}><b className="v-small">{o.order_no}</b><div className="v-muted v-small">{o.customer_name} · {date(o.created_at)}</div></div>
              <StatusBadge status={o.status} /><b className="v-small">{baht(o.total)}</b>
            </Link>
          ))}
        </div>
        <div className="v-panel">
          <h2 className="v-h3">Low stock ({d.low_stock.length})</h2>
          {d.low_stock.length === 0 ? <p className="v-muted v-small">All products are well stocked.</p> : d.low_stock.map(p => (
            <div key={p.id} className="v-total"><span>{p.name}</span><span className="v-row"><StatusBadge status={p.status} /><b>{p.stock}</b></span></div>
          ))}
          <Link className="v-link v-small" to="/admin/products">Manage products →</Link>
        </div>
      </div>
    </>
  );
}

function HBars({ rows }: { rows: Array<{ key: string; revenue: number; units: number }> }) {
  const max = Math.max(1, ...rows.map(r => r.revenue));
  if (!rows.length) return <p className="v-muted v-small">No sales in this period.</p>;
  return (
    <>
      {rows.map(r => (
        <div key={r.key} className="v-hbar">
          <span title={r.key} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.key}</span>
          <i style={{ width: `${(r.revenue / max) * 100}%` }} />
          <span style={{ textAlign: 'right' }}>{baht(r.revenue)}</span>
        </div>
      ))}
    </>
  );
}

export function AdminAnalytics() {
  const { data: a, error, loading } = useApi<Analytics>('/admin/analytics?days=30');
  if (loading) return <Spinner />;
  if (error || !a) return <ErrorAlert error={error} />;
  const max = Math.max(1, ...a.sales_by_day.map(d => d.revenue));
  return (
    <>
      <h1 className="v-h1" style={{ marginBottom: 20 }}>Analytics <span className="v-muted v-small">last {a.days} days</span></h1>
      <div className="v-grid v-grid-3" style={{ marginBottom: 16 }}>
        <div className="v-stat"><span>Revenue</span><b>{baht(a.total_revenue)}</b></div>
        <div className="v-stat"><span>Orders</span><b>{a.total_orders}</b></div>
        <div className="v-stat"><span>Average order</span><b>{baht(a.average_order)}</b></div>
      </div>
      <div className="v-panel">
        <h2 className="v-h3">Sales per day</h2>
        <div className="v-bars">
          {a.sales_by_day.map(d => <div key={d.date} style={{ height: `${(d.revenue / max) * 100}%` }} data-tip={`${date(d.date)}: ${baht(d.revenue)} (${d.orders})`} />)}
        </div>
      </div>
      <div className="v-grid v-grid-2" style={{ marginTop: 16 }}>
        <div className="v-panel"><h2 className="v-h3">By category</h2><HBars rows={a.by_category} /></div>
        <div className="v-panel"><h2 className="v-h3">By store</h2><HBars rows={a.by_business} /></div>
      </div>
      <div className="v-panel">
        <h2 className="v-h3">Top products</h2>
        <div className="v-table-wrap">
          <table className="v-table">
            <thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead>
            <tbody>{a.top_products.map(p => <tr key={p.key}><td>{p.key}</td><td>{p.units}</td><td>{baht(p.revenue)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
      <p className="v-small v-muted" style={{ marginTop: 10 }}>Cancelled orders are excluded. Data is kept in memory and resets on restart.</p>
    </>
  );
}
