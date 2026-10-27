import { Link, Route, Routes } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/layout/app-header';
import { AppFooter } from '@/components/layout/app-footer';
import { useTheme } from '@/hooks/use-theme';

import { HomePage } from '@/pages/home-page';
import { LotDetailsPage } from '@/pages/lot-details-page';

import { AuthPage } from '@/pages/auth-page';
import { ProtectedRoute } from '@/features/auth/protected-route';

import { AuctioneerPanelPage } from '@/pages/auctioneer-panel-page';
import { CreateLotPage } from '@/pages/create-lot-page';
import { WalletPage } from '@/pages/wallet-page';

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

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader theme={theme} onToggleTheme={toggleTheme} />

      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route path="/lotes/:id" element={<LotDetailsPage />} />

        <Route path="/login" element={<AuthPage mode="login" />} />

        <Route path="/cadastro" element={<AuthPage mode="register" />} />

        <Route
          path="/carteira"
          element={
            <ProtectedRoute role="BIDDER">
              <WalletPage />
            </ProtectedRoute>
          }
        />

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

        <Route
          path="/painel/auditoria"
          element={
            <ProtectedRoute role="AUCTIONEER">
              <PlaceholderPage
                title="Auditoria"
                description="Verificação da integridade do histórico de lances."
              />
            </ProtectedRoute>
          }
        />

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

      <AppFooter />
    </div>
  );
}

export default App;
