import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { Toaster } from 'sonner';
import { useAuth, useIsAdmin } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/AppShell';
import { SessionExpiredDialog } from '@/components/SessionExpiredDialog';
import { UpdaterDialog } from '@/components/UpdaterDialog';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { OfficialsPage } from '@/pages/officials/OfficialsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { UsersPage } from '@/pages/users/UsersPage';
import { CompetitionDetailPage } from '@/pages/competitions/CompetitionDetailPage';
import { CompetitionsPage } from '@/pages/competitions/CompetitionsPage';
import { PaymentsPage } from '@/pages/payments/PaymentsPage';
import { ExportsPage } from '@/pages/exports/ExportsPage';

function AdminOnly({ children }: { children: React.ReactNode }) {
  return useIsAdmin() ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

/** Remembered session, but the server is unreachable: keep the session and offer a retry. */
function OfflineScreen() {
  const { retryRestore, goToLogin } = useAuth();
  return (
    <div className="brand-gradient flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 text-center shadow-2xl">
        <WifiOff className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-semibold">Strežnik ni dosegljiv</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Preverite internetno povezavo. Prijava je shranjena, zato se po vzpostavitvi povezave ni treba
          znova prijaviti.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={retryRestore}>
            <RefreshCw /> Poskusi znova
          </Button>
          <Button variant="ghost" onClick={goToLogin}>
            Na prijavo
          </Button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (status === 'offline') return <OfflineScreen />;

  return (
    <>
      {status === 'out' ? (
        <LoginPage />
      ) : (
        <HashRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/officials" element={<OfficialsPage />} />
              <Route path="/competitions" element={<CompetitionsPage />} />
              <Route path="/competitions/:id" element={<CompetitionDetailPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/exports" element={<ExportsPage />} />
              <Route path="/settings" element={<AdminOnly><SettingsPage /></AdminOnly>} />
              <Route path="/users" element={<AdminOnly><UsersPage /></AdminOnly>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
          <SessionExpiredDialog />
          <UpdaterDialog />
        </HashRouter>
      )}
      <Toaster richColors position="top-right" />
    </>
  );
}
