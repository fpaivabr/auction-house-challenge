import { useEffect, type RefObject } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useBlocker } from 'react-router-dom';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type UnsavedChangesGuardProps = {
  dirty: boolean;
  allowNavigationRef: RefObject<boolean>;
};

export function UnsavedChangesGuard({ dirty, allowNavigationRef }: UnsavedChangesGuardProps) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !allowNavigationRef.current && currentLocation.pathname !== nextLocation.pathname,
  );

  const isLoggingOut = blocker.state === 'blocked' && blocker.location.pathname === '/sair';

  useEffect(() => {
    if (!dirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (allowNavigationRef.current) return;

      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [dirty, allowNavigationRef]);

  return (
    <AlertDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => {
        if (!open && blocker.state === 'blocked') {
          blocker.reset();
        }
      }}
    >
      <AlertDialogContent className="max-w-md border-border bg-card text-card-foreground">
        <AlertDialogHeader>
          <div className="mb-3 flex size-12 items-center justify-center rounded-full border border-[#C6A15B]/40 bg-[#C6A15B]/10">
            <AlertTriangle className="size-6 text-[#C6A15B]" />
          </div>

          <AlertDialogTitle className="font-serif text-2xl">
            {isLoggingOut ? 'Sair da conta sem salvar?' : 'Sair sem salvar?'}
          </AlertDialogTitle>

          <AlertDialogDescription className="pt-2 leading-relaxed">
            Você possui alterações que ainda não foram salvas. Se sair agora, essas informações
            serão perdidas.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-5 gap-2 sm:gap-2">
          <AlertDialogCancel
            onClick={() => {
              if (blocker.state === 'blocked') {
                blocker.reset();
              }
            }}
          >
            Continuar editando
          </AlertDialogCancel>

          <AlertDialogAction
            className="bg-[#7A2234] text-white hover:bg-[#681C2B]"
            onClick={() => {
              if (blocker.state === 'blocked') {
                blocker.proceed();
              }
            }}
          >
            {isLoggingOut ? 'Sair da conta' : 'Sair sem salvar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
