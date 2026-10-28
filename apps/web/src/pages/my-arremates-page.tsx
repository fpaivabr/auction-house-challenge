import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Gavel, ReceiptText, RefreshCw, Trophy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { formatCurrency, formatDate } from '@/features/lots/lots-api';
import { getMyReceipts, type AuctionReceipt } from '@/features/receipts/receipts-api';

export function MyArrematesPage() {
  const { token } = useAuth();

  const [receipts, setReceipts] = useState<AuctionReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) return;

    let active = true;

    getMyReceipts(token)
      .then((result) => {
        if (!active) return;

        setReceipts(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;

        setError(
          cause instanceof Error ? cause.message : 'Não foi possível carregar seus arremates.',
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

        <h1 className="font-serif text-4xl">Meus arremates</h1>

        <p className="mt-3 max-w-2xl text-muted-foreground">
          Consulte as obras que você venceu, os valores pagos com créditos simulados e seus
          comprovantes.
        </p>
      </div>

      {loading && (
        <p role="status" className="text-muted-foreground">
          Carregando seus arremates...
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

      {!loading && !error && receipts.length === 0 && (
        <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center sm:p-12">
          <Trophy className="mx-auto mb-5 size-12 text-[#C6A15B]" aria-hidden="true" />

          <h2 className="font-serif text-2xl">Nenhum arremate confirmado</h2>

          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Quando você vencer um leilão e o pagamento simulado for concluído, a obra e seu
            comprovante aparecerão aqui. Lances em andamento ainda não são arremates.
          </p>

          <Button asChild className="brand-button mt-6">
            <Link to="/">Explorar leilões</Link>
          </Button>
        </section>
      )}

      {!loading && !error && receipts.length > 0 && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {receipts.length} arremate(s) encontrado(s)
          </p>

          {receipts.map((receipt) => (
            <article
              key={receipt.token}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
                <div className="flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted sm:size-40">
                  {receipt.lot.imageUrl ? (
                    <img
                      src={receipt.lot.imageUrl}
                      alt={receipt.lot.title}
                      className="max-h-full max-w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <Gavel className="size-10 text-muted-foreground" aria-hidden="true" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <span className="inline-flex rounded-full border border-[#C6A15B]/40 bg-[#C6A15B]/10 px-3 py-1 text-xs font-semibold">
                    Arremate concluído
                  </span>

                  <h2 className="mt-3 text-xl font-semibold">{receipt.lot.title}</h2>

                  <p className="mt-4 text-sm text-muted-foreground">Valor final do arremate</p>

                  <p className="mt-1 font-serif text-3xl font-semibold">
                    {formatCurrency(receipt.amountInCents)}
                  </p>

                  <p className="mt-3 text-sm text-muted-foreground">
                    Concluído em {formatDate(receipt.settledAt)}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button asChild className="brand-button">
                      <Link to={`/comprovantes/${receipt.token}`}>
                        <ReceiptText className="size-4" />
                        Ver comprovante
                      </Link>
                    </Button>

                    <Button asChild variant="outline">
                      <Link to={`/lotes/${receipt.lot.id}`}>
                        Ver obra
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
        Esta plataforma é demonstrativa. Os valores exibidos representam operações financeiras
        simuladas.
      </p>
    </main>
  );
}
