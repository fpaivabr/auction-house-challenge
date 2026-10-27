import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Gavel,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Sun,
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
  const { user, loading, signOut } = useAuth();

  const isAuctioneer = user?.role === 'AUCTIONEER';
  const accountDestination = isAuctioneer ? '/painel' : '/carteira';
  const accountLabel = isAuctioneer ? 'Meu painel' : 'Minha carteira';

  function handleLogout() {
    signOut();
    setMenuOpen(false);
    navigate('/');
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
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          aria-label="Modern Auction — página inicial"
          className="flex min-w-0 items-center gap-2.5"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#C6A15B]/50 text-[#C6A15B]">
            <Gavel className="size-5" aria-hidden="true" />
          </span>

          <span className="truncate text-sm font-semibold tracking-[0.13em] sm:text-base">
            MODERN AUCTION
          </span>
        </Link>

        <nav aria-label="Navegação principal" className="hidden items-center gap-6 md:flex">
          <NavLink to="/" end className={({ isActive }) => navClass(isActive)}>
            Leilões
          </NavLink>

          {!loading && user && (
            <NavLink to={accountDestination} className={({ isActive }) => navClass(isActive)}>
              {accountLabel}
            </NavLink>
          )}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
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

                  <DropdownMenuItem onSelect={() => navigate(accountDestination)}>
                    {isAuctioneer ? (
                      <LayoutDashboard className="size-4" />
                    ) : (
                      <Wallet className="size-4" />
                    )}
                    {accountLabel}
                  </DropdownMenuItem>

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

        <div className="flex items-center gap-1 md:hidden">
          <Button variant="ghost" size="icon" onClick={onToggleTheme} aria-label={themeLabel}>
            {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>

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
                  className="rounded-md px-3 py-3 text-sm font-medium hover:bg-accent"
                >
                  Leilões
                </Link>

                {!loading &&
                  (user ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      <div className="my-2 border-t border-border" />

                      <Link
                        to="/login"
                        onClick={closeMenu}
                        className="flex items-center gap-2 rounded-md px-3 py-3 text-sm hover:bg-accent"
                      >
                        <LogIn className="size-4" />
                        Entrar
                      </Link>

                      <Button asChild className="brand-button">
                        <Link to="/cadastro" onClick={closeMenu}>
                          Criar conta
                        </Link>
                      </Button>
                    </>
                  ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
