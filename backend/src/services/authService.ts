import bcrypt from 'bcryptjs';

import { ApiError, badRequest, conflict } from '../errors/apiError.js';
import { createUser, findUserByEmail } from '../repositories/userRepository.js';
import type { User } from '../types/user.js';
import { isEmail, requiredString } from '../utils/index.js';

export const PASSWORD_MIN = 8;

export function validateCredentials(body: Record<string, unknown>) {
  const email = requiredString(body.email, 'email', 254).toLowerCase();
  if (!isEmail(email)) throw badRequest('VALIDATION_ERROR', 'Enter a valid email address', { field: 'email' });
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < PASSWORD_MIN || password.length > 128) {
    throw badRequest('VALIDATION_ERROR', `Password must be ${PASSWORD_MIN}-128 characters`, { field: 'password' });
  }
  return { email, password };
}

export async function register(body: Record<string, unknown>): Promise<User> {
  const name = requiredString(body.name, 'name', 160);
  const { email, password } = validateCredentials(body);
  if (findUserByEmail(email)) throw conflict('EMAIL_TAKEN', 'An account with this email already exists');
  return createUser({ name, email, password_hash: await bcrypt.hash(password, 10), role: 'customer' });
}

export async function login(body: Record<string, unknown>): Promise<User> {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const user = email ? findUserByEmail(email) : undefined;
  // same message either way, so the API never confirms which emails exist
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  return user;
}
