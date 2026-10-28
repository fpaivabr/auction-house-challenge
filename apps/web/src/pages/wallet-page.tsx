import { useEffect, useState, type SubmitEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, History, LockKeyhole, Trophy, Wallet as WalletIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { formatCurrency, formatDate } from '@/features/lots/lots-api';
import {
  createDeposit,
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
  const [depositAmount, setDepositAmount] = useState('');
  const [depositing, setDepositing] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState<string | null>(null);

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

  async function handleDeposit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || depositing) return;

    setDepositError(null);
    setDepositSuccess(null);

    if (!depositAmount.trim()) {
      setDepositError('Informe o valor do depósito.');
      return;
    }

    const normalized = depositAmount.trim().replace(',', '.');

    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      setDepositError('Informe um valor com até duas casas decimais.');
      return;
    }

    const [whole, fraction = ''] = normalized.split('.');
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));

    if (!Number.isSafeInteger(cents) || cents < 100 || cents > 1_000_000) {
      setDepositError('Informe um valor entre R$ 1,00 e R$ 10.000,00.');
      return;
    }

    setDepositing(true);

    try {
      await createDeposit(token, cents);
    } catch (cause: unknown) {
      setDepositError(
        cause instanceof Error ? cause.message : 'Não foi possível registrar o depósito.',
      );
      setDepositing(false);
      return;
    }

    setDepositSuccess('Depósito simulado registrado com sucesso.');
    setDepositAmount('');

    const [walletResult, transactionsResult] = await Promise.allSettled([
      getWallet(token),
      getWalletTransactions(token),
    ]);

    if (walletResult.status === 'fulfilled') {
      setWallet(walletResult.value);
    }

    if (transactionsResult.status === 'fulfilled') {
      setTransactions(transactionsResult.value);
    }

    if (walletResult.status === 'rejected' || transactionsResult.status === 'rejected') {
      setDepositError(
        'O depósito foi registrado, mas não foi possível atualizar todos os dados. Recarregue a página.',
      );
    }

    setDepositing(false);
  }

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
            <h2 className="font-serif text-2xl">Adicionar saldo</h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Adicione créditos fictícios à sua carteira para participar dos leilões. Nenhum
              pagamento real será realizado.
            </p>

            <form onSubmit={handleDeposit} noValidate className="mt-6 max-w-md space-y-4">
              <div className="space-y-2">
                <label htmlFor="deposit-amount" className="block text-sm font-medium">
                  Valor do depósito (R$)
                </label>

                <input
                  id="deposit-amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  required
                  placeholder="Ex.: 150,00"
                  value={depositAmount}
                  disabled={depositing}
                  onChange={(event) => {
                    setDepositAmount(event.target.value);
                    setDepositError(null);
                    setDepositSuccess(null);
                  }}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {depositError && (
                <p role="alert" className="text-sm text-destructive">
                  {depositError}
                </p>
              )}

              {depositSuccess && (
                <p role="status" className="text-sm font-medium">
                  {depositSuccess}
                </p>
              )}

              <Button type="submit" className="brand-button" disabled={depositing}>
                {depositing ? 'Registrando depósito...' : 'Adicionar saldo'}
              </Button>
            </form>
          </section>

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

          <Button asChild variant="outline" className="mt-5 ml-3">
            <Link to="/arremates">
              <Trophy className="size-4" />
              Meus arremates
            </Link>
          </Button>
        </>
      )}
    </main>
  );
}
