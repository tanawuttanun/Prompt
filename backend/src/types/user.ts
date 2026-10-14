export type Role = 'customer' | 'admin';

export type User = {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  profile_image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicUser = Omit<User, 'password_hash'>;

export const toPublicUser = ({ password_hash: _hash, ...rest }: User): PublicUser => rest;
