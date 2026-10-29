import { useEffect, useState } from 'react';
import { Gavel } from 'lucide-react';

import './art-showcase.css';

type FeaturedArtwork = {
  id: number;
  title: string;
  imageUrl: string;
};

type CatalogArtwork = {
  id: number;
  title: string;
  thumbnail?: string | null;
  images?: string[];
};

type CatalogResponse = {
  products: CatalogArtwork[];
};

const SLIDE_INTERVAL_MS = 5000;
const MAX_FEATURED_ARTWORKS = 6;

/**
 * Galeria decorativa: usa o endpoint público de imagens CC0 do acervo.
 * As obras exibidas aqui não representam necessariamente lotes publicados.
 */
export function ArtShowcase() {
  const [artworks, setArtworks] = useState<FeaturedArtwork[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadArtworks() {
      try {
        const response = await fetch('/api/products?search=painting', {
          signal: controller.signal,
        });

        if (!response.ok) return;

        const data = (await response.json()) as CatalogResponse;
        if (!Array.isArray(data.products)) return;

        const uniqueImages = new Set<string>();
        const selected: FeaturedArtwork[] = [];

        for (const artwork of data.products) {
          const imageUrl = artwork.thumbnail ?? artwork.images?.[0];
          if (!imageUrl || !imageUrl.startsWith('https://') || uniqueImages.has(imageUrl)) {
            continue;
          }

          uniqueImages.add(imageUrl);
          selected.push({ id: artwork.id, title: artwork.title, imageUrl });

          if (selected.length === MAX_FEATURED_ARTWORKS) break;
        }

        if (!controller.signal.aborted) {
          setArtworks(selected);
          setActiveIndex(0);
        }
      } catch {
        // Se o museu estiver indisponível, a apresentação mantém o fundo estático.
      }
    }

    void loadArtworks();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (artworks.length < 2) return;

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % artworks.length);
    }, SLIDE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [artworks.length]);

  return (
    <div className="art-showcase relative isolate flex min-h-84 items-center justify-center overflow-hidden rounded-2xl border border-border sm:min-h-96">
      <div className="absolute inset-0" aria-hidden="true">
        {artworks.map((artwork, index) => (
          <img
            key={artwork.id}
            src={artwork.imageUrl}
            alt=""
            loading={index < 2 ? 'eager' : 'lazy'}
            decoding="async"
            className="art-showcase__painting absolute inset-0 size-full object-cover"
            style={{ opacity: index === activeIndex ? 1 : 0 }}
            onError={() => {
              setArtworks((current) => current.filter((item) => item.id !== artwork.id));
              setActiveIndex(0);
            }}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-black/20" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-5 rounded-xl border border-[#C6A15B]/40 sm:inset-6"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-6 flex w-full max-w-108 flex-col items-center gap-5 rounded-xl border border-[#C6A15B]/35 bg-[#161719]/72 px-3 py-7 text-center shadow-2xl backdrop-blur-[3px] sm:px-6 sm:py-9">
        <div className="brand-metal-emblem art-showcase__coin flex size-20 items-center justify-center rounded-full border border-[#C6A15B]/70 text-[#D7AD61]">
          <Gavel className="relative z-10 size-9" aria-hidden="true" />
        </div>

        <div className="flex w-full flex-col items-center gap-3">
          <p className="art-showcase__wordmark text-[#F9F3EB]" aria-label="Modern Art Auction">
            <span className="art-showcase__main-word">Modern</span>
            <span className="art-showcase__art-word">
              <span>Art</span>
            </span>
            <span className="art-showcase__main-word">Auction</span>
          </p>

          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#F2E0CA] sm:text-xs sm:tracking-[0.25em]">
            Plataforma de leilões
          </p>
        </div>
      </div>
    </div>
  );
}
