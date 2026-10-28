import { Link } from 'react-router-dom';
import { Gavel } from 'lucide-react';

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-card print:hidden">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="flex items-center gap-2">
          <Gavel className="size-5 text-[#C6A15B]" aria-hidden="true" />
          <span className="text-sm font-semibold tracking-wide">MODERN AUCTION</span>
        </div>

        <p className="text-xs text-muted-foreground">Plataforma demonstrativa de leilões online.</p>

        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          Explorar leilões
        </Link>
      </div>
    </footer>
  );
}
