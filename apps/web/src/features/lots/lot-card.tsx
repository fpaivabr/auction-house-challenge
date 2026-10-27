import { ArrowUpRight, CalendarClock, Gavel } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatCurrency, formatDate, lotStatusLabel, type Lot } from './lots-api';

type LotCardProps = {
  lot: Lot;
};

export function LotCard({ lot }: LotCardProps) {
  const price = lot.currentPriceInCents ?? lot.initialPriceInCents;

  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:-translate-y-1 hover:border-[#C6A15B]/60 hover:shadow-lg">
      <Link
        to={`/lotes/${lot.id}`}
        className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label={`Ver detalhes de ${lot.title}`}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {lot.imageUrl ? (
            <img
              src={lot.imageUrl}
              alt={lot.title}
              loading="lazy"
              className="size-full object-contain p-5 transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Gavel className="size-12 text-muted-foreground/50" />
            </div>
          )}

          <span
            className={`absolute top-4 left-4 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
              lot.status === 'OPEN'
                ? 'bg-[#237348] text-white'
                : lot.status === 'SCHEDULED'
                  ? 'bg-[#C6A15B] text-[#1F1E1C]'
                  : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {lotStatusLabel[lot.status]}
          </span>
        </div>

        <div className="space-y-4 p-5">
          <h3 className="line-clamp-2 min-h-12 text-lg leading-6 font-semibold">{lot.title}</h3>

          <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{lot.description}</p>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              {lot.currentPriceInCents ? 'Lance atual' : 'Preço inicial'}
            </p>

            <p className="mt-1 font-serif text-2xl font-semibold">{formatCurrency(price)}</p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="size-4 shrink-0" />
              {formatDate(lot.endsAt)}
            </span>

            <ArrowUpRight className="size-5 shrink-0 text-[#C6A15B]" aria-hidden="true" />
          </div>
        </div>
      </Link>
    </article>
  );
}
