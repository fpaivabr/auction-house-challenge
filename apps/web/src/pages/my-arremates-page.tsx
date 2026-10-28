import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Gavel, ReceiptText, RefreshCw, Trophy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { formatCurrency, formatDate } from '@/features/lots/lots-api';
import {
  getMyParticipations,
  type MyLotParticipation,
  type ParticipationOutcome,
} from '@/features/lots/participations-api';

const outcomeLabels: Record<ParticipationOutcome, string> = {
  LEADING: 'Você está liderando',
  OUTBID: 'Seu lance foi superado',
  WON: 'Arrematado',
  LOST: 'Não arrematado',
  PENDING: 'Aguardando resultado',
  REVERSED: 'Arremate revertido',
};

type ParticipationFilter = 'ALL' | 'ACTIVE' | 'WON' | 'LOST';

export function MyArrematesPage() {
  const { token } = useAuth();

  const [participations, setParticipations] = useState<MyLotParticipation[]>([]);
  const [filter, setFilter] = useState<ParticipationFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) return;

    let active = true;

    getMyParticipations(token)
      .then((result) => {
        if (!active) return;
        setParticipations(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error ? cause.message : 'Não foi possível carregar suas participações.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, reloadKey]);

  function retry() {
    setLoading(true);
    setError(null);
    setReloadKey((current) => current + 1);
  }

  const filtered = participations.filter((item) => {
    if (filter === 'ALL') return true;
    if (filter === 'WON') return item.outcome === 'WON';
    if (filter === 'LOST') {
      return item.outcome === 'LOST' || item.outcome === 'REVERSED';
    }

    return item.outcome === 'LEADING' || item.outcome === 'OUTBID';
  });

  const wonCount = participations.filter((item) => item.outcome === 'WON').length;

  const activeCount = participations.filter(
    (item) => item.outcome === 'LEADING' || item.outcome === 'OUTBID',
  ).length;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar aos leilões
      </Link>

      <div className="mb-9">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#C6A15B]">
          Área do participante
        </p>

        <h1 className="font-serif text-4xl">Meus arremates</h1>

        <p className="mt-3 max-w-2xl text-muted-foreground">
          Acompanhe todos os leilões em que você ofereceu lances, consulte os resultados e acesse
          seus comprovantes.
        </p>
      </div>

      {loading && (
        <p role="status" className="text-muted-foreground">
          Carregando suas participações...
        </p>
      )}

      {!loading && error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-6">
          <p className="text-sm text-destructive">{error}</p>

          <Button type="button" variant="outline" className="mt-4" onClick={retry}>
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </div>
      )}

      {!loading && !error && participations.length === 0 && (
        <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center sm:p-12">
          <Trophy className="mx-auto mb-5 size-12 text-[#C6A15B]" aria-hidden="true" />

          <h2 className="font-serif text-2xl">Você ainda não participou de leilões</h2>

          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Quando fizer seu primeiro lance, o lote aparecerá aqui, mesmo que você não vença o
            leilão.
          </p>

          <Button asChild className="brand-button mt-6">
            <Link to="/">Explorar leilões</Link>
          </Button>
        </section>
      )}

      {!loading && !error && participations.length > 0 && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Participações</p>
              <p className="mt-2 font-serif text-3xl font-semibold">{participations.length}</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Em disputa</p>
              <p className="mt-2 font-serif text-3xl font-semibold">{activeCount}</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Arremates concluídos</p>
              <p className="mt-2 font-serif text-3xl font-semibold">{wonCount}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2" aria-label="Filtrar participações">
            {(
              [
                ['ALL', 'Todas'],
                ['ACTIVE', 'Em disputa'],
                ['WON', 'Arrematadas'],
                ['LOST', 'Não arrematadas'],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={filter === value ? 'default' : 'outline'}
                className={filter === value ? 'brand-button' : undefined}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma participação encontrada neste filtro.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((item) => {
                const isWinner = item.outcome === 'WON';
                const isLeading = item.outcome === 'LEADING';

                return (
                  <article
                    key={item.lot.id}
                    className="overflow-hidden rounded-xl border border-border bg-card"
                  >
                    <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
                      <div className="flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted sm:size-36">
                        {item.lot.imageUrl ? (
                          <img
                            src={item.lot.imageUrl}
                            alt={item.lot.title}
                            className="max-h-full max-w-full object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <Gavel className="size-10 text-muted-foreground" aria-hidden="true" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                            isWinner || isLeading
                              ? 'border-emerald-500/40 bg-emerald-500/10'
                              : 'border-[#C6A15B]/40 bg-[#C6A15B]/10'
                          }`}
                        >
                          {outcomeLabels[item.outcome]}
                        </span>

                        <h2 className="mt-3 text-xl font-semibold">{item.lot.title}</h2>

                        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-muted-foreground">Seu maior lance</p>
                            <p className="mt-1 font-semibold">
                              {formatCurrency(item.highestBidInCents)}
                            </p>
                          </div>

                          <div>
                            <p className="text-muted-foreground">Último lance do lote</p>
                            <p className="mt-1 font-semibold">
                              {formatCurrency(item.lot.currentPriceInCents)}
                            </p>
                          </div>
                        </div>

                        {item.lot.endsAt && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Encerramento: {formatDate(item.lot.endsAt)}
                          </p>
                        )}

                        <div className="mt-5 flex flex-wrap gap-3">
                          {item.receiptToken && (
                            <Button asChild className="brand-button">
                              <Link to={`/comprovantes/${item.receiptToken}`}>
                                <ReceiptText className="size-4" />
                                Ver comprovante
                              </Link>
                            </Button>
                          )}

                          <Button asChild variant="outline">
                            <Link to={`/lotes/${item.lot.id}`}>
                              Ver lote
                              <ArrowUpRight className="size-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
        Esta plataforma é demonstrativa. Os valores exibidos representam operações financeiras
        simuladas.
      </p>
    </main>
  );
}
