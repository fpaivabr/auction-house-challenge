import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Gavel,
  LayoutDashboard,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { getMyLots, publishLot, type ManagedLot } from '@/features/lots/auctioneer-api';
import { formatCurrency, formatDate } from '@/features/lots/lots-api';

const statusNames: Record<ManagedLot['status'], string> = {
  DRAFT: 'Rascunho',
  SCHEDULED: 'Agendado',
  OPEN: 'Em andamento',
  CLOSED: 'Encerrado',
  CANCELLED: 'Cancelado',
};

function PublishForm({
  lot,
  token,
  onPublished,
}: {
  lot: ManagedLot;
  token: string;
  onPublished: () => void;
}) {
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const start = new Date(startsAt);
    const end = new Date(endsAt);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start ||
      end <= new Date()
    ) {
      setError('Informe um encerramento futuro, posterior ao início.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await publishLot(token, lot.id, {
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      });

      onPublished();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível publicar o lote.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handlePublish} className="mt-5 space-y-4 border-t border-border pt-5">
      <h3 className="text-sm font-semibold">Publicar leilão</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-2 text-xs">
          <span>Início</span>
          <input
            type="datetime-local"
            required
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm"
          />
        </label>

        <label className="space-y-2 text-xs">
          <span>Encerramento</span>
          <input
            type="datetime-local"
            required
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" size="sm" disabled={submitting} className="brand-button">
        {submitting ? 'Publicando...' : 'Publicar lote'}
      </Button>
    </form>
  );
}

export function AuctioneerPanelPage() {
  const { token } = useAuth();
  const [lots, setLots] = useState<ManagedLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!token) return;

    let active = true;

    getMyLots(token)
      .then((data) => {
        if (active) {
          setLots(data);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Erro ao carregar seus lotes.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, reloadKey]);

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-4 py-10 sm:px-6 md:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
      <aside className="h-fit rounded-xl border border-border bg-card p-4">
        <h2 className="mb-5 text-sm font-semibold">Painel do leiloeiro</h2>

        <nav aria-label="Navegação administrativa" className="flex flex-col gap-2">
          <Link
            to="/painel"
            aria-current="page"
            className="flex items-center gap-3 rounded-lg bg-accent px-3 py-3 text-sm"
          >
            <LayoutDashboard className="size-4" />
            Meus lotes
          </Link>

          <Link
            to="/painel/lotes/novo"
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-accent"
          >
            <PlusCircle className="size-4" />
            Criar lote
          </Link>

          <Link
            to="/painel/auditoria"
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-accent"
          >
            <ShieldCheck className="size-4" />
            Auditoria
          </Link>
        </nav>
      </aside>

      <section className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#C6A15B]">
              Gerenciamento
            </p>
            <h1 className="font-serif text-4xl">Meus lotes</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Cadastre produtos e publique seus leilões.
            </p>
          </div>

          <Button asChild className="brand-button">
            <Link to="/painel/lotes/novo">
              <PlusCircle className="size-4" />
              Criar lote
            </Link>
          </Button>
        </div>

        {loading ? (
          <p role="status" className="text-muted-foreground">
            Carregando seus lotes...
          </p>
        ) : error ? (
          <div role="alert" className="rounded-xl border border-border bg-card p-6">
            <p>{error}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => {
                setLoading(true);
                refresh();
              }}
            >
              <RefreshCw className="size-4" />
              Tentar novamente
            </Button>
          </div>
        ) : lots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <Gavel className="mx-auto mb-4 size-9 text-muted-foreground" />
            <p className="font-semibold">Nenhum lote cadastrado</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Crie seu primeiro lote para começar.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{lots.length} lote(s) cadastrado(s)</p>

            {lots.map((lot) => (
              <article key={lot.id} className="rounded-xl border border-border bg-card p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row">
                  <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {lot.imageUrl ? (
                      <img
                        src={lot.imageUrl}
                        alt=""
                        className="size-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <Gavel className="size-8 text-muted-foreground" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold">
                        {statusNames[lot.status]}
                      </span>

                      <span className="text-xs text-muted-foreground">
                        Criado em {formatDate(lot.createdAt)}
                      </span>
                    </div>

                    <h2 className="text-lg font-semibold">{lot.title}</h2>

                    <p className="mt-2 text-sm text-muted-foreground">
                      Preço inicial: {formatCurrency(lot.initialPriceInCents)}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Incremento mínimo: {formatCurrency(lot.minimumIncrementInCents)}
                    </p>

                    {lot.status !== 'DRAFT' && (
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <p>Início: {formatDate(lot.startsAt)}</p>
                        <p>Fim: {formatDate(lot.endsAt)}</p>

                        {['SCHEDULED', 'OPEN', 'CLOSED'].includes(lot.status) && (
                          <Link
                            to={`/lotes/${lot.id}`}
                            className="inline-flex items-center gap-1 pt-2 font-medium text-foreground hover:underline"
                          >
                            Ver página pública
                            <ArrowUpRight className="size-4" />
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {lot.status === 'DRAFT' && token && (
                  <PublishForm
                    lot={lot}
                    token={token}
                    onPublished={() => {
                      setLoading(true);
                      refresh();
                    }}
                  />
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
