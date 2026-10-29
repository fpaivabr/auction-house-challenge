import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Gavel, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LotCard } from '@/features/lots/lot-card';
import { getLots, type Lot, type LotStatus } from '@/features/lots/lots-api';
import { ArtShowcase } from '@/components/home/art-showcase';

type StatusFilter = 'ALL' | LotStatus;
type SortOrder = 'recent' | 'price-asc' | 'price-desc';

export function HomePage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [sort, setSort] = useState<SortOrder>('recent');

  useEffect(() => {
    const controller = new AbortController();

    getLots(controller.signal)
      .then(setLots)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os lotes.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey]);

  const filteredLots = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');

    return lots
      .filter((lot) => {
        const matchesSearch =
          lot.title.toLocaleLowerCase('pt-BR').includes(query) ||
          lot.description.toLocaleLowerCase('pt-BR').includes(query);

        return matchesSearch && (status === 'ALL' || lot.status === status);
      })
      .sort((a, b) => {
        if (sort === 'recent') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }

        const aPrice = BigInt(a.currentPriceInCents ?? a.initialPriceInCents);
        const bPrice = BigInt(b.currentPriceInCents ?? b.initialPriceInCents);

        if (aPrice === bPrice) return 0;

        const ascending = aPrice < bPrice ? -1 : 1;
        return sort === 'price-asc' ? ascending : -ascending;
      });
  }, [lots, search, status, sort]);

  function retry() {
    setError(null);
    setLoading(true);
    setReloadKey((value) => value + 1);
  }

  return (
    <main>
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2 lg:items-center lg:px-8">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#C6A15B]">
              Coleções e oportunidades
            </p>

            <h1 className="max-w-xl font-serif text-5xl leading-tight font-medium tracking-tight sm:text-6xl">
              Peças únicas.
              <span className="block text-primary">Novas histórias.</span>
            </h1>

            <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
              Entre obras marcantes e novas descobertas, encontre a arte que merece o seu próximo
              lance.
            </p>

            <Button asChild size="lg" className="brand-button">
              <a href="#lotes">
                Explorar leilões
                <ArrowRight className="size-4" />
              </a>
            </Button>
          </div>

          <ArtShowcase />
        </div>
      </section>

      <section
        id="lotes"
        className="mx-auto w-full max-w-7xl scroll-mt-24 px-4 py-14 sm:px-6 lg:px-8"
        aria-labelledby="catalog-title"
      >
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#C6A15B]">
            Catálogo
          </p>
          <h2 id="catalog-title" className="font-serif text-3xl sm:text-4xl">
            Explore os lotes
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Conheça os produtos disponíveis em nossos leilões.
          </p>
        </div>

        <div className="mb-8 grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_180px_190px]">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Pesquisar</span>
            <span className="flex items-center gap-2 rounded-md border border-input bg-background px-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome ou descrição"
                className="h-10 min-w-0 flex-1 outline-none"
              />
            </span>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <SlidersHorizontal className="size-4" /> Status
            </span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              className="h-10 rounded-md border border-input bg-background px-3"
            >
              <option value="ALL">Todos</option>
              <option value="OPEN">Em andamento</option>
              <option value="SCHEDULED">Agendados</option>
              <option value="CLOSED">Encerrados</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Ordenar por</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOrder)}
              className="h-10 rounded-md border border-input bg-background px-3"
            >
              <option value="recent">Mais recentes</option>
              <option value="price-asc">Menor preço</option>
              <option value="price-desc">Maior preço</option>
            </select>
          </label>
        </div>

        <div aria-live="polite">
          {loading ? (
            <div role="status" className="py-16 text-center text-muted-foreground">
              Carregando lotes...
            </div>
          ) : error ? (
            <div role="alert" className="rounded-xl border border-border bg-card p-10 text-center">
              <p className="mb-4">{error}</p>
              <Button onClick={retry} variant="outline">
                <RotateCcw className="size-4" /> Tentar novamente
              </Button>
            </div>
          ) : filteredLots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
              <Gavel className="mx-auto mb-4 size-8 text-muted-foreground" />
              <h3 className="text-lg font-semibold">
                {lots.length === 0
                  ? 'Ainda não há leilões publicados'
                  : 'Nenhum lote corresponde aos filtros'}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {lots.length === 0
                  ? 'Os lotes aparecerão aqui quando forem publicados.'
                  : 'Experimente alterar a pesquisa ou o status.'}
              </p>
            </div>
          ) : (
            <>
              <p className="mb-5 text-sm text-muted-foreground">
                {filteredLots.length} lote(s) encontrado(s)
              </p>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredLots.map((lot) => (
                  <LotCard key={lot.id} lot={lot} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
