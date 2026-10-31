import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthContext';
import { call } from '@/lib/ipc';
import { LoginForm } from './LoginForm';

export function LoginPage() {
  const { signIn } = useAuth();
  // Same query key as the sidebar, so the value is fetched once and shared.
  const version = useQuery({ queryKey: ['app', 'version'], queryFn: () => call('app:getVersion'), staleTime: Infinity });
  return (
    <div className="brand-gradient flex min-h-full flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="brand-gradient px-8 py-8 text-center text-white">
          <h1 className="text-2xl font-semibold">ZAS Novo mesto</h1>
          <p className="mt-1 text-sm opacity-90">Sledenje izplačilom</p>
        </div>
        <div className="p-8">
          <LoginForm onSuccess={signIn} />
        </div>
      </div>
      {version.data && <p className="mt-4 text-xs text-white/70">Verzija {version.data}</p>}
    </div>
  );
}
