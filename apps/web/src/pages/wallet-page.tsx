import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, History, LockKeyhole, Wallet as WalletIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { formatCurrency, formatDate } from '@/features/lots/lots-api';
import {
  getWallet,
  getWalletTransactions,
  type Wallet,
  type WalletTransaction,
} from '@/features/wallet/wallet-api';

export function WalletPage() {
  const { token } = useAuth();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let active = true;

    Promise.all([getWallet(token), getWalletTransactions(token)])
      .then(([walletData, transactionData]) => {
        if (!active) return;
        setWallet(walletData);
        setTransactions(transactionData);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Não foi possível consultar a carteira.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar aos leilões
      </Link>

      <div className="mb-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#C6A15B]">
          Área do participante
        </p>
        <h1 className="font-serif text-4xl">Minha carteira</h1>
        <p className="mt-3 text-muted-foreground">
          Acompanhe seu saldo e os valores reservados em leilões.
        </p>
      </div>

      {loading && (
        <p role="status" className="text-muted-foreground">
          Carregando carteira...
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-destructive p-4 text-destructive">
          {error}
        </p>
      )}

      {!loading && wallet && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <section className="rounded-xl border border-border bg-card p-6">
              <div className="mb-5 flex items-center gap-2 text-muted-foreground">
                <WalletIcon className="size-5" />
                <h2 className="text-sm font-medium">Saldo total</h2>
              </div>
              <p className="font-serif text-3xl">{formatCurrency(wallet.balanceInCents)}</p>
            </section>

            <section className="rounded-xl border border-border bg-card p-6">
              <div className="mb-5 flex items-center gap-2 text-muted-foreground">
                <LockKeyhole className="size-5" />
                <h2 className="text-sm font-medium">Saldo reservado</h2>
              </div>
              <p className="font-serif text-3xl">{formatCurrency(wallet.reservedInCents)}</p>
            </section>

            <section className="rounded-xl border border-border bg-card p-6">
              <div className="mb-5 flex items-center gap-2 text-muted-foreground">
                <WalletIcon className="size-5" />
                <h2 className="text-sm font-medium">Saldo disponível</h2>
              </div>
              <p className="font-serif text-3xl">{formatCurrency(wallet.availableInCents)}</p>
            </section>
          </div>

          <section className="mt-10 rounded-xl border border-border bg-card p-6">
            <div className="mb-6 flex items-center gap-3">
              <History className="size-5 text-[#C6A15B]" />
              <h2 className="font-serif text-2xl">Histórico de transações</h2>
            </div>

            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma transação financeira registrada.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div>
                      <p className="font-medium">{transaction.type.replaceAll('_', ' ')}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(transaction.createdAt)}
                      </p>
                    </div>
                    <p className="font-semibold">{formatCurrency(transaction.amountInCents)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="mt-6 text-sm text-muted-foreground">
            Os saldos são simulados. Valores reservados correspondem a lances que estão liderando
            leilões ativos.
          </p>

          <Button asChild variant="outline" className="mt-5">
            <Link to="/">Explorar leilões</Link>
          </Button>
        </>
      )}
    </main>
  );
}
