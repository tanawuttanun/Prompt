import { db, nextId } from '../store/db.js';
import { ACTIVE_CLAIM_STATUSES, type Claim, type ClaimEvidence, type ClaimHistory, type ClaimItem, type ClaimStatus } from '../types/claim.js';
import { formatClaimNo, nowIso, utcDateKey } from '../utils/index.js';

const newestFirst = (a: Claim, b: Claim) => b.created_at.localeCompare(a.created_at) || b.id - a.id;

export const listClaims = () => [...db.claims].sort(newestFirst);
export const listClaimsByUser = (userId: number) => db.claims.filter(c => c.user_id === userId).sort(newestFirst);
export const findClaimByNo = (claimNo: string) => db.claims.find(c => c.claim_number === claimNo);
export const itemsForClaim = (claimId: number) => db.claimItems.filter(i => i.claim_id === claimId);
export const evidenceForClaim = (claimId: number) => db.claimEvidence.filter(e => e.claim_id === claimId);
export const historyForClaim = (claimId: number) => db.claimHistory.filter(h => h.claim_id === claimId);
export const claimsForOrder = (orderId: number) => db.claims.filter(c => c.order_id === orderId);

// Units of an order line reserved by active claims (rejected/cancelled release theirs).
export function claimedQuantity(orderItemId: number): number {
  return db.claimItems
    .filter(item => item.order_item_id === orderItemId)
    .filter(item => {
      const claim = db.claims.find(c => c.id === item.claim_id);
      return claim !== undefined && ACTIVE_CLAIM_STATUSES.includes(claim.status);
    })
    .reduce((sum, item) => sum + item.quantity, 0);
}

// Claim numbers come from a per-day sequence allocated inside the claim insert.
// Node runs this synchronously, so two submissions can never share a number.
function allocateClaimNumber(): string {
  const key = utcDateKey();
  const next = (db.claimSequences.get(key) ?? 0) + 1;
  db.claimSequences.set(key, next);
  return formatClaimNo(next);
}

export function insertClaim(
  claim: Omit<Claim, 'id' | 'claim_number' | 'created_at' | 'updated_at' | 'resolved_at' | 'admin_note' | 'status'>,
  items: Array<Omit<ClaimItem, 'id' | 'claim_id'>>,
  evidence: Array<Omit<ClaimEvidence, 'id' | 'claim_id' | 'created_at'>>,
  history: Pick<ClaimHistory, 'changed_by' | 'changed_by_role' | 'note'>,
): Claim {
  const now = nowIso();
  const stored: Claim = {
    ...claim,
    id: nextId('claims'),
    claim_number: allocateClaimNumber(),
    status: 'submitted',
    admin_note: null,
    created_at: now,
    updated_at: now,
    resolved_at: null,
  };
  db.claims.push(stored);
  db.claimItems.push(...items.map(item => ({ ...item, id: nextId('claimItems'), claim_id: stored.id })));
  db.claimEvidence.push(...evidence.map(e => ({ ...e, id: nextId('claimEvidence'), claim_id: stored.id, created_at: now })));
  db.claimHistory.push({ ...history, id: nextId('claimHistory'), claim_id: stored.id, previous_status: null, new_status: 'submitted', visibility: 'customer', created_at: now });
  return stored;
}

export function transitionClaim(
  claim: Claim,
  to: ClaimStatus,
  entry: Pick<ClaimHistory, 'changed_by' | 'changed_by_role' | 'note' | 'visibility'>,
  patch: Partial<Pick<Claim, 'admin_note' | 'resolved_at'>> = {},
) {
  const now = nowIso();
  db.claimHistory.push({ ...entry, id: nextId('claimHistory'), claim_id: claim.id, previous_status: claim.status, new_status: to, created_at: now });
  Object.assign(claim, patch, { status: to, updated_at: now });
}

// Removes a claim with its items, evidence rows and history; returns the stored
// evidence file names so the caller can delete the files too.
export function deleteClaim(claimId: number): string[] {
  const files = db.claimEvidence.filter(e => e.claim_id === claimId).map(e => e.file_name);
  const drop = <T extends { claim_id: number }>(list: T[]) => {
    for (let i = list.length - 1; i >= 0; i--) if (list[i]!.claim_id === claimId) list.splice(i, 1);
  };
  drop(db.claimItems);
  drop(db.claimEvidence);
  drop(db.claimHistory);
  const index = db.claims.findIndex(c => c.id === claimId);
  if (index >= 0) db.claims.splice(index, 1);
  return files;
}
