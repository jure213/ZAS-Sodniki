// Euro amount input. Accepts "12,50", "1.234,56", "12.5"; the value is integer
// cents (null = empty/invalid). On blur the text is reformatted ("1.234,56").

import { useEffect, useState } from 'react';
import { formatCents, parseMoney } from '@shared/money';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const plain = (cents: number) => formatCents(cents).replace(/\s?€$/, '');

type Props = {
  value: number | null;
  onChange: (cents: number | null) => void;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
  onBlur?: () => void;
};

export function MoneyInput({ value, onChange, id, disabled, placeholder = '0,00', invalid, className, onBlur }: Props) {
  const [text, setText] = useState(value == null ? '' : plain(value));

  // Follow external changes (form reset, programmatic set) but never fight the user's typing.
  useEffect(() => {
    setText((prev) => {
      const parsed = prev.trim() === '' ? null : parseMoney(prev);
      return parsed === value ? prev : value == null ? '' : plain(value);
    });
  }, [value]);

  const bad = invalid || (text.trim() !== '' && parseMoney(text) == null);

  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="decimal"
        disabled={disabled}
        placeholder={placeholder}
        value={text}
        aria-invalid={bad || undefined}
        className={cn('pr-8 text-right tabular-nums', bad && 'border-destructive', className)}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value.trim() === '' ? null : parseMoney(e.target.value));
        }}
        onBlur={() => {
          const parsed = text.trim() === '' ? null : parseMoney(text);
          if (parsed != null) setText(plain(parsed));
          onBlur?.();
        }}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">€</span>
    </div>
  );
}
