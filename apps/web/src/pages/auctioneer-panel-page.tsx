import { useCallback, useEffect, useRef, useState, type SubmitEvent } from 'react';
import { UnsavedChangesGuard } from '@/components/feedback/unsaved-changes-guard';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Ban, Gavel, LayoutDashboard, PlusCircle, RefreshCw } from 'lucide-react';

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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/features/auth/use-auth';
import { cancelLot, getMyLots, publishLot, type ManagedLot } from '@/features/lots/auctioneer-api';
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
  onDirtyChange,
}: {
  lot: ManagedLot;
  token: string;
  onPublished: () => void;
  onDirtyChange: (lotId: string, dirty: boolean) => void;
}) {
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePublish(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!startsAt || !endsAt) {
      setError('Informe as datas de início e encerramento do leilão.');
      return;
    }

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

    setError(null);
    setConfirmOpen(true);
  }

  async function confirmPublish() {
    if (submitting) return;

    const start = new Date(startsAt);
    const end = new Date(endsAt);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start ||
      end <= new Date()
    ) {
      setError('As datas precisam ser revisadas antes da publicação.');
      setConfirmOpen(false);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await publishLot(token, lot.id, {
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      });

      onDirtyChange(lot.id, false);
      setConfirmOpen(false);
      onPublished();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível publicar o lote.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form
        onSubmit={handlePublish}
        noValidate
        className="mt-5 space-y-4 border-t border-border pt-5"
      >
        <h3 className="text-sm font-semibold">Publicar leilão</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-2 text-xs">
            <span>Início</span>
            <input
              type="datetime-local"
              required
              value={startsAt}
              onChange={(event) => {
                const value = event.target.value;
                setStartsAt(value);
                onDirtyChange(lot.id, Boolean(value || endsAt));
              }}
              className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm"
            />
          </label>

          <label className="space-y-2 text-xs">
            <span>Encerramento</span>
            <input
              type="datetime-local"
              required
              value={endsAt}
              onChange={(event) => {
                const value = event.target.value;
                setEndsAt(value);
                onDirtyChange(lot.id, Boolean(startsAt || value));
              }}
              className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm"
            />
          </label>
        </div>

        {error && !confirmOpen && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="sm" disabled={submitting} className="brand-button">
          {submitting ? 'Publicando...' : 'Publicar lote'}
        </Button>
      </form>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!submitting) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent className="max-w-md border-border bg-card text-card-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-2xl">
              Publicar este leilão?
            </AlertDialogTitle>

            <AlertDialogDescription className="pt-2 leading-relaxed">
              Confirme os dados do lote <strong className="text-foreground">{lot.title}</strong>.
              Depois da publicação, ele ficará disponível conforme o período configurado.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Preço inicial</span>
              <strong>{formatCurrency(lot.initialPriceInCents)}</strong>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Incremento mínimo</span>
              <strong>{formatCurrency(lot.minimumIncrementInCents)}</strong>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-muted-foreground">Início</p>
              <p className="mt-1 font-medium">
                {startsAt ? formatDate(new Date(startsAt).toISOString()) : '-'}
              </p>
            </div>

            <div>
              <p className="text-muted-foreground">Encerramento</p>
              <p className="mt-1 font-medium">
                {endsAt ? formatDate(new Date(endsAt).toISOString()) : '-'}
              </p>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={submitting}>Revisar dados</AlertDialogCancel>

            <AlertDialogAction
              disabled={submitting}
              className="bg-[#7A2234] text-white hover:bg-[#681C2B]"
              onClick={(event) => {
                event.preventDefault();
                void confirmPublish();
              }}
            >
              {submitting ? 'Publicando...' : 'Confirmar publicação'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function AuctioneerPanelPage() {
  const { token } = useAuth();
  const [lots, setLots] = useState<ManagedLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editedPublishForms, setEditedPublishForms] = useState<Record<string, boolean>>({});

  const allowNavigationRef = useRef(false);

  const hasUnsavedPublication = Object.values(editedPublishForms).some(Boolean);

  const [cancellingLotId, setCancellingLotId] = useState<string | null>(null);

  const [cancelError, setCancelError] = useState<{
    lotId: string;
    message: string;
  } | null>(null);

  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

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

  async function handleCancel(lot: ManagedLot) {
    if (!token || cancellingLotId) return;

    setCancellingLotId(lot.id);
    setCancelError(null);
    setCancelSuccess(null);

    try {
      await cancelLot(token, lot.id);

      setLots((current) =>
        current.map((item) => (item.id === lot.id ? { ...item, status: 'CANCELLED' } : item)),
      );

      // Limpa o estado de alterações não salvas deste lote.
      setEditedPublishForms((current) => ({
        ...current,
        [lot.id]: false,
      }));

      setCancelSuccess(`O lote "${lot.title}" foi cancelado com sucesso.`);
    } catch (cause: unknown) {
      setCancelError({
        lotId: lot.id,
        message: cause instanceof Error ? cause.message : 'Não foi possível cancelar o lote.',
      });
    } finally {
      setCancellingLotId(null);
    }
  }

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

        {cancelSuccess && (
          <p role="status" className="rounded-lg border border-border bg-card p-4 text-sm">
            {cancelSuccess}
          </p>
        )}

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

                    {(lot.startsAt || lot.endsAt) && (
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
                    onDirtyChange={(lotId, dirty) => {
                      setEditedPublishForms((current) => ({
                        ...current,
                        [lotId]: dirty,
                      }));
                    }}
                    onPublished={() => {
                      setLoading(true);
                      refresh();
                    }}
                  />
                )}

                {token &&
                  (lot.status === 'DRAFT' || lot.status === 'SCHEDULED' || lot.status === 'OPEN') &&
                  lot.currentPriceInCents === null && (
                    <div className="mt-5 border-t border-border pt-4">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={cancellingLotId !== null}
                            className="text-destructive hover:text-destructive"
                          >
                            <Ban className="size-4" />
                            {cancellingLotId === lot.id ? 'Cancelando...' : 'Cancelar lote'}
                          </Button>
                        </AlertDialogTrigger>

                        <AlertDialogContent className="max-w-md border-border bg-card text-card-foreground">
                          <AlertDialogHeader>
                            <div className="mb-3 flex size-12 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
                              <Ban className="size-6 text-destructive" />
                            </div>

                            <AlertDialogTitle className="font-serif text-2xl">
                              Cancelar este lote?
                            </AlertDialogTitle>

                            <AlertDialogDescription className="pt-2 text-sm leading-relaxed">
                              Você está prestes a cancelar o lote{' '}
                              <strong className="font-semibold text-foreground">{lot.title}</strong>
                              .
                              <span className="mt-3 block">
                                Essa ação é definitiva. O lote deixará de estar disponível para
                                participação, mas continuará registrado no histórico da plataforma.
                              </span>
                            </AlertDialogDescription>
                          </AlertDialogHeader>

                          <AlertDialogFooter className="mt-5 gap-2 sm:gap-2">
                            <AlertDialogCancel disabled={cancellingLotId !== null}>
                              Manter lote
                            </AlertDialogCancel>

                            <AlertDialogAction
                              disabled={cancellingLotId !== null}
                              onClick={() => void handleCancel(lot)}
                              className="bg-[#7A2234] text-white hover:bg-[#681C2B] focus-visible:ring-[#C6A15B]/60"
                            >
                              <Ban className="size-4" />
                              Sim, cancelar lote
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <p className="mt-2 text-xs text-muted-foreground">
                        Disponível apenas para lotes que ainda não receberam lances.
                      </p>
                    </div>
                  )}

                {cancelError?.lotId === lot.id && (
                  <p role="alert" className="mt-3 text-sm text-destructive">
                    {cancelError.message}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <UnsavedChangesGuard dirty={hasUnsavedPublication} allowNavigationRef={allowNavigationRef} />
    </main>
  );
}
