import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Gavel,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getPublicLotAudit, type PublicLotAudit } from '@/features/audit/audit-api';
import { formatCurrency, formatDate } from '@/features/lots/lots-api';

const statuses = {
  VALID: {
    title: 'Histórico íntegro',
    description: 'Verificação criptográfica concluída.',
    border: 'border-[var(--success)]/40 bg-[var(--success)]/10',
  },
  INVALID: {
    title: 'Inconsistência detectada',
    description: 'Os registros não passaram na verificação.',
    border: 'border-destructive/40 bg-destructive/10',
  },
  PENDING: {
    title: 'Checkpoint pendente',
    description: 'O histórico está consistente, mas falta ancoragem externa.',
    border: 'border-[#C6A15B]/40 bg-[#C6A15B]/10',
  },
  UNVERIFIED: {
    title: 'Verificação incompleta',
    description: 'Não foi possível confirmar toda a proteção externa.',
    border: 'border-[#C6A15B]/40 bg-[#C6A15B]/10',
  },
};

export function AuditPage() {
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<PublicLotAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();

    getPublicLotAudit(id, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;

        setData(null);
        setError(
          cause instanceof Error ? cause.message : 'Não foi possível consultar a auditoria.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id, reloadKey]);

  function refresh() {
    if (loading) return;

    setLoading(true);
    setError(null);
    setReloadKey((current) => current + 1);
  }

  const status = data ? statuses[data.integrity.status] : null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <Link
        to={id ? `/lotes/${id}` : '/'}
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar ao lote
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#C6A15B]">
            Transparência dos leilões
          </p>

          <h1 className="font-serif text-4xl">Auditoria de lances</h1>

          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Consulte todos os lances registrados neste lote e confira a integridade do histórico. A
            consulta é pública.
          </p>
        </div>

        <Button type="button" variant="outline" disabled={loading} onClick={refresh}>
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Verificando...' : 'Verificar novamente'}
        </Button>
      </div>

      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          Consultando histórico e integridade do lote...
        </p>
      )}

      {!loading && error && (
        <section role="alert" className="rounded-xl border border-destructive/40 bg-card p-6">
          <p className="font-semibold">Não foi possível carregar a auditoria</p>
          <p className="mt-2 text-sm text-destructive">{error}</p>

          <Button type="button" variant="outline" className="mt-5" onClick={refresh}>
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </section>
      )}

      {!loading && data && status && (
        <div className="space-y-7">
          <section className="rounded-xl border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Lote auditado</p>
            <h2 className="mt-2 font-serif text-2xl">{data.lot.title}</h2>
          </section>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Total de lances</p>
              <p className="mt-2 font-serif text-3xl font-semibold">{data.bids.length}</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Lances conferidos</p>
              <p className="mt-2 font-serif text-3xl font-semibold">{data.integrity.checkedBids}</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Checkpoint externo</p>
              <p className="mt-2 font-serif text-3xl font-semibold">
                {data.integrity.checkpointSequence ?? '—'}
              </p>
            </div>
          </div>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border p-5 sm:p-6">
              <h2 className="flex items-center gap-3 font-serif text-2xl">
                <Gavel className="size-6 text-[#C6A15B]" />
                Histórico completo de lances
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Os lances aparecem em ordem cronológica.
              </p>
            </div>

            {data.bids.length === 0 ? (
              <div className="p-8 text-center">
                <Clock3 className="mx-auto size-9 text-muted-foreground" aria-hidden="true" />
                <p className="mt-4 font-semibold">Este lote ainda não recebeu lances</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  O histórico aparecerá aqui quando houver participações.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[580px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
                      <th scope="col" className="px-5 py-4 font-semibold">
                        #
                      </th>
                      <th scope="col" className="px-5 py-4 font-semibold">
                        Licitante
                      </th>
                      <th scope="col" className="px-5 py-4 font-semibold">
                        Valor do lance
                      </th>
                      <th scope="col" className="px-5 py-4 font-semibold">
                        Data e hora
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.bids.map((bid) => (
                      <tr key={bid.position}>
                        <td className="px-5 py-4">{bid.position}</td>
                        <td className="px-5 py-4 font-mono text-xs">
                          Participante {bid.participantCode}
                        </td>
                        <td className="px-5 py-4 font-semibold">
                          {formatCurrency(bid.amountInCents)}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {formatDate(bid.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section role="status" className={`rounded-xl border p-6 ${status.border}`}>
            <div className="flex items-start gap-3">
              {data.integrity.status === 'VALID' ? (
                <CheckCircle2
                  className="mt-1 size-7 shrink-0 text-[var(--success)]"
                  aria-hidden="true"
                />
              ) : (
                <AlertTriangle className="mt-1 size-7 shrink-0 text-[#C6A15B]" aria-hidden="true" />
              )}

              <div>
                <h2 className="font-serif text-2xl">{status.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{status.description}</p>
                <p className="mt-2 text-sm">{data.integrity.message}</p>
              </div>
            </div>
          </section>

          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-5">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#C6A15B]" aria-hidden="true" />

            <p className="text-sm leading-relaxed text-muted-foreground">
              A verificação compara o histórico com seus registros criptográficos e, quando
              disponível, com o checkpoint externo. Os identificadores dos licitantes são
              pseudônimos e não revelam seus dados pessoais.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
