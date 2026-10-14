import { deleteStoredFile, storeImage } from '../middleware/upload.js';
import { updateUser } from '../repositories/userRepository.js';
import { toPublicUser, type User } from '../types/user.js';
import { optionalString, requiredString } from '../utils/index.js';

const PROFILE_FIELDS = ['phone', 'address', 'city', 'province', 'postal_code', 'country'] as const;

export const getProfile = (user: User) => toPublicUser(user);

export function updateProfile(user: User, body: Record<string, unknown>) {
  const patch: Partial<User> = {};
  if (body.name !== undefined) patch.name = requiredString(body.name, 'name', 160);
  for (const field of PROFILE_FIELDS) {
    if (body[field] !== undefined) patch[field] = optionalString(body[field], field, field === 'address' ? 255 : 120);
  }
  return toPublicUser(updateUser(user.id, patch)!);
}

const fileNameFromUrl = (url: string | null) => (url?.startsWith('/api/files/') ? url.slice('/api/files/'.length) : null);

export function setProfileImage(user: User, file: Express.Multer.File) {
  const stored = storeImage(file, 'profiles', 'INVALID_IMAGE');
  const previous = fileNameFromUrl(user.profile_image_url);
  if (previous) deleteStoredFile(previous);
  return toPublicUser(updateUser(user.id, { profile_image_url: `/api/files/${stored.name}` })!);
}

export function removeProfileImage(user: User) {
  const previous = fileNameFromUrl(user.profile_image_url);
  if (previous) deleteStoredFile(previous);
  return toPublicUser(updateUser(user.id, { profile_image_url: null })!);
}
