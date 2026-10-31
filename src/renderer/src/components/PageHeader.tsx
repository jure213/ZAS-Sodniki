import { useEffect, type ReactNode } from 'react';

/** Page title row; also sets document.title. `actions` are right-aligned buttons. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} – ZAS Sodniki`;
  }, [title]);
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
