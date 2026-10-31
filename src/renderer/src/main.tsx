// Must stay first: configures zod (jitless) before any schema is created.
import './zod-setup';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { toastError } from '@/lib/api';
import { AuthProvider } from '@/auth/AuthContext';
import { App } from './App';
import './styles.css';

// Mutation errors are toasted here (Slovenian message from main) unless meta.silent.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 } },
  mutationCache: new MutationCache({
    onError: (error, _v, _c, mutation) => {
      if (!mutation.meta?.silent) toastError(error);
    },
  }),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider delayDuration={300}>
          <App />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
