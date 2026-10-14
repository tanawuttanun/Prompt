import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { api } from '../api/client';
import type { ClaimableItem, ClaimDetail as ClaimDetailT, ClaimReason, ClaimStatus, ClaimSummary } from '../api/types';
import { Empty, ErrorAlert, Pager, Spinner, StatusBadge } from '../components/ui';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { useApi } from '../hooks/useApi';
import { baht, CLAIM_REASON_LABELS, date, dateTime, label } from '../lib/format';

const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const STATUSES: Array<ClaimStatus | 'all'> = ['all', 'submitted', 'under_review', 'approved', 'processing', 'completed', 'rejected', 'cancelled'];

// Evidence photos are fetched with the session cookie (they are not public files).
export function EvidenceGallery({ evidence }: { evidence: ClaimDetailT['evidence'] }) {
  return (
    <div className="v-row">
      {evidence.map(e => (
        <a key={e.id} href={e.image_url} target="_blank" rel="noreferrer">
          <img className="v-thumb" style={{ width: 96, height: 96 }} src={e.image_url} alt={`Evidence ${e.id}`} />
        </a>
      ))}
    </div>
  );
}

export function ClaimTimeline({ history }: { history: ClaimDetailT['history'] }) {
  return (
    <ul className="v-timeline">
      {history.map((h, i) => (
        <li key={i} className={h.visibility === 'internal' ? 'internal' : ''}>
          <div className="v-row"><b>{label(h.new_status)}</b><span className="v-muted v-small">{dateTime(h.created_at)} · by {h.changed_by_name ?? h.changed_by_role}</span>{h.visibility === 'internal' && <span className="v-badge v-badge-warn">internal</span>}</div>
          {h.note && <p className="v-small" style={{ marginTop: 4 }}>{h.note}</p>}
        </li>
      ))}
    </ul>
  );
}

