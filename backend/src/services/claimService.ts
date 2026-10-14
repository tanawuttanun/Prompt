import { badRequest, conflict, notFound } from '../errors/apiError.js';
import { deleteStoredFile, storeImage } from '../middleware/upload.js';
import {
  claimedQuantity, evidenceForClaim, findClaimByNo, historyForClaim, insertClaim, itemsForClaim, listClaims, listClaimsByUser, transitionClaim,
} from '../repositories/claimRepository.js';
import { findOrderById, findOrderByNo, findOrderItem, itemsForOrder } from '../repositories/orderRepository.js';
import { findUserById } from '../repositories/userRepository.js';
import {
  CLAIM_NO_PATTERN, CLAIM_REASONS, CLAIM_STATUSES, CUSTOMER_CANCELLABLE, TERMINAL_CLAIM_STATUSES, canTransition,
  type Claim, type ClaimReason, type ClaimStatus,
} from '../types/claim.js';
import { ORDER_NO_PATTERN } from '../types/order.js';
import type { User } from '../types/user.js';
import { lineTotal, nowIso, optionalString, paginate, pageParams, queryString } from '../utils/index.js';
import { claimEligibility } from './orderService.js';

// ---------- serializers ----------
const evidenceUrl = (claim: Claim, id: number) => `/api/claims/${claim.claim_number}/evidence/${id}`;

function baseClaim(claim: Claim) {
  const order = findOrderById(claim.order_id);
  const items = itemsForClaim(claim.id).map(item => ({
    order_item_id: item.order_item_id,
    quantity: item.quantity,
    product_id: item.product_id,
    product_name: item.product_name,
    business: item.business,
    business_name: item.business_name,
    unit_price: item.unit_price,
    line_total: lineTotal(item.unit_price, item.quantity),
    image_url: findOrderItem(item.order_item_id)?.image_url ?? null,
  }));
  return {
    claim_number: claim.claim_number,
    order_no: order?.order_no ?? null,
    status: claim.status,
    reason: claim.reason,
    description: claim.description,
    contact_phone: claim.contact_phone,
    admin_note: claim.admin_note,
    items,
    evidence: evidenceForClaim(claim.id).map(e => ({
      id: e.id, image_url: evidenceUrl(claim, e.id), mime_type: e.mime_type, file_size: e.file_size, created_at: e.created_at,
    })),
    created_at: claim.created_at,
    updated_at: claim.updated_at,
    resolved_at: claim.resolved_at,
  };
}

// Customer view: customer-visible history only, no changed_by ids, no visibility field.
export function customerClaimView(claim: Claim) {
  return {
    ...baseClaim(claim),
    history: historyForClaim(claim.id)
      .filter(h => h.visibility === 'customer')
      .map(h => ({ previous_status: h.previous_status, new_status: h.new_status, changed_by_role: h.changed_by_role, note: h.note, created_at: h.created_at })),
  };
}

export function adminClaimView(claim: Claim) {
  const order = findOrderById(claim.order_id);
  const customer = findUserById(claim.user_id);
  return {
    ...baseClaim(claim),
    allowed_transitions: CLAIM_STATUSES.filter(s => canTransition(claim.status, s)),
    customer: customer ? { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone } : null,
    order: order ? { order_no: order.order_no, status: order.status, total: order.total, created_at: order.created_at, completed_at: order.completed_at } : null,
    history: historyForClaim(claim.id).map(h => {
      const actor = h.changed_by ? findUserById(h.changed_by) : undefined;
      return { ...h, changed_by_name: actor?.name ?? null };
    }),
  };
}

const summary = (claim: Claim) => {
  const view = baseClaim(claim);
  return {
    claim_number: view.claim_number, order_no: view.order_no, status: view.status, reason: view.reason,
    item_count: view.items.reduce((s, i) => s + i.quantity, 0), businesses: [...new Set(view.items.map(i => i.business_name))],
    created_at: view.created_at, updated_at: view.updated_at,
  };
};

// ---------- customer ----------
function parseClaimItems(raw: unknown) {
  let parsed: unknown;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw badRequest('INVALID_CLAIM_ITEMS', 'The selected products could not be read');
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 20) throw badRequest('INVALID_CLAIM_ITEMS', 'Select 1 to 20 products to claim');
  const seen = new Set<number>();
  return parsed.map(entry => {
    const e = (entry ?? {}) as Record<string, unknown>;
    const orderItemId = Number(e.order_item_id);
    const quantity = Number(e.quantity);
    if (!Number.isInteger(orderItemId) || orderItemId <= 0) throw badRequest('INVALID_CLAIM_ITEMS', 'A selected product is invalid');
    if (!Number.isInteger(quantity) || quantity <= 0) throw badRequest('INVALID_CLAIM_QUANTITY', 'Quantities must be positive whole numbers');
    if (seen.has(orderItemId)) throw badRequest('DUPLICATE_CLAIM_ITEM', 'The same product was selected twice');
    seen.add(orderItemId);
    return { order_item_id: orderItemId, quantity };
  });
}

