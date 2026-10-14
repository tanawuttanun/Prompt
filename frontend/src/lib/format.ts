export const baht = (n: number) => `฿${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const label = (status: string) => status.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

export const CLAIM_REASON_LABELS: Record<string, string> = {
  damaged: 'Arrived damaged',
  defective: 'Defective / not working',
  wrong_item: 'Wrong item sent',
  missing_parts: 'Missing parts',
  other: 'Other',
};
