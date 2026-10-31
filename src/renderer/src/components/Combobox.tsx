// Searchable single-select (popover + filter list). Diacritics-insensitive.
//   <Combobox value={id} onChange={setId} options={[{value:'1', label:'Ime', hint:'rang'}]} placeholder="Izberite…" />

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { normalize } from '@/lib/text';
import { cn } from '@/lib/utils';

export type ComboOption = { value: string; label: string; hint?: string };

export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Izberite…',
  searchPlaceholder = 'Iskanje…',
  emptyText = 'Ni zadetkov',
  id,
  disabled,
  invalid,
  className,
}: {
  value: string | null;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const n = normalize(q).trim();
    return n ? options.filter((o) => normalize(`${o.label} ${o.hint ?? ''}`).includes(n)) : options;
  }, [options, q]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0">
        <div className="relative border-b">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full bg-transparent pr-3 pl-9 text-sm outline-none"
          />
        </div>
        <ul className="max-h-60 overflow-y-auto p-1" role="listbox">
          {shown.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyText}</li>}
          {shown.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className="flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <Check className={cn('size-4 shrink-0', o.value === value ? 'opacity-100' : 'opacity-0')} />
              <span className="flex-1 truncate">{o.label}</span>
              {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