export function submitClaim(user: User, body: Record<string, unknown>, files: Express.Multer.File[]) {
  const orderNo = typeof body.order_no === 'string' ? body.order_no.trim() : '';
  if (!ORDER_NO_PATTERN.test(orderNo)) throw badRequest('INVALID_ORDER_NUMBER', 'The order number is malformed');
  const reason = body.reason as ClaimReason;
  if (!CLAIM_REASONS.includes(reason)) throw badRequest('INVALID_CLAIM_REASON', 'Choose a valid reason');
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (!description || description.length > 2000) throw badRequest('INVALID_DESCRIPTION', 'Describe the problem in 2000 characters or fewer');
  const contactPhone = optionalString(body.contact_phone, 'contact_phone', 40);
  const items = parseClaimItems(body.items);
  if (files.length === 0) throw badRequest('EVIDENCE_REQUIRED', 'Attach at least one photo');

  const order = findOrderByNo(orderNo);
  if (!order || order.user_id !== user.id) throw notFound('ORDER_NOT_FOUND', 'Order not found');
  const eligibility = claimEligibility(order);
  if (!eligibility.ok) throw conflict('ORDER_NOT_CLAIMABLE', eligibility.reason ?? 'This order cannot be claimed');

  const orderItems = itemsForOrder(order.id);
  const lines = items.map(entry => {
    const item = orderItems.find(i => i.id === entry.order_item_id);
    if (!item) throw notFound('ORDER_ITEM_NOT_FOUND', 'A selected product is not on this order');
    const remaining = item.quantity - claimedQuantity(item.id);
    if (remaining <= 0) throw conflict('ORDER_NOT_CLAIMABLE', `${item.product_name} has already been fully claimed`);
    if (entry.quantity > remaining) throw conflict('CLAIM_QUANTITY_EXCEEDED', `Only ${remaining} of ${item.product_name} can still be claimed`);
    return { item, quantity: entry.quantity };
  });

  // validate every photo before keeping any of them
  const stored: Array<ReturnType<typeof storeImage>> = [];
  try {
    for (const file of files) stored.push(storeImage(file, 'claims'));
  } catch (error) {
    stored.forEach(s => deleteStoredFile(s.name));
    throw error;
  }

  const claim = insertClaim(
    { order_id: order.id, user_id: user.id, reason, description, contact_phone: contactPhone },
    lines.map(({ item, quantity }) => ({
      order_item_id: item.id, quantity, product_id: item.product_id, product_name: item.product_name,
      business: item.business, business_name: item.business_name, unit_price: item.unit_price,
    })),
    stored.map(s => ({ file_name: s.name, mime_type: s.mime, file_size: s.size })),
    { changed_by: user.id, changed_by_role: 'customer', note: 'Claim submitted.' },
  );
  return customerClaimView(claim);
}

function ownClaim(user: User, claimNo: string) {
  if (!CLAIM_NO_PATTERN.test(claimNo)) throw badRequest('INVALID_CLAIM_NUMBER', 'The claim number is malformed');
  const claim = findClaimByNo(claimNo);
  if (!claim || claim.user_id !== user.id) throw notFound('CLAIM_NOT_FOUND', 'Claim not found');
  return claim;
}

export function listMyClaims(user: User, query: Record<string, unknown>) {
  const status = queryString(query.status);
  if (status && status !== 'all' && !CLAIM_STATUSES.includes(status as ClaimStatus)) throw badRequest('INVALID_CLAIM_STATUS', 'Unknown claim status');
  const { page, pageSize } = pageParams(query);
  const claims = listClaimsByUser(user.id).filter(c => !status || status === 'all' || c.status === status);
  const { items, pagination } = paginate(claims, page, pageSize);
  return { items: items.map(summary), pagination };
}

export const getMyClaim = (user: User, claimNo: string) => customerClaimView(ownClaim(user, claimNo));

export function cancelMyClaim(user: User, claimNo: string, note: unknown) {
  const claim = ownClaim(user, claimNo);
  if (!CUSTOMER_CANCELLABLE.includes(claim.status)) throw conflict('CLAIM_NOT_CANCELLABLE', 'This claim can no longer be cancelled');
  const text = optionalString(note, 'note', 1000);
  transitionClaim(claim, 'cancelled', { changed_by: user.id, changed_by_role: 'customer', note: text ?? 'Cancelled by customer.', visibility: 'customer' }, { resolved_at: nowIso() });
  return customerClaimView(claim);
}

