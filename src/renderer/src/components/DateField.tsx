// Date input. Value is an ISO "YYYY-MM-DD" string ('' when empty). The user types
// "dd.mm.yyyy" (or uses the calendar button -> native picker). No Date objects
// are created from ISO strings, so there is no UTC off-by-one.

import { useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { formatDate, parseDisplayDate } from '@shared/dates';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  onChange: (iso: string) => void;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  onBlur?: () => void;
};

export function DateField({ value, onChange, id, disabled, invalid, className, onBlur }: Props) {
  const [text, setText] = useState(formatDate(value));
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText((prev) => (parseDisplayDate(prev) === value || (value === '' && prev.trim() === '') ? prev : formatDate(value)));
  }, [value]);

  const bad = invalid || (text.trim() !== '' && parseDisplayDate(text) == null);

  return (
    <div className="relative">
      <Input
        id={id}
        disabled={disabled}
        placeholder="dd.mm.llll"
        value={text}
        aria-invalid={bad || undefined}
        className={cn('pr-10', bad && 'border-destructive', className)}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value.trim() === '' ? '' : (parseDisplayDate(e.target.value) ?? 'invalid'));
        }}
        onBlur={() => {
          const iso = parseDisplayDate(text);
          if (iso) setText(formatDate(iso));
          onBlur?.();
        }}
      />
      <button
        type="button"
        disabled={disabled}
        tabIndex={-1}
        aria-label="Izberi datum"
        className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
        onClick={() => picker.current?.showPicker?.()}
      >
        <CalendarDays className="size-4" />
      </button>
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''}
        onChange={(e) => {
          if (e.target.value) {
            onChange(e.target.value);
            setText(formatDate(e.target.value));
          }
        }}
        className="pointer-events-none absolute right-2 bottom-0 size-0 opacity-0"
      />
    </div>
  );
}
