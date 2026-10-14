// In-memory data store. Every collection lives in this process and is reset to
// the seed on restart, so the app runs with no database. Repositories are the only
// code that touches these arrays, which keeps a later switch to MySQL contained.
import type { Business, Category, LocalProduct, SyncLog } from '../types/product.js';
import type { Order, OrderItem } from '../types/order.js';
import type { Claim, ClaimEvidence, ClaimHistory, ClaimItem } from '../types/claim.js';
import type { User } from '../types/user.js';

export type StoredFile = { buffer: Buffer; mime: string };

export const db = {
  users: [] as User[],
  businesses: [] as Business[],
  products: [] as LocalProduct[],
  categories: [] as Category[],
  syncLogs: [] as SyncLog[],
  orders: [] as Order[],
  orderItems: [] as OrderItem[],
  claims: [] as Claim[],
  claimItems: [] as ClaimItem[],
  claimEvidence: [] as ClaimEvidence[],
  claimHistory: [] as ClaimHistory[],
  // date key (YYYYMMDD) -> last claim number issued that day
  claimSequences: new Map<string, number>(),
  // uploaded files, keyed by a generated name (never the client's filename)
  files: new Map<string, StoredFile>(),
};

const counters = new Map<string, number>();
export function nextId(collection: string): number {
  const next = (counters.get(collection) ?? 0) + 1;
  counters.set(collection, next);
  return next;
}