// Evidence is never served statically: owner or admin only.
export function evidenceFile(user: User, claimNo: string, evidenceId: number) {
  if (!CLAIM_NO_PATTERN.test(claimNo)) throw badRequest('INVALID_CLAIM_NUMBER', 'The claim number is malformed');
  const claim = findClaimByNo(claimNo);
  if (!claim || (claim.user_id !== user.id && user.role !== 'admin')) throw notFound('CLAIM_NOT_FOUND', 'Claim not found');
  const evidence = evidenceForClaim(claim.id).find(e => e.id === evidenceId);
  if (!evidence) throw notFound('EVIDENCE_NOT_FOUND', 'Evidence not found');
  return evidence.file_name;
}

// ---------- admin ----------
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function adminListClaims(query: Record<string, unknown>) {
  const status = queryString(query.status);
  const business = queryString(query.business);
  const search = queryString(query.search).toLowerCase();
  const from = queryString(query.from);
  const to = queryString(query.to);
  if (status && status !== 'all' && !CLAIM_STATUSES.includes(status as ClaimStatus)) throw badRequest('INVALID_CLAIM_STATUS', 'Unknown claim status');
  if ((from && !DATE_PATTERN.test(from)) || (to && !DATE_PATTERN.test(to))) throw badRequest('INVALID_DATE', 'Dates must be YYYY-MM-DD');
  const fromMs = from ? Date.parse(`${from}T00:00:00Z`) : -Infinity;
  const toMs = to ? Date.parse(`${to}T00:00:00Z`) + 86_400_000 : Infinity; // inclusive of the final day

  const { page, pageSize } = pageParams(query);
  const claims = listClaims().filter(claim => {
    if (status && status !== 'all' && claim.status !== status) return false;
    const created = Date.parse(claim.created_at);
    if (created < fromMs || created >= toMs) return false;
    if (business && business !== 'all' && !itemsForClaim(claim.id).some(i => i.business === business)) return false;
    if (search) {
      const order = findOrderById(claim.order_id);
      const customer = findUserById(claim.user_id);
      const haystack = [claim.claim_number, order?.order_no, customer?.name, customer?.email].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
  const { items, pagination } = paginate(claims, page, pageSize);
  return {
    items: items.map(claim => ({ ...summary(claim), customer_name: findUserById(claim.user_id)?.name ?? null })),
    pagination,
  };
}

export function adminClaimStats() {
  const claims = listClaims();
  const by_status = Object.fromEntries(CLAIM_STATUSES.map(s => [s, claims.filter(c => c.status === s).length]));
  return { total: claims.length, open_claims: claims.filter(c => !TERMINAL_CLAIM_STATUSES.includes(c.status)).length, by_status };
}

export function adminGetClaim(claimNo: string) {
  if (!CLAIM_NO_PATTERN.test(claimNo)) throw badRequest('INVALID_CLAIM_NUMBER', 'The claim number is malformed');
  const claim = findClaimByNo(claimNo);
  if (!claim) throw notFound('CLAIM_NOT_FOUND', 'Claim not found');
  return claim;
}

export function adminUpdateClaimStatus(admin: User, claimNo: string, body: Record<string, unknown>) {
  const claim = adminGetClaim(claimNo);
  const to = body.status as ClaimStatus;
  if (!CLAIM_STATUSES.includes(to)) throw badRequest('INVALID_CLAIM_STATUS', 'Unknown claim status');
  if (to === claim.status) throw conflict('CLAIM_STATUS_UNCHANGED', 'The claim already has this status');
  if (!canTransition(claim.status, to)) throw conflict('INVALID_CLAIM_TRANSITION', `A ${claim.status} claim cannot move to ${to}`);
  const visibility = body.note_visibility ?? 'customer';
  if (visibility !== 'customer' && visibility !== 'internal') throw badRequest('INVALID_NOTE_VISIBILITY', 'Visibility must be customer or internal');
  const note = optionalString(body.note, 'note', 1000);

  const patch: { admin_note?: string | null; resolved_at?: string | null } = {};
  if (typeof body.admin_note === 'string') patch.admin_note = body.admin_note.trim() || null; // "" clears it
  else if (visibility === 'customer' && note) patch.admin_note = note; // an internal note is never promoted
  if (TERMINAL_CLAIM_STATUSES.includes(to)) patch.resolved_at = nowIso();

  transitionClaim(claim, to, { changed_by: admin.id, changed_by_role: 'admin', note, visibility }, patch);
  return adminClaimView(claim);
}
