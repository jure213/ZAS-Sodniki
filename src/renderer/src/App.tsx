import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'sonner';
import { useAuth, useIsAdmin } from '@/auth/AuthContext';
import { AppShell } from '@/components/AppShell';
import { SessionExpiredDialog } from '@/components/SessionExpiredDialog';
import { UpdaterDialog } from '@/components/UpdaterDialog';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { OfficialsPage } from '@/pages/officials/OfficialsPage';
import { Placeholder } from '@/pages/Placeholder';

function AdminOnly({ children }: { children: React.ReactNode }) {
  return useIsAdmin() ? <>{children}</> : <Navigate to="/dashboard" replace />;
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
              <Route path="/competitions" element={<Placeholder title="Tekmovanja" />} />
              <Route path="/payments" element={<Placeholder title="Izplačila" />} />
              <Route path="/exports" element={<Placeholder title="Izpisi" />} />
              <Route path="/settings" element={<AdminOnly><Placeholder title="Nastavitve" /></AdminOnly>} />
              <Route path="/users" element={<AdminOnly><Placeholder title="Uporabniki" /></AdminOnly>} />
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
