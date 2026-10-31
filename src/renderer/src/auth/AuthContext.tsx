import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AppUser } from '@shared/ipc';
import { call } from '@/lib/ipc';

type Status = 'loading' | 'out' | 'in';

type AuthState = {
  status: Status;
  user: AppUser | null;
  /** True when the server rejected the token while the user was working. */
  expired: boolean;
  signIn: (user: AppUser) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AppUser | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    call('auth:restoreSession')
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setStatus(u ? 'in' : 'out');
      })
      .catch(() => !cancelled && setStatus('out'));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () =>
      window.api.on('auth:expired', () => {
        setExpired(true);
      }),
    [],
  );

  const signIn = useCallback(
    (next: AppUser) => {
      // A different user must never see the previous user's cached data.
      setUser((prev) => {
        if (!prev || prev.id !== next.id) queryClient.clear();
        else void queryClient.invalidateQueries();
        return next;
      });
      setExpired(false);
      setStatus('in');
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      await call('auth:logout');
    } finally {
      queryClient.clear();
      setUser(null);
      setExpired(false);
      setStatus('out');
    }
  }, [queryClient]);

  const value = useMemo(() => ({ status, user, expired, signIn, signOut }), [status, user, expired, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function useIsAdmin(): boolean {
  return useAuth().user?.role === 'admin';
}
