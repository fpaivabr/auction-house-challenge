import { lazy, Suspense, useLayoutEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/layout/app-header';
import { AppFooter } from '@/components/layout/app-footer';
import { ProtectedRoute } from '@/features/auth/protected-route';
import { useTheme } from '@/hooks/use-theme';

import { HomePage } from '@/pages/home-page';

const LotDetailsPage = lazy(() =>
  import('@/pages/lot-details-page').then((module) => ({
    default: module.LotDetailsPage,
  })),
);

const AuthPage = lazy(() =>
  import('@/pages/auth-page').then((module) => ({
    default: module.AuthPage,
  })),
);

const AuctioneerPanelPage = lazy(() =>
  import('@/pages/auctioneer-panel-page').then((module) => ({
    default: module.AuctioneerPanelPage,
  })),
);

const CreateLotPage = lazy(() =>
  import('@/pages/create-lot-page').then((module) => ({
    default: module.CreateLotPage,
  })),
);

const WalletPage = lazy(() =>
  import('@/pages/wallet-page').then((module) => ({
    default: module.WalletPage,
  })),
);

const LogoutPage = lazy(() =>
  import('@/pages/logout-page').then((module) => ({
    default: module.LogoutPage,
  })),
);

const MyArrematesPage = lazy(() =>
  import('@/pages/my-arremates-page').then((module) => ({
    default: module.MyArrematesPage,
  })),
);

const ReceiptPage = lazy(() =>
  import('@/pages/receipt-page').then((module) => ({
    default: module.ReceiptPage,
  })),
);

const AuditPage = lazy(() =>
  import('@/pages/audit-page').then((module) => ({
    default: module.AuditPage,
  })),
);

type PlaceholderPageProps = {
  title: string;
  description: string;
};

function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start justify-center gap-5 px-4 py-20 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C6A15B]">
        Modern Auction
      </p>

      <h1 className="font-serif text-4xl sm:text-5xl">{title}</h1>

      <p className="max-w-xl text-muted-foreground">{description}</p>

      <Button asChild variant="outline">
        <Link to="/">
          Voltar aos leilões
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </section>
  );
}

function App() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader theme={theme} onToggleTheme={toggleTheme} />

      <Suspense
        fallback={
          <main
            role="status"
            className="mx-auto w-full max-w-7xl flex-1 px-4 py-16 text-muted-foreground"
          >
            Carregando página...
          </main>
        }
      >
        <Routes key={location.pathname}>
          <Route path="/" element={<HomePage />} />

          <Route path="/lotes/:id" element={<LotDetailsPage />} />

          <Route path="/login" element={<AuthPage mode="login" />} />

          <Route path="/cadastro" element={<AuthPage mode="register" />} />

          <Route path="/sair" element={<LogoutPage />} />

          <Route
            path="/carteira"
            element={
              <ProtectedRoute role="BIDDER">
                <WalletPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/arremates"
            element={
              <ProtectedRoute role="BIDDER">
                <MyArrematesPage />
              </ProtectedRoute>
            }
          />

          <Route path="/comprovantes/:token" element={<ReceiptPage />} />

          <Route
            path="/painel"
            element={
              <ProtectedRoute role="AUCTIONEER">
                <AuctioneerPanelPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/painel/lotes/novo"
            element={
              <ProtectedRoute role="AUCTIONEER">
                <CreateLotPage />
              </ProtectedRoute>
            }
          />

          <Route path="/lotes/:id/auditoria" element={<AuditPage />} />

          <Route
            path="*"
            element={
              <PlaceholderPage
                title="Página não encontrada"
                description="O endereço informado não corresponde a uma página da plataforma."
              />
            }
          />
        </Routes>
      </Suspense>

      <AppFooter />
    </div>
  );
}

export default App;
