import * as React from 'react';
import * as A from '@radix-ui/react-alert-dialog';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

const AlertDialog = A.Root;

function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof A.Content>) {
  return (
    <A.Portal>
      <A.Overlay className="fixed inset-0 z-[80] bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <A.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-[80] grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </A.Portal>
  );
}
const AlertDialogHeader = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div className={cn('flex flex-col gap-2 text-left', className)} {...props} />
);
const AlertDialogFooter = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
);
const AlertDialogTitle = ({ className, ...props }: React.ComponentProps<typeof A.Title>) => (
  <A.Title className={cn('text-lg font-semibold', className)} {...props} />
);
const AlertDialogDescription = ({ className, ...props }: React.ComponentProps<typeof A.Description>) => (
  <A.Description className={cn('text-sm text-muted-foreground', className)} {...props} />
);
const AlertDialogAction = ({ className, ...props }: React.ComponentProps<typeof A.Action>) => (
  <A.Action className={cn(buttonVariants(), className)} {...props} />
);
const AlertDialogCancel = ({ className, ...props }: React.ComponentProps<typeof A.Cancel>) => (
  <A.Cancel className={cn(buttonVariants({ variant: 'outline' }), className)} {...props} />
);
export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
