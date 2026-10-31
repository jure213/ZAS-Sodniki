import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Centered icon + title + optional description/action, for empty lists. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-6 py-12 text-center', className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Shown when a query failed; message comes from main (Slovenian). */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Podatkov ni bilo mogoče naložiti"
      description={errorMessage(error)}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Poskusi znova
          </Button>
        ) : undefined
      }
    />
  );
}
