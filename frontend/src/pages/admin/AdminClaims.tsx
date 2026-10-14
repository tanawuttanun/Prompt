import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { api } from '../../api/client';
import type { ClaimDetail, ClaimStatus, ClaimSummary } from '../../api/types';
import { Empty, ErrorAlert, Pager, Spinner, StatusBadge } from '../../components/ui';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { baht, CLAIM_REASON_LABELS, dateTime, label } from '../../lib/format';
import { ClaimTimeline, EvidenceGallery } from '../Claims';

const STATUSES = ['all', 'submitted', 'under_review', 'approved', 'processing', 'completed', 'rejected', 'cancelled'];

export default function AdminClaims() {
  const [filters, setFilters] = useState({ status: 'all', business: 'all', search: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const { data: options } = useApi<{ businesses: Array<{ key: string; name: string }> }>('/admin/product-options');
  const qs = new URLSearchParams({ ...filters, page: String(page), page_size: '15' });
  const { data: claims, pagination, error, loading } = useApi<ClaimSummary[]>(`/admin/claims?${qs}`);
  const set = (k: keyof typeof filters, v: string) => {
    setFilters({ ...filters, [k]: v });
    setPage(1);
  };

  return (
    <>
      <h1 className="v-h1" style={{ marginBottom: 16 }}>Claims</h1>
      <div className="v-row" style={{ marginBottom: 14 }}>
        <input className="v-input" style={{ maxWidth: 240 }} placeholder="Claim/order no, name, email" value={filters.search} onChange={e => set('search', e.target.value)} aria-label="Search claims" />
        <select className="v-select" style={{ width: 150 }} value={filters.status} onChange={e => set('status', e.target.value)} aria-label="Status">
          {STATUSES.map(s => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select className="v-select" style={{ width: 160 }} value={filters.business} onChange={e => set('business', e.target.value)} aria-label="Store">
          <option value="all">All stores</option>
          {options?.businesses.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
        </select>
        <input className="v-input" style={{ width: 160 }} type="date" value={filters.from} onChange={e => set('from', e.target.value)} aria-label="From date" />
        <input className="v-input" style={{ width: 160 }} type="date" value={filters.to} onChange={e => set('to', e.target.value)} aria-label="To date" />
      </div>
      <ErrorAlert error={error} />
      {loading ? <Spinner /> : claims?.length === 0 ? <Empty>No claims match.</Empty> : (
        <div className="v-panel v-table-wrap" style={{ padding: 0 }}>
          <table className="v-table">
            <thead><tr><th>Claim</th><th>Order</th><th>Customer</th><th>Reason</th><th>Status</th><th>Submitted</th></tr></thead>
            <tbody>
              {claims?.map(c => (
                <tr key={c.claim_number}>
                  <td><Link className="v-link" to={`/admin/claims/${c.claim_number}`}>{c.claim_number}</Link></td>
                  <td className="v-small">{c.order_no}</td>
                  <td>{c.customer_name}</td>
                  <td className="v-small">{CLAIM_REASON_LABELS[c.reason]}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="v-small">{dateTime(c.created_at)}</td>
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

export function AdminClaimDetail() {
  const { claimNo = '' } = useParams();
  const { data: claim, setData, error, loading } = useApi<ClaimDetail>(`/admin/claims/${encodeURIComponent(claimNo)}`);
  const [to, setTo] = useState<ClaimStatus | ''>('');
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<'customer' | 'internal'>('customer');
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  if (loading) return <Spinner />;
  if (error || !claim) return <ErrorAlert error={error} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!to) return;
    setBusy(true);
    setActionError(null);
    try {
      setData(await api.patch<ClaimDetail>(`/admin/claims/${claim.claim_number}/status`, { status: to, note: note || undefined, note_visibility: visibility }));
      toast(`Claim moved to ${label(to)}`, { detail: claim.claim_number, icon: '📋' });
      setTo('');
      setNote('');
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p style={{ marginBottom: 12 }}><Link className="v-link" to="/admin/claims">← Claims</Link></p>
      <div className="v-page-head">
        <div>
          <h1 className="v-h1">{claim.claim_number}</h1>
          <p className="v-muted">Order <Link className="v-link" to={`/admin/orders/${claim.order_no}`}>{claim.order_no}</Link> · {dateTime(claim.created_at)}</p>
        </div>
        <div className="v-row">
          <StatusBadge status={claim.status} />
          {['rejected', 'completed', 'cancelled'].includes(claim.status) && (
            <button
              className="v-btn v-btn-sm v-btn-danger"
              onClick={async () => {
                if (!(await confirm({ title: `Delete claim ${claim.claim_number}?`, message: 'Its photos and history are removed. This cannot be undone.', confirmLabel: 'Delete', danger: true }))) return;
                try {
                  await api.del(`/admin/claims/${claim.claim_number}`);
                  toast('Claim deleted', { detail: claim.claim_number, icon: '🗑' });
                  navigate('/admin/claims');
                } catch (err) {
                  setActionError(err);
                }
              }}
            >
              Delete claim
            </button>
          )}
        </div>
      </div>
      <div className="v-split">
        <div className="v-stack">
          <div className="v-panel">
            <h2 className="v-h3">{CLAIM_REASON_LABELS[claim.reason]}</h2>
            <p style={{ whiteSpace: 'pre-wrap' }}>{claim.description}</p>
            {claim.admin_note && <div className="v-alert v-alert-info" style={{ marginTop: 12 }}>Customer sees: {claim.admin_note}</div>}
          </div>
          <div className="v-panel">
            <h2 className="v-h3">Products</h2>
            {claim.items.map(i => (
              <div key={i.order_item_id} className="v-line">
                <div style={{ flex: 1 }}><b>{i.product_name}</b><div className="v-muted v-small">{i.business_name} · {baht(i.unit_price)} × {i.quantity}</div></div>
                <b>{baht(i.line_total)}</b>
              </div>
            ))}
          </div>
          <div className="v-panel"><h2 className="v-h3">Evidence</h2><EvidenceGallery evidence={claim.evidence} /></div>
          <div className="v-panel"><h2 className="v-h3">Full history</h2><ClaimTimeline history={claim.history} /></div>
        </div>
        <aside className="v-stack">
          <form className="v-panel v-form" onSubmit={submit}>
            <h2 className="v-h3">Change status</h2>
            {claim.allowed_transitions?.length ? (
              <>
                <select className="v-select" value={to} onChange={e => setTo(e.target.value as ClaimStatus)} required aria-label="New status">
                  <option value="">Choose…</option>
                  {claim.allowed_transitions.map(s => <option key={s} value={s}>{label(s)}</option>)}
                </select>
                <textarea className="v-textarea" maxLength={1000} placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} />
                <label className="v-check"><input type="radio" checked={visibility === 'customer'} onChange={() => setVisibility('customer')} /> Visible to customer</label>
                <label className="v-check"><input type="radio" checked={visibility === 'internal'} onChange={() => setVisibility('internal')} /> Internal only</label>
                <ErrorAlert error={actionError} />
                <button className="v-btn v-btn-primary" disabled={busy || !to}>{busy ? 'Saving…' : 'Update claim'}</button>
              </>
            ) : <p className="v-muted v-small">This claim is {label(claim.status)} and cannot change.</p>}
          </form>
          {claim.customer && (
            <div className="v-panel">
              <h2 className="v-h3">Customer</h2>
              <dl className="v-kv"><dt>Name</dt><dd>{claim.customer.name}</dd><dt>Email</dt><dd>{claim.customer.email}</dd><dt>Phone</dt><dd>{claim.contact_phone ?? claim.customer.phone ?? '—'}</dd></dl>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
