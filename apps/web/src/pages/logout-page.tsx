import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/features/auth/use-auth';

export function LogoutPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const completedRef = useRef(false);

  useEffect(() => {
    if (completedRef.current) return;

    completedRef.current = true;
    signOut();
    navigate('/', { replace: true });
  }, [navigate, signOut]);

  return (
    <main role="status" className="mx-auto w-full max-w-7xl flex-1 px-4 py-16">
      Encerrando sessão...
    </main>
  );
}
