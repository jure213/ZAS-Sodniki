import * as React from 'react';
import { cn } from '@/lib/utils';

/** The wrapper is the scroll container, so sticky headers work inside it. */
function Table({ className, containerClassName, ...props }: React.ComponentProps<'table'> & { containerClassName?: string }) {
  return (
    <div className={cn('relative w-full overflow-auto', containerClassName)}>
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}
function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={cn('sticky top-0 z-10 bg-muted [&_tr]:border-b', className)} {...props} />;
}
function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}
function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return <tfoot className={cn('sticky bottom-0 border-t bg-muted font-medium', className)} {...props} />;
}
function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr className={cn('border-b transition-colors hover:bg-muted/50 data-[clickable=true]:cursor-pointer', className)} {...props} />;
}
function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return <th className={cn('h-9 px-3 text-left align-middle text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase', className)} {...props} />;
}
function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('px-3 py-1 align-middle', className)} {...props} />;
}
export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell };
