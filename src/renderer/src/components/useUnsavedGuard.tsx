// Unsaved-changes guard for dialogs / sheets.
//
//   const { guard, dialog } = useUnsavedGuard(form.formState.isDirty);
//   <Sheet open={open} onOpenChange={(o) => (o ? setOpen(true) : guard(() => setOpen(false)))}>
//   ...
//   {dialog}   // render once next to the sheet
//
// guard(fn) runs fn immediately when the form is clean, otherwise asks first.

import { useCallback, useRef, useState, type ReactNode } from 'react';
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

export function useUnsavedGuard(dirty: boolean): { guard: (proceed: () => void) => void; dialog: ReactNode } {
  const [asking, setAsking] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const guard = useCallback(
    (proceed: () => void) => {
      if (!dirty) return proceed();
      pending.current = proceed;
      setAsking(true);
    },
    [dirty],
  );

  const dialog = (
    <AlertDialog open={asking} onOpenChange={setAsking}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Neshranjene spremembe</AlertDialogTitle>
          <AlertDialogDescription>Imate neshranjene spremembe. Ali jih želite zavreči?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Nadaljuj z urejanjem</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              const fn = pending.current;
              pending.current = null;
              fn?.();
            }}
          >
            Zavrzi
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { guard, dialog };
}
