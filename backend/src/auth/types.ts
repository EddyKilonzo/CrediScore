export type AuthResponse = {
  message: string;
  token: string;
  user: { id: string; name: string; email: string };
};

export type DbUser = {
  id: string;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  role: string;
  isActive: boolean;
  provider: string;
  providerId?: string;
  avatar?: string;
  emailVerified: boolean;
  reputation: number;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};
