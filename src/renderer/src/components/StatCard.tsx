import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Same icon gradients as the v1 dashboard (white icon on a gradient square).
const TONES = {
  brand: 'linear-gradient(135deg, #072b74 0%, #898dbb 100%)',
  pink: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  green: 'linear-gradient(135deg, #196905 0%, #82e2a2 100%)',
  red: 'linear-gradient(135deg, #ee0d0d 0%, #be6363 100%)',
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
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ backgroundImage: TONES[tone] }}>
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
