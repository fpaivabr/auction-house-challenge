import { createContext } from 'react';
import type { AuthResult, AuthUser } from './auth-api';

export type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  signIn: (result: AuthResult) => void;
  signOut: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
