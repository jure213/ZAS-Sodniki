import { useAuth } from '@/auth/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoginForm } from '@/pages/LoginForm';

/** Login over the current route when the server rejects the token. */
export function SessionExpiredDialog() {
  const { expired, signIn } = useAuth();
  return (
    <Dialog open={expired}>
      <DialogContent
        showClose={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Seja je potekla</DialogTitle>
          <DialogDescription>Prijavite se znova, da nadaljujete z delom.</DialogDescription>
        </DialogHeader>
        <LoginForm idPrefix="expired" onSuccess={signIn} />
      </DialogContent>
    </Dialog>
  );
}
