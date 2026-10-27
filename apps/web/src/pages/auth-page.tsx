import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Gavel } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { login, register } from '@/features/auth/auth-api';
import { useAuth } from '@/features/auth/use-auth';

type AuthPageProps = {
  mode: 'login' | 'register';
};

export function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const isRegister = mode === 'register';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = isRegister
        ? await register(name, email, password)
        : await login(email, password);

      signIn(result);

      navigate(result.user.role === 'AUCTIONEER' ? '/painel' : '/', {
        replace: true,
      });
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível autenticar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-4 py-14 sm:px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-9">
        <div className="mb-8 space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-[#C6A15B]/50 text-[#C6A15B]">
            <Gavel className="size-6" aria-hidden="true" />
          </div>

          <h1 className="font-serif text-4xl">
            {isRegister ? 'Criar conta' : 'Bem-vindo de volta'}
          </h1>

          <p className="text-sm text-muted-foreground">
            {isRegister
              ? 'Cadastre-se para participar dos leilões.'
              : 'Entre para acessar sua conta na Modern Auction.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isRegister && (
            <label className="block space-y-2 text-sm font-medium">
              <span>Nome completo</span>
              <input
                type="text"
                autoComplete="name"
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Seu nome"
              />
            </label>
          )}

          <label className="block space-y-2 text-sm font-medium">
            <span>E-mail</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="seu@email.com"
            />
          </label>

          <label className="block space-y-2 text-sm font-medium">
            <span>Senha</span>
            <input
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
              minLength={isRegister ? 8 : 1}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={isRegister ? 'Mínimo de 8 caracteres' : 'Sua senha'}
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={submitting} className="brand-button w-full">
            {submitting ? 'Aguarde...' : isRegister ? 'Criar minha conta' : 'Entrar'}
            {!submitting && <ArrowRight className="size-4" />}
          </Button>
        </form>

        <p className="mt-7 text-center text-sm text-muted-foreground">
          {isRegister ? 'Já tem uma conta?' : 'Ainda não tem conta?'}{' '}
          <Link
            to={isRegister ? '/login' : '/cadastro'}
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            {isRegister ? 'Entrar' : 'Cadastre-se'}
          </Link>
        </p>
      </div>
    </main>
  );
}
