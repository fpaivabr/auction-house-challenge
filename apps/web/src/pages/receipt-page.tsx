import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Copy,
  Gavel,
  Printer,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/features/lots/lots-api';
import { getReceipt, type AuctionReceipt } from '@/features/receipts/receipts-api';

export function ReceiptPage() {
  const { token } = useParams<{ token: string }>();

  const [receipt, setReceipt] = useState<AuctionReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    getReceipt(token, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;

        setReceipt(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;

        setError(
          cause instanceof Error ? cause.message : 'Não foi possível carregar o comprovante.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [token, reloadKey]);

  function retry() {
    setLoading(true);
    setError(null);
    setReloadKey((current) => current + 1);
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyFeedback('Link do comprovante copiado!');
    } catch {
      setCopyFeedback(
        'Não foi possível copiar automaticamente. Copie o endereço na barra do navegador.',
      );
    }
  }

  if (loading) {
    return (
      <main role="status" className="mx-auto w-full max-w-5xl flex-1 px-4 py-16">
        Carregando comprovante...
      </main>
    );
  }

  if (!receipt || error) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16">
        <h1 className="font-serif text-3xl">Comprovante indisponível</h1>

        <p role="alert" className="mt-4 text-sm text-destructive">
          {error ?? 'Não foi possível localizar o comprovante.'}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={retry}>
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>

          <Button asChild variant="outline">
            <Link to="/">Voltar aos leilões</Link>
          </Button>
        </div>
      </main>
    );
  }

  const isCompleted = receipt.status === 'COMPLETED';

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:px-8 print:max-w-none print:p-0">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to="/arremates"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Meus arremates
        </Link>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void handleCopyLink()}>
            {copyFeedback === 'Link do comprovante copiado!' ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
            {copyFeedback === 'Link do comprovante copiado!' ? 'Link copiado' : 'Copiar link'}
          </Button>

          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" />
            Imprimir ou salvar como PDF
          </Button>
        </div>
      </div>

      {copyFeedback && (
        <p role="status" className="mb-5 text-sm text-muted-foreground print:hidden">
          {copyFeedback}
        </p>
      )}

      <article className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10 print:rounded-none print:border-0 print:bg-white print:p-0 print:text-black print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-7">
          <div>
            <div className="flex items-center gap-2 text-[#C6A15B]">
              <Gavel className="size-6" aria-hidden="true" />
              <span className="text-sm font-semibold tracking-[0.12em]">MODERN AUCTION</span>
            </div>

            <h1 className="mt-7 font-serif text-3xl sm:text-4xl">Comprovante de arremate</h1>

            <p className="mt-2 text-sm text-muted-foreground">Operação financeira simulada</p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold">
            <ShieldCheck className="size-4 text-[#C6A15B]" />
            {isCompleted ? 'Liquidação concluída' : 'Liquidação revertida'}
          </div>
        </div>

        {!isCompleted && (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-destructive/30 p-4 text-sm text-destructive"
          >
            Esta operação foi revertida. O comprovante permanece disponível apenas para fins de
            histórico.
          </p>
        )}

        <div className="grid gap-7 py-8 sm:grid-cols-[140px_minmax(0,1fr)]">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-muted print:bg-white">
            {receipt.lot.imageUrl ? (
              <img
                src={receipt.lot.imageUrl}
                alt={receipt.lot.title}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <ReceiptText className="size-12 text-muted-foreground" aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Obra arrematada
            </p>

            <h2 className="mt-2 font-serif text-2xl">{receipt.lot.title}</h2>

            <p className="mt-5 text-sm text-muted-foreground">Valor final</p>

            <p className="mt-1 font-serif text-4xl font-semibold">
              {formatCurrency(receipt.amountInCents)}
            </p>
          </div>
        </div>

        <div className="grid gap-5 border-t border-border py-7 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Data da liquidação</p>
            <p className="mt-1 font-semibold">{formatDate(receipt.settledAt)}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Emissão do comprovante</p>
            <p className="mt-1 font-semibold">{formatDate(receipt.issuedAt)}</p>
          </div>
        </div>

        <div className="border-t border-border py-7">
          <p className="text-sm text-muted-foreground">Código de verificação do comprovante</p>

          <p className="mt-2 break-all font-mono text-sm font-medium">{receipt.token}</p>
        </div>

        <div className="border-t border-border pt-7">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Este documento comprova exclusivamente um arremate realizado em ambiente de
            demonstração, com créditos fictícios. Não representa pagamento real, nota fiscal ou
            comprovante bancário.
          </p>
        </div>
      </article>

      <p className="mt-6 text-center text-xs text-muted-foreground print:hidden">
        O comprovante pode ser consultado por meio deste endereço. Qualquer pessoa que possua o link
        poderá visualizar os dados públicos desta operação simulada.
      </p>
    </main>
  );
}
