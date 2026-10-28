import { useEffect, useState, type SubmitEvent } from 'react';
import { ArrowLeft, CalendarClock, Gavel, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/features/auth/use-auth';
import {
  formatCurrency,
  formatDate,
  getLot,
  lotStatusLabel,
  type Lot,
} from '@/features/lots/lots-api';
import { getWallet, placeBid, type Wallet } from '@/features/wallet/wallet-api';

export function LotDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuth();

  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState<string | null>(null);
  const [pendingBidAmountInCents, setPendingBidAmountInCents] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();

    getLot(id, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setLot(result);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o lote.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (!token || user?.role !== 'BIDDER') {
      return;
    }

    let active = true;

    getWallet(token)
      .then((result) => {
        if (active) {
          setWallet(result);
        }
      })
      .catch(() => {
        if (active) {
          setWallet(null);
        }
      });

    return () => {
      active = false;
    };
  }, [token, user?.role]);

  function handlePlaceBid(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !id ||
      !token ||
      !lot ||
      user?.role !== 'BIDDER' ||
      lot.status !== 'OPEN' ||
      submittingBid
    ) {
      return;
    }

    setBidError(null);
    setBidSuccess(null);

    if (!bidAmount.trim()) {
      setBidError('Informe o valor do seu lance.');
      return;
    }

    const normalizedAmount = bidAmount.trim().replace(',', '.');

    if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount)) {
      setBidError('Informe um valor válido, com até duas casas decimais.');
      return;
    }

    const [whole, fraction = ''] = normalizedAmount.split('.');

    const amountInCents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));

    if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
      setBidError('O valor informado não é válido.');
      return;
    }

    const minimumInCents =
      lot.currentPriceInCents === null
        ? BigInt(lot.initialPriceInCents)
        : BigInt(lot.currentPriceInCents) + BigInt(lot.minimumIncrementInCents);

    if (BigInt(amountInCents) < minimumInCents) {
      setBidError(`O lance mínimo é ${formatCurrency(minimumInCents.toString())}.`);
      return;
    }

    // Não registra ainda. Abre primeiro o modal de confirmação.
    setPendingBidAmountInCents(amountInCents);
  }

  async function confirmBid() {
    if (
      !id ||
      !token ||
      !lot ||
      user?.role !== 'BIDDER' ||
      lot.status !== 'OPEN' ||
      pendingBidAmountInCents === null ||
      submittingBid
    ) {
      return;
    }

    setSubmittingBid(true);
    setBidError(null);
    setBidSuccess(null);

    try {
      await placeBid(id, pendingBidAmountInCents, token);

      setPendingBidAmountInCents(null);
      setBidAmount('');
      setBidSuccess('Lance registrado com sucesso!');
    } catch (cause: unknown) {
      setPendingBidAmountInCents(null);

      setBidError(cause instanceof Error ? cause.message : 'Não foi possível registrar o lance.');
    } finally {
      // Obtém os valores atuais mesmo quando o lance foi recusado,
      // por exemplo, porque outro participante ofereceu mais.
      const [updatedLot, updatedWallet] = await Promise.allSettled([getLot(id), getWallet(token)]);

      if (updatedLot.status === 'fulfilled') {
        setLot(updatedLot.value);
      }

      if (updatedWallet.status === 'fulfilled') {
        setWallet(updatedWallet.value);
      }

      setSubmittingBid(false);
    }
  }

  if (loading) {
    return (
      <main role="status" className="mx-auto w-full max-w-7xl flex-1 px-4 py-16">
        Carregando detalhes do lote...
      </main>
    );
  }

  if (error || !lot) {
    return (
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-16">
        <h1 className="font-serif text-3xl">Lote indisponível</h1>

        <p role="alert" className="mt-3 text-muted-foreground">
          {error ?? 'Não foi possível localizar este lote.'}
        </p>

        <Button asChild variant="outline" className="mt-6">
          <Link to="/">Voltar aos leilões</Link>
        </Button>
      </main>
    );
  }

  const currentPrice = lot.currentPriceInCents ?? lot.initialPriceInCents;

  const minimumNextBid =
    lot.currentPriceInCents === null
      ? lot.initialPriceInCents
      : (BigInt(lot.currentPriceInCents) + BigInt(lot.minimumIncrementInCents)).toString();

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <Link
        to="/#lotes"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar aos leilões
      </Link>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-8">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-border bg-card p-8">
            {lot.imageUrl ? (
              <img
                src={lot.imageUrl}
                alt={lot.title}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <Gavel className="size-20 text-muted-foreground/50" aria-hidden="true" />
            )}
          </div>

          <section>
            <h2 className="font-serif text-2xl">Sobre o lote</h2>

            <p className="mt-4 whitespace-pre-line leading-relaxed text-muted-foreground">
              {lot.description}
            </p>
          </section>
        </div>

        <div>
          <div className="sticky top-24 space-y-6">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#C6A15B]">
                {lotStatusLabel[lot.status]}
              </p>

              <h1 className="font-serif text-4xl leading-tight">{lot.title}</h1>
            </div>

            <div className="space-y-5 rounded-xl border border-border bg-card p-6">
              <div>
                <p className="text-sm text-muted-foreground">
                  {lot.currentPriceInCents !== null ? 'Lance atual' : 'Preço inicial'}
                </p>

                <p className="mt-2 font-serif text-4xl font-semibold">
                  {formatCurrency(currentPrice)}
                </p>
              </div>

              <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Incremento mínimo</p>

                  <p className="mt-1 font-semibold">
                    {formatCurrency(lot.minimumIncrementInCents)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Próximo lance mínimo</p>

                  <p className="mt-1 font-semibold">{formatCurrency(minimumNextBid)}</p>
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-5 text-sm">
                <div className="flex items-start gap-3">
                  <CalendarClock className="mt-0.5 size-4 shrink-0 text-[#C6A15B]" />

                  <div>
                    <p className="text-muted-foreground">Início</p>
                    <p>{formatDate(lot.startsAt)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CalendarClock className="mt-0.5 size-4 shrink-0 text-[#C6A15B]" />

                  <div>
                    <p className="text-muted-foreground">Encerramento</p>
                    <p>{formatDate(lot.endsAt)}</p>
                  </div>
                </div>
              </div>

              {lot.status === 'OPEN' ? (
                user?.role === 'BIDDER' && token ? (
                  <form
                    onSubmit={handlePlaceBid}
                    noValidate
                    className="space-y-4 border-t border-border pt-5"
                  >
                    {wallet && (
                      <div className="rounded-lg bg-muted/50 p-4 text-sm">
                        <p className="text-muted-foreground">Saldo disponível</p>

                        <p className="mt-1 text-lg font-semibold">
                          {formatCurrency(wallet.availableInCents)}
                        </p>

                        <Link
                          to="/carteira"
                          className="mt-2 inline-block text-xs underline underline-offset-4"
                        >
                          Consultar minha carteira
                        </Link>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label htmlFor="bid-amount" className="block text-sm font-medium">
                        Valor do seu lance (R$)
                      </label>

                      <input
                        id="bid-amount"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        required
                        value={bidAmount}
                        onChange={(event) => {
                          setBidAmount(event.target.value);
                          setBidError(null);
                          setBidSuccess(null);
                        }}
                        placeholder={(Number(minimumNextBid) / 100).toFixed(2).replace('.', ',')}
                        disabled={submittingBid}
                        aria-invalid={Boolean(bidError)}
                        aria-describedby={bidError ? 'bid-amount-error' : undefined}
                        className="h-11 w-full rounded-lg border border-input bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />

                      <p className="text-xs text-muted-foreground">
                        Lance mínimo: {formatCurrency(minimumNextBid)}
                      </p>

                      {bidError && (
                        <p id="bid-amount-error" role="alert" className="text-sm text-destructive">
                          {bidError}
                        </p>
                      )}
                    </div>

                    {bidSuccess && (
                      <p role="status" className="text-sm font-medium text-foreground">
                        {bidSuccess}
                      </p>
                    )}

                    <Button
                      type="submit"
                      className="brand-button w-full"
                      size="lg"
                      disabled={submittingBid}
                    >
                      {submittingBid ? 'Registrando lance...' : 'Revisar lance'}
                    </Button>

                    <p className="text-center text-xs text-muted-foreground">
                      O valor será reservado na sua carteira enquanto você estiver liderando o
                      leilão.
                    </p>
                  </form>
                ) : user?.role === 'AUCTIONEER' ? (
                  <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                    Leiloeiros não podem participar dos lances.
                  </p>
                ) : (
                  <Button asChild className="brand-button w-full" size="lg">
                    <Link to="/login">Entrar para participar</Link>
                  </Button>
                )
              ) : (
                <Button disabled className="w-full" size="lg">
                  {lot.status === 'SCHEDULED' ? 'Leilão ainda não iniciado' : 'Leilão encerrado'}
                </Button>
              )}
            </div>

            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#C6A15B]" />
              Lances sujeitos às validações e regras financeiras da plataforma.
            </p>

            <Button asChild variant="outline" className="w-full">
              <Link to={`/lotes/${lot.id}/auditoria`}>
                <ShieldCheck className="size-4" />
                Auditar histórico de lances
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog
        open={pendingBidAmountInCents !== null}
        onOpenChange={(open) => {
          if (!open && !submittingBid) {
            setPendingBidAmountInCents(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md border-border bg-card text-card-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-2xl">
              Confirmar seu lance?
            </AlertDialogTitle>

            <AlertDialogDescription className="pt-2 leading-relaxed">
              Você está prestes a participar do leilão da obra{' '}
              <strong className="text-foreground">{lot.title}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-xl border border-[#C6A15B]/30 bg-muted/40 p-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Valor do lance
            </p>

            <p className="mt-3 font-serif text-4xl font-semibold">
              {formatCurrency(String(pendingBidAmountInCents ?? 0))}
            </p>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            Ao confirmar, o valor será reservado na sua carteira enquanto você estiver liderando o
            leilão. Se outro participante superar seu lance, a reserva será liberada conforme as
            regras da plataforma.
          </p>

          {wallet && (
            <p className="text-sm text-muted-foreground">
              Saldo disponível atual:{' '}
              <strong className="text-foreground">{formatCurrency(wallet.availableInCents)}</strong>
            </p>
          )}

          <AlertDialogFooter className="mt-3 gap-2 sm:gap-2">
            <AlertDialogCancel disabled={submittingBid}>Voltar</AlertDialogCancel>

            <AlertDialogAction
              disabled={submittingBid}
              className="bg-[#7A2234] text-white hover:bg-[#681C2B]"
              onClick={(event) => {
                event.preventDefault();
                void confirmBid();
              }}
            >
              {submittingBid ? 'Registrando...' : 'Confirmar lance'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
