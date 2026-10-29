import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Gavel,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Sun,
  Trophy,
  UserRound,
  Wallet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useAuth } from '@/features/auth/use-auth';
import type { Theme } from '@/hooks/use-theme';

type AppHeaderProps = {
  theme: Theme;
  onToggleTheme: () => void;
};

export function AppHeader({ theme, onToggleTheme }: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const isAuctioneer = user?.role === 'AUCTIONEER';
  const accountDestination = isAuctioneer ? '/painel' : '/carteira';
  const accountLabel = isAuctioneer ? 'Meu painel' : 'Minha carteira';

  function handleLogout() {
    setMenuOpen(false);
    navigate('/sair');
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  function navClass(isActive: boolean) {
    return `text-sm transition-colors hover:text-foreground ${
      isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'
    }`;
  }

  const themeLabel = theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro';

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          aria-label="Modern Auction — página inicial"
          className="flex min-w-0 shrink-0 items-center gap-2.5"
        >
          <span className="brand-metal-emblem flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#C6A15B]/50 text-[#C6A15B]">
            <Gavel className="size-5" aria-hidden="true" />
          </span>

          <span className="brand-wordmark hidden truncate text-lg min-[380px]:inline sm:text-xl">
            Modern <span className="brand-wordmark-art">Art</span> Auction
          </span>
        </Link>

        <div className="hidden min-w-0 items-center gap-4 lg:flex">
          {!loading && user && (
            <nav aria-label="Navegação principal" className="flex items-center gap-5 xl:gap-6">
              <NavLink to="/" end className={({ isActive }) => navClass(isActive)}>
                Leilões
              </NavLink>

              {user.role === 'BIDDER' && (
                <NavLink to="/arremates" className={({ isActive }) => navClass(isActive)}>
                  Meus arremates
                </NavLink>
              )}

              <NavLink to={accountDestination} className={({ isActive }) => navClass(isActive)}>
                {accountLabel}
              </NavLink>
            </nav>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            aria-label={themeLabel}
            title={themeLabel}
          >
            {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>

          {!loading &&
            (user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <UserRound className="size-4" />
                    Minha conta
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <span className="block truncate">{user.name}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      {user.email}
                    </span>
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onSelect={handleLogout}>
                    <LogOut className="size-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="outline" asChild>
                  <Link to="/login">Entrar</Link>
                </Button>

                <Button asChild className="brand-button">
                  <Link to="/cadastro">
                    Criar conta
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </>
            ))}
        </div>

        <div className="flex shrink-0 items-center gap-1 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            aria-label={themeLabel}
            title={themeLabel}
          >
            {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>

          {!loading &&
            (user ? (
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Abrir menu">
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>

                <SheetContent side="right" className="w-[min(85vw,320px)]">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <Gavel className="size-5 text-[#C6A15B]" />
                      Modern Auction
                    </SheetTitle>
                    <SheetDescription>Navegação da plataforma</SheetDescription>
                  </SheetHeader>

                  <nav aria-label="Navegação mobile" className="flex flex-col gap-2 px-4">
                    <Link
                      to="/"
                      onClick={closeMenu}
                      className="flex items-center gap-2 rounded-md px-3 py-3 text-sm font-medium hover:bg-accent"
                    >
                      <Gavel className="size-4" />
                      Leilões
                    </Link>

                    {user.role === 'BIDDER' && (
                      <Link
                        to="/arremates"
                        onClick={closeMenu}
                        className="flex items-center gap-2 rounded-md px-3 py-3 text-sm hover:bg-accent"
                      >
                        <Trophy className="size-4" />
                        Meus arremates
                      </Link>
                    )}

                    <Link
                      to={accountDestination}
                      onClick={closeMenu}
                      className="flex items-center gap-2 rounded-md px-3 py-3 text-sm hover:bg-accent"
                    >
                      {isAuctioneer ? (
                        <LayoutDashboard className="size-4" />
                      ) : (
                        <Wallet className="size-4" />
                      )}
                      {accountLabel}
                    </Link>

                    <div className="my-2 border-t border-border" />

                    <p className="px-3 text-xs text-muted-foreground">{user.name}</p>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center gap-2 rounded-md px-3 py-3 text-left text-sm hover:bg-accent"
                    >
                      <LogOut className="size-4" />
                      Sair
                    </button>
                  </nav>
                </SheetContent>
              </Sheet>
            ) : (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/login">Entrar</Link>
                </Button>

                <Button asChild size="sm" className="brand-button hidden sm:inline-flex">
                  <Link to="/cadastro">Criar conta</Link>
                </Button>
              </>
            ))}
        </div>
      </div>
    </header>
  );
}
