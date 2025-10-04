import { UserRole } from '../dto/user-role.enum';
export enum AuthProvider {
  LOCAL = 'LOCAL',
  GOOGLE = 'GOOGLE',
  FACEBOOK = 'FACEBOOK',
  TWITTER = 'TWITTER',
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  bio?: string;
  role: UserRole;
  isActive: boolean;
  provider: AuthProvider;
  providerId?: string;
  avatar?: string;
  emailVerified: boolean;
  reputation: number;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type UserWithoutPassword = Omit<User, 'password'>;

export interface JwtPayload {
  userId: string;
  email: string;
}

export interface OAuthUser {
  email: string;
  name: string;
  avatar?: string;
  provider: AuthProvider;
  providerId: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  bio?: string;
  role?: UserRole;
  provider?: AuthProvider;
  providerId?: string;
  avatar?: string;
  emailVerified?: boolean;
}
