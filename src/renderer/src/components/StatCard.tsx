import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const TONES = {
  brand: 'bg-primary/10 text-primary',
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
} as const;

/** KPI tile: icon chip, label, big value, optional hint line / action slot. */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'brand',
  hint,
  loading,
  action,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  hint?: ReactNode;
  loading?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg', TONES[tone])}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          {action}
        </div>
        {loading ? <Skeleton className="mt-2 h-7 w-28" /> : <p className="mt-1 truncate text-2xl font-semibold tabular-nums">{value}</p>}
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
