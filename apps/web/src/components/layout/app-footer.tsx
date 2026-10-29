import { ArrowUp, Gavel } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AppFooter() {
  function scrollToTop() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.scrollTo({
      top: 0,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }

  return (
    <footer className="mt-auto border-t border-border bg-card print:hidden">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-x-4 gap-y-4 px-4 py-8 sm:px-6 md:grid-cols-[1fr_auto_1fr] lg:px-8">
        <div className="col-start-1 row-start-1 flex items-center gap-2">
          <span className="brand-metal-emblem flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#C6A15B]/50 text-[#C6A15B]">
            <Gavel className="size-[18px]" aria-hidden="true" />
          </span>

          <span className="brand-wordmark text-base lg:text-lg">
            Modern <span className="brand-wordmark-art">Art</span> Auction
          </span>
        </div>

        <p className="col-span-2 row-start-2 text-center text-xs text-muted-foreground md:col-span-1 md:col-start-2 md:row-start-1">
          Plataforma demonstrativa de leilões online.
        </p>

        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Voltar ao topo"
          title="Voltar ao topo"
          onClick={scrollToTop}
          className="col-start-2 row-start-1 size-10 justify-self-end border-[#C6A15B]/50 hover:bg-accent md:col-start-3"
        >
          <ArrowUp className="size-5 text-[#8A6826] dark:text-[#C6A15B]" aria-hidden="true" />
        </Button>
      </div>
    </footer>
  );
}
