import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { createLot, searchProducts, type ExternalProduct } from '@/features/lots/auctioneer-api';

function toCents(value: string): number {
  const amount = Number(value.replace(',', '.'));

  return Math.round(amount * 100);
}

export function CreateLotPage() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<ExternalProduct[]>([]);
  const [selected, setSelected] = useState<ExternalProduct | null>(null);
  const [initialPrice, setInitialPrice] = useState('');
  const [increment, setIncrement] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const timeout = window.setTimeout(() => {
      setLoadingProducts(true);

      searchProducts(search)
        .then((response) => {
          if (active) setProducts(response.products);
        })
        .catch((cause: unknown) => {
          if (active) {
            setError(cause instanceof Error ? cause.message : 'Erro ao pesquisar produtos.');
          }
        })
        .finally(() => {
          if (active) setLoadingProducts(false);
        });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [search]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selected || submitting) return;

    const priceInCents = toCents(initialPrice);
    const incrementInCents = toCents(increment);

    if (
      !Number.isSafeInteger(priceInCents) ||
      !Number.isSafeInteger(incrementInCents) ||
      priceInCents <= 0 ||
      incrementInCents <= 0 ||
      priceInCents > 1_000_000_000 ||
      incrementInCents > 1_000_000_000
    ) {
      setError('Informe valores válidos, maiores que zero.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createLot(token, {
        productId: selected.id,
        initialPriceInCents: priceInCents,
        minimumIncrementInCents: incrementInCents,
      });

      navigate('/painel', { replace: true });
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o lote.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <Link
        to="/painel"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar ao painel
      </Link>

      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#C6A15B]">
          Painel do leiloeiro
        </p>
        <h1 className="font-serif text-4xl">Criar novo lote</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha uma obra do acervo, configure os valores e salve um rascunho. A publicação será
          feita pelo painel.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="rounded-xl border border-border bg-card p-5 sm:p-7">
          <h2 className="mb-5 text-xl font-semibold">1. Selecionar produto</h2>

          <label className="mb-5 block space-y-2 text-sm">
            <span className="font-medium">Pesquisar no acervo do Cleveland Museum of Art</span>
            <span className="flex items-center gap-2 rounded-md border border-input bg-background px-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setError(null);
                }}
                placeholder="Ex.: Monet, Van Gogh, painting, sculpture..."
                className="h-11 min-w-0 flex-1 outline-none"
              />
            </span>
          </label>

          {loadingProducts ? (
            <p role="status" className="text-sm text-muted-foreground">
              Buscando produtos...
            </p>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>
          ) : (
            <div className="grid max-h-96 gap-3 overflow-y-auto sm:grid-cols-2">
              {products.map((product) => {
                const isSelected = selected?.id === product.id;

                return (
                  <button
                    key={product.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelected(product)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      isSelected ? 'border-[#C6A15B] bg-accent' : 'border-border hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {product.thumbnail ? (
                        <img
                          src={product.thumbnail}
                          alt=""
                          className="size-full object-contain"
                          loading="lazy"
                        />
                      ) : null}
                    </div>

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{product.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Obra #{product.id}
                      </span>
                    </span>

                    {isSelected && (
                      <Check className="size-5 shrink-0 text-[#C6A15B]" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5 sm:p-7">
          <h2 className="mb-5 text-xl font-semibold">2. Configurar valores</h2>

          {selected && (
            <p className="mb-5 rounded-lg bg-accent p-3 text-sm">
              Produto selecionado: <strong>{selected.title}</strong>
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block space-y-2 text-sm">
              <span className="font-medium">Preço inicial (R$)</span>
              <input
                type="number"
                min="0.01"
                max="10000000"
                step="0.01"
                required
                value={initialPrice}
                onChange={(event) => setInitialPrice(event.target.value)}
                placeholder="100.00"
                className="h-11 w-full rounded-md border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            <label className="block space-y-2 text-sm">
              <span className="font-medium">Incremento mínimo (R$)</span>
              <input
                type="number"
                min="0.01"
                max="10000000"
                step="0.01"
                required
                value={increment}
                onChange={(event) => setIncrement(event.target.value)}
                placeholder="10.00"
                className="h-11 w-full rounded-md border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>
        </section>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" className="brand-button" disabled={!selected || submitting}>
            {submitting ? 'Salvando...' : 'Salvar rascunho'}
          </Button>

          <Button asChild type="button" variant="outline">
            <Link to="/painel">Cancelar</Link>
          </Button>
        </div>
      </form>
    </main>
  );
}
