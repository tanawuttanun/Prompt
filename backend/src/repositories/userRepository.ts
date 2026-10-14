import { db, nextId } from '../store/db.js';
import type { User } from '../types/user.js';
import { nowIso } from '../utils/index.js';

export const findUserById = (id: number) => db.users.find(u => u.id === id);
export const findUserByEmail = (email: string) => db.users.find(u => u.email === email.toLowerCase());
export const listUsers = () => [...db.users];
export const countAdmins = () => db.users.filter(u => u.role === 'admin').length;

export function createUser(input: Pick<User, 'name' | 'email' | 'password_hash' | 'role'> & Partial<User>): User {
  const now = nowIso();
  const user: User = {
    phone: null, address: null, city: null, province: null, postal_code: null, country: null, profile_image_url: null,
    ...input,
    email: input.email.toLowerCase(),
    id: nextId('users'),
    created_at: now,
    updated_at: now,
  };
  db.users.push(user);
  return user;
}

export function updateUser(id: number, patch: Partial<Omit<User, 'id' | 'created_at'>>): User | undefined {
  const user = findUserById(id);
  if (!user) return undefined;
  Object.assign(user, patch, { updated_at: nowIso() });
  if (patch.email) user.email = patch.email.toLowerCase();
  return user;
}

export function deleteUser(id: number): boolean {
  const index = db.users.findIndex(u => u.id === id);
  if (index < 0) return false;
  db.users.splice(index, 1);
  return true;
}
