import { Construction } from 'lucide-react';

export function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-dashed py-20 text-muted-foreground">
        <Construction className="size-8" />
        <p>V izdelavi</p>
      </div>
    </div>
  );
}
