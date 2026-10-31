// Status badges shared by several pages.

import { STATUS_LABELS } from '@shared/labels';
import type { CompetitionStatus } from '@shared/tariff';
import type { PaymentStatus } from '@shared/types';
import { Badge } from '@/components/ui/badge';

const COMP_VARIANT = {
  planned: 'default',
  completed: 'success',
  cancelled: 'destructive',
  free: 'secondary',
  other_zas: 'secondary',
} as const;

/** Competition status (Načrtovano / Izvedeno / ...). */
export function CompetitionStatusBadge({ status }: { status: CompetitionStatus }) {
  return <Badge variant={COMP_VARIANT[status] ?? 'outline'}>{STATUS_LABELS[status] ?? status}</Badge>;
}

const PAY: Record<PaymentStatus, { label: string; variant: 'destructive' | 'warning' | 'success' }> = {
  owed: { label: 'Neplačano', variant: 'destructive' },
  partial: { label: 'Delno plačano', variant: 'warning' },
  paid: { label: 'Plačano', variant: 'success' },
};

/** Payment status; null payment means no payment generated yet. */
export function PaymentStatusBadge({ status }: { status: PaymentStatus | null | undefined }) {
  if (!status) return <Badge variant="outline">Brez izplačila</Badge>;
  const p = PAY[status];
  return <Badge variant={p.variant}>{p.label}</Badge>;
}
