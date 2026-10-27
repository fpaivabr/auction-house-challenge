import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from './use-auth';
import type { UserRole } from './auth-api';

type ProtectedRouteProps = {
  children: ReactNode;
  role?: UserRole;
};

export function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main
        role="status"
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-16 text-muted-foreground"
      >
        Verificando sua sessão...
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
