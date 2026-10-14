// The claim state machine, defined once and enforced by the backend on every update.
export const CLAIM_STATUSES = ['submitted', 'under_review', 'approved', 'rejected', 'processing', 'completed', 'cancelled'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  submitted: ['under_review', 'cancelled'],
  under_review: ['approved', 'rejected', 'cancelled'],
  approved: ['processing'],
  processing: ['completed'],
  rejected: [],
  completed: [],
  cancelled: [],
};

export const TERMINAL_CLAIM_STATUSES: ClaimStatus[] = ['rejected', 'completed', 'cancelled'];
// Claims in these states reserve their units; rejected/cancelled release them.
export const ACTIVE_CLAIM_STATUSES: ClaimStatus[] = ['submitted', 'under_review', 'approved', 'processing', 'completed'];
export const CUSTOMER_CANCELLABLE: ClaimStatus[] = ['submitted', 'under_review'];

export const CLAIM_REASONS = ['damaged', 'defective', 'wrong_item', 'missing_parts', 'other'] as const;
export type ClaimReason = (typeof CLAIM_REASONS)[number];

export const CLAIM_NO_PATTERN = /^CLM-\d{8}-\d{6}$/;

export const canTransition = (from: ClaimStatus, to: ClaimStatus) => CLAIM_TRANSITIONS[from].includes(to);

export type Claim = {
  id: number;
  claim_number: string;
  order_id: number;
  user_id: number;
  status: ClaimStatus;
  reason: ClaimReason;
  description: string;
  contact_phone: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type ClaimItem = {
  id: number;
  claim_id: number;
  order_item_id: number;
  quantity: number;
  product_id: string;
  product_name: string;
  business: string;
  business_name: string;
  unit_price: number;
};

export type ClaimEvidence = {
  id: number;
  claim_id: number;
  file_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};

export type ClaimHistory = {
  id: number;
  claim_id: number;
  previous_status: ClaimStatus | null;
  new_status: ClaimStatus;
  changed_by: number | null;
  changed_by_role: 'customer' | 'admin';
  note: string | null;
  visibility: 'customer' | 'internal';
  created_at: string;
};
