export type AuthResponse = {
  message: string;
  token: string;
  user: { id: string; name: string; email: string };
};

export type DbUser = {
  id: string;
  name: string;
  email: string;
  password: string;
};
