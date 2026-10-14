// Every AI component hides itself silently on any error (no key, quota, outage):
// the storefront must never break because the AI is unavailable.
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { api } from '../api/client';
import type { Product } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { ProductCard } from './ProductCard';

// Asked once per page load whether the server has an AI key configured.
let aiProbe: Promise<boolean> | null = null;
function probeAi() {
  aiProbe ??= api
    .get<{ configured: boolean }>('/ai/status')
    .then(s => s.configured)
    .catch(() => false);
  return aiProbe;
}

export function useAiAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let alive = true;
    probeAi().then(ok => alive && setAvailable(ok));
    return () => {
      alive = false;
    };
  }, []);
  return available;
}

export function AiSearchBar({ onResults }: { onResults: (products: Product[] | null, query: string) => void }) {
  const available = useAiAvailable();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (hidden || !available) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    try {
      const result = await api.post<{ products: Product[] }>('/ai/search', { query });
      onResults(result.products, query);
    } catch {
      setHidden(true);
      onResults(null, '');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="v-ai-bar" onSubmit={submit}>
      <input className="v-input" value={query} onChange={e => setQuery(e.target.value)} placeholder='✨ Ask AI: "running shoes under 3000 in stock"' aria-label="AI search" />
      <button className="v-btn" disabled={busy}>{busy ? 'Searching…' : 'AI search'}</button>
    </form>
  );
}

export function AiDescription({ product }: { product: Product }) {
  const available = useAiAvailable();
  const [text, setText] = useState<string | null>(null);
  const needsAi = (product.description ?? '').trim().length < 30;

  useEffect(() => {
    setText(null);
    if (!needsAi || !available) return;
    let alive = true;
    api
      .post<{ description: string; ai_generated: boolean }>('/ai/describe', { business: product.business, product_id: product.id })
      .then(r => alive && r.ai_generated && setText(r.description))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [product.business, product.id, needsAi, available]);

  if (!needsAi || !text) return null;
  return (
    <div className="v-panel" style={{ padding: 14 }}>
      <div className="v-ai-label">AI-generated description</div>
      <p style={{ marginTop: 6 }}>{text}</p>
    </div>
  );
}

export function RelatedProducts({ product }: { product: Product }) {
  const available = useAiAvailable();
  const [items, setItems] = useState<Product[] | null>(null);

  useEffect(() => {
    setItems(null);
    if (!available) return;
    let alive = true;
    api
      .get<Product[]>(`/ai/recommend/${encodeURIComponent(product.id)}?business=${encodeURIComponent(product.business)}`)
      .then(r => alive && setItems(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [product.business, product.id, available]);

  if (!items?.length) return null;
  return (
    <section style={{ marginTop: 40 }}>
      <h2 className="v-h2">You may also like <span className="v-ai-label">· picked by AI</span></h2>
      <div className="v-products">{items.map(p => <ProductCard key={`${p.business}:${p.id}`} product={p} />)}</div>
    </section>
  );
}

type Msg = { role: 'user' | 'assistant'; text: string };

export function AiChatWidget() {
  const { user } = useAuth();
  const probed = useAiAvailable();
  const [failed, setFailed] = useState(false);
  const available = probed && !failed;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', text: 'สวัสดีครับ! ยินดีต้อนรับสู่ Delux Sport Club ผมคือผู้ช่วยส่วนตัวของคุณ ถามเรื่องอุปกรณ์กีฬาหรือคำสั่งซื้อได้เลยครับ' },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, open]);

  if (!available) return null;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const next = [...messages, { role: 'user' as const, text }];
    setMessages(next);
    setDraft('');
    setBusy(true);
    try {
      const { reply } = await api.post<{ reply: string }>('/ai/chat', { messages: next.slice(1) });
      setMessages(m => [...m, { role: 'assistant', text: reply }]);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div className="v-chat" role="dialog" aria-label="Shopping assistant">
          <div className="v-chat-head">
            <div>
              <b className="gold-text">Delux Concierge</b>
              <div className="v-muted v-small">{user ? `Signed in as ${user.name}` : 'Sign in to ask about your orders'}</div>
            </div>
            <button className="v-icon-btn" aria-label="Close chat" onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="v-chat-log" ref={logRef}>
            {messages.map((m, i) => <div key={i} className={`v-msg ${m.role}`}>{m.text}</div>)}
            {busy && <div className="v-msg assistant v-muted">…</div>}
          </div>
          <form onSubmit={send}>
            <input className="v-input" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Type a message…" aria-label="Message" />
            <button className="v-btn v-btn-primary" disabled={busy || !draft.trim()}>Send</button>
          </form>
        </div>
      )}
      <button className="v-chat-fab" aria-label={open ? 'Close assistant' : 'Open shopping assistant'} onClick={() => setOpen(o => !o)}>💬</button>
    </>
  );
}
