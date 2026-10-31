import { useAuth } from '@/auth/AuthContext';
import { LoginForm } from './LoginForm';

export function LoginPage() {
  const { signIn } = useAuth();
  return (
    <div className="brand-gradient flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="brand-gradient px-8 py-8 text-center text-white">
          <h1 className="text-2xl font-semibold">ZAS Novo mesto</h1>
          <p className="mt-1 text-sm opacity-90">Sledenje izplačilom</p>
        </div>
        <div className="p-8">
          <LoginForm onSuccess={signIn} />
        </div>
      </div>
    </div>
  );
}