export function ClaimForm() {
  const { orderNo = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, error: loadError, loading } = useApi<{ eligibility: { ok: boolean; reason?: string }; items: ClaimableItem[] }>(`/orders/${encodeURIComponent(orderNo)}/claimable-items`);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [reason, setReason] = useState<ClaimReason>('damaged');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [files]);

  if (loading) return <Spinner />;
  if (loadError || !data) return <ErrorAlert error={loadError} />;

  const selected = Object.entries(qty).filter(([, q]) => q > 0).map(([id, q]) => ({ order_item_id: Number(id), quantity: q }));

  const pickFiles = (list: FileList | null) => {
    setError(null);
    const picked = Array.from(list ?? []);
    const bad = picked.find(f => !TYPES.includes(f.type) || f.size > MAX_BYTES);
    if (bad) return setError(new Error(`${bad.name}: only JPEG, PNG or WEBP up to 5 MB`));
    setFiles(current => [...current, ...picked].slice(0, MAX_FILES));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected.length) return setError(new Error('Select at least one product and quantity'));
    if (!files.length) return setError(new Error('Attach at least one photo'));
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set('order_no', orderNo);
    form.set('reason', reason);
    form.set('description', description);
    if (phone) form.set('contact_phone', phone);
    form.set('items', JSON.stringify(selected));
    files.forEach(f => form.append('evidence', f));
    try {
      const claim = await api.upload<ClaimDetailT>('/claims', form);
      toast('Claim submitted', { detail: `${claim.claim_number} — we will review it shortly`, icon: '📋', duration: 4500 });
      navigate(`/claims/${claim.claim_number}`, { state: { justSubmitted: true } });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p style={{ marginBottom: 12 }}><Link className="v-link" to={`/orders/${orderNo}`}>← Back to order</Link></p>
      <h1 className="v-h1">Submit a claim</h1>
      <p className="v-muted" style={{ marginBottom: 20 }}>Order {orderNo}</p>
      {!data.eligibility.ok ? <div className="v-alert v-alert-warn">{data.eligibility.reason}</div> : data.items.length === 0 ? (
        <div className="v-alert v-alert-info">Every item on this order is already covered by a claim.</div>
      ) : (
        <form className="v-split" onSubmit={submit}>
          <div className="v-stack">
            <div className="v-panel">
              <h2 className="v-h3">1. Which products?</h2>
              {data.items.map(item => (
                <div key={item.id} className="v-line">
                  {item.image_url ? <img className="v-thumb v-thumb-sm" src={item.image_url} alt="" /> : <div className="v-thumb v-thumb-sm" />}
                  <div style={{ flex: 1 }}>
                    <b>{item.product_name}</b>
                    <div className="v-muted v-small">Bought {item.quantity} · {item.claimable_quantity} can be claimed · {baht(item.unit_price)} each</div>
                  </div>
                  <select className="v-select" style={{ width: 90 }} value={qty[item.id] ?? 0} onChange={e => setQty({ ...qty, [item.id]: Number(e.target.value) })} aria-label={`Quantity of ${item.product_name}`}>
                    {Array.from({ length: item.claimable_quantity + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="v-panel v-form">
              <h2 className="v-h3">2. What happened?</h2>
              <label className="v-field"><span>Reason</span>
                <select className="v-select" value={reason} onChange={e => setReason(e.target.value as ClaimReason)}>
                  {Object.entries(CLAIM_REASON_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </select>
              </label>
              <label className="v-field"><span>Description ({description.length}/2000)</span>
                <textarea className="v-textarea" required maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the problem…" />
              </label>
              <label className="v-field"><span>Contact phone (optional)</span><input className="v-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>
            </div>
          </div>
          <aside className="v-panel v-stack">
            <h2 className="v-h3">3. Photos ({files.length}/{MAX_FILES})</h2>
            <p className="v-small v-muted">At least one photo. JPEG, PNG or WEBP, up to 5 MB each.</p>
            <label className="v-btn" aria-disabled={files.length >= MAX_FILES} style={files.length >= MAX_FILES ? { opacity: 0.45, pointerEvents: 'none' } : undefined}>
              📷 Add photos
              <input type="file" hidden accept={TYPES.join(',')} multiple disabled={files.length >= MAX_FILES} onChange={e => { pickFiles(e.target.files); e.target.value = ''; }} />
            </label>
            <div className="v-row">
              {previews.map((src, i) => (
                <div key={src} style={{ position: 'relative' }}>
                  <img className="v-thumb" src={src} alt={`Photo ${i + 1}`} />
                  <button type="button" className="v-icon-btn" style={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24 }} aria-label="Remove photo" onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
            </div>
            <ErrorAlert error={error} />
            <button className="v-btn v-btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit claim'}</button>
          </aside>
        </form>
      )}
    </>
  );
}

export default function Claims() {
  const [status, setStatus] = useState<ClaimStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const { data: claims, pagination, error, loading } = useApi<ClaimSummary[]>(`/claims?status=${status}&page=${page}&page_size=10`);
  return (
    <>
      <h1 className="v-h1" style={{ marginBottom: 16 }}>My claims</h1>
      <div className="v-tabs">
        {STATUSES.map(s => <button key={s} className={s === status ? 'active' : ''} onClick={() => { setStatus(s); setPage(1); }}>{label(s)}</button>)}
      </div>
      <ErrorAlert error={error} />
      {loading ? <Spinner /> : claims?.length === 0 ? <Empty>No claims {status !== 'all' ? `with status “${label(status)}”` : 'yet'}. Claims are raised from <Link className="v-link" to="/orders">an order</Link>.</Empty> : (
        <div className="v-stack">
          {claims?.map(c => (
            <Link key={c.claim_number} to={`/claims/${c.claim_number}`} className="v-panel v-between" style={{ textDecoration: 'none' }}>
              <div>
                <b>{c.claim_number}</b>
                <div className="v-muted v-small">Order {c.order_no} · {CLAIM_REASON_LABELS[c.reason]} · {c.item_count} item(s) · {date(c.created_at)}</div>
              </div>
              <StatusBadge status={c.status} />
            </Link>
          ))}
        </div>
      )}
      <Pager pagination={pagination} onPage={setPage} />
    </>
  );
}

export function ClaimDetail() {
  const { claimNo = '' } = useParams();
  const { data: claim, setData, error, loading } = useApi<ClaimDetailT>(`/claims/${encodeURIComponent(claimNo)}`);
  const [cancelError, setCancelError] = useState<unknown>(null);
  const toast = useToast();
  const confirm = useConfirm();
  if (loading) return <Spinner />;
  if (error || !claim) return <ErrorAlert error={error} />;
  const cancellable = claim.status === 'submitted' || claim.status === 'under_review';

  return (
    <>
      <p style={{ marginBottom: 12 }}><Link className="v-link" to="/claims">← My claims</Link></p>
      <div className="v-page-head">
        <div>
          <h1 className="v-h1">{claim.claim_number}</h1>
          <p className="v-muted">Order <Link className="v-link" to={`/orders/${claim.order_no}`}>{claim.order_no}</Link> · submitted {dateTime(claim.created_at)}</p>
        </div>
        <StatusBadge status={claim.status} />
      </div>
      {claim.admin_note && <div className="v-alert v-alert-info" style={{ marginBottom: 16 }}><b>Message from support:</b> {claim.admin_note}</div>}
      <div className="v-split">
        <div className="v-stack">
          <div className="v-panel">
            <h2 className="v-h3">{CLAIM_REASON_LABELS[claim.reason]}</h2>
            <p style={{ whiteSpace: 'pre-wrap' }}>{claim.description}</p>
            {claim.contact_phone && <p className="v-small v-muted" style={{ marginTop: 8 }}>Contact: {claim.contact_phone}</p>}
          </div>
          <div className="v-panel">
            <h2 className="v-h3">Products</h2>
            {claim.items.map(i => (
              <div key={i.order_item_id} className="v-line">
                {i.image_url ? <img className="v-thumb v-thumb-sm" src={i.image_url} alt="" /> : <div className="v-thumb v-thumb-sm" />}
                <div style={{ flex: 1 }}><b>{i.product_name}</b><div className="v-muted v-small">{i.business_name} · {baht(i.unit_price)} × {i.quantity}</div></div>
              </div>
            ))}
          </div>
          <div className="v-panel"><h2 className="v-h3">Photos</h2><EvidenceGallery evidence={claim.evidence} /></div>
        </div>
        <aside className="v-stack">
          <div className="v-panel"><h2 className="v-h3">Status timeline</h2><ClaimTimeline history={claim.history} /></div>
          {cancellable && (
            <div className="v-panel">
              <ErrorAlert error={cancelError} />
              <button
                className="v-btn v-btn-danger v-btn-block"
                onClick={async () => {
                  if (!(await confirm({ title: 'Cancel this claim?', message: 'You can submit a new claim for these items afterwards.', confirmLabel: 'Cancel claim', danger: true }))) return;
                  try {
                    setData(await api.post<ClaimDetailT>(`/claims/${claim.claim_number}/cancel`, {}));
                    toast('Claim cancelled', { icon: '✔' });
                  } catch (err) {
                    setCancelError(err);
                  }
                }}
              >
                Cancel claim
              </button>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
