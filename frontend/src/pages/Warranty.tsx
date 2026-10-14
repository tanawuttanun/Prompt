import { Link, useParams } from 'react-router-dom';

import type { Order } from '../api/types';
import { ErrorAlert, Spinner, StatusBadge } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { date, dateTime } from '../lib/format';
import { OrderItems, ShippingBlock } from './Orders';

type WarrantyDoc = {
  store: { name: string; support_email: string };
  order: Order;
  claim_window_days: number;
  claim_deadline: string | null;
  eligibility: { ok: boolean; reason?: string };
  claims: Array<{ claim_number: string; status: string; created_at: string }>;
  generated_at: string;
};

// Printable document built by the server from the stored order snapshot.
export default function Warranty() {
  const { orderNo = '' } = useParams();
  const { data: doc, error, loading } = useApi<WarrantyDoc>(`/orders/${encodeURIComponent(orderNo)}/warranty-document`);
  if (loading) return <Spinner />;
  if (error || !doc) return <ErrorAlert error={error} />;

  return (
    <>
      <div className="v-between v-no-print" style={{ marginBottom: 16 }}>
        <Link className="v-link" to={`/orders/${orderNo}`}>← Back to order</Link>
        <button className="v-btn v-btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
      <article className="v-panel">
        <div className="v-between">
          <div>
            <h1 className="v-h1">Claim &amp; Warranty Document</h1>
            <p className="v-muted">{doc.store.name} · {doc.store.support_email}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <b>{doc.order.order_no}</b>
            <div className="v-muted v-small">Ordered {date(doc.order.created_at)}</div>
            <StatusBadge status={doc.order.status} />
          </div>
        </div>
        <div className="v-divider" />
        <div className="v-grid v-grid-2">
          <div><h2 className="v-h3">Customer</h2><ShippingBlock order={doc.order} /></div>
          <div>
            <h2 className="v-h3">Warranty terms</h2>
            <dl className="v-kv">
              <dt>Claim window</dt><dd>{doc.claim_window_days === 0 ? 'No deadline' : `${doc.claim_window_days} days`}</dd>
              <dt>Claim by</dt><dd>{doc.claim_deadline ? date(doc.claim_deadline) : '—'}</dd>
              <dt>Status</dt><dd>{doc.eligibility.ok ? 'Eligible for claims' : doc.eligibility.reason}</dd>
            </dl>
          </div>
        </div>
        <div className="v-divider" />
        <h2 className="v-h3">Items (prices as purchased)</h2>
        <OrderItems order={doc.order} />
        {doc.claims.length > 0 && (
          <>
            <div className="v-divider" />
            <h2 className="v-h3">Claims on this order</h2>
            {doc.claims.map(c => <div key={c.claim_number} className="v-row v-small"><b>{c.claim_number}</b><StatusBadge status={c.status} /><span className="v-muted">{date(c.created_at)}</span></div>)}
          </>
        )}
        <p className="v-small v-muted" style={{ marginTop: 18 }}>Generated {dateTime(doc.generated_at)}. Keep this document as proof of purchase.</p>
      </article>
    </>
  );
}
