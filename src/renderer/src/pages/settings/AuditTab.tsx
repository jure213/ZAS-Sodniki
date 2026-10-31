import { Fragment, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, RefreshCw, X } from 'lucide-react';
import type { AuditQuery } from '@shared/schemas';
import type { AuditEntry } from '@shared/types';
import { Combobox } from '@/components/Combobox';
import { DateField } from '@/components/DateField';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { qk } from '@/lib/api';
import { useUsers } from '@/lib/hooks';
import { call } from '@/lib/ipc';
import { cn } from '@/lib/utils';

const PAGE = 100;
const ALL = '__all__';

const TYPES: { value: NonNullable<AuditQuery['entity']>; label: string }[] = [
  { value: 'official', label: 'Sodniki' },
  { value: 'competition', label: 'Tekmovanja' },
  { value: 'assignment', label: 'Dodelitve' },
  { value: 'payment', label: 'Plačila' },
  { value: 'role', label: 'Vloge' },
  { value: 'discipline', label: 'Discipline' },
  { value: 'config', label: 'Nastavitve' },
  { value: 'user', label: 'Uporabniki' },
  { value: 'auth', label: 'Prijave' },
];

const validIso = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
const p2 = (n: number) => String(n).padStart(2, '0');

/** "2026-10-31T20:05:00+00:00" -> "31. 10. 2026 21:05" (local time). */
function formatAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** Everything is rendered as React text nodes, so a hostile name in a summary can never become markup. */
function ChangeList({ changes }: { changes: NonNullable<AuditEntry['changes']> }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
      {Object.entries(changes).map(([label, [before, after]]) => (
        <Fragment key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">
            {before != null && <span className="text-muted-foreground line-through decoration-muted-foreground/50">{before}</span>}
            {before != null && after != null && <span className="mx-2 text-muted-foreground">→</span>}
            {after != null && <span className="font-medium">{after}</span>}
            {before == null && after == null && <span className="text-muted-foreground">–</span>}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function AuditTab() {
  const users = useUsers();
  const [userId, setUserId] = useState<string | null>(null);
  const [type, setType] = useState<string>(ALL);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Set<number>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filter = useMemo(
    () => ({
      ...(userId ? { userId: Number(userId) } : {}),
      ...(type !== ALL ? { entity: type as NonNullable<AuditQuery['entity']> } : {}),
      ...(validIso(from) ? { from: validIso(from) } : {}),
      ...(validIso(to) ? { to: validIso(to) } : {}),
      ...(search ? { search } : {}),
    }),
    [userId, type, from, to, search],
  );

  const q = useInfiniteQuery({
    queryKey: qk.audit.list(filter),
    queryFn: ({ pageParam }) => call('audit:list', { ...filter, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.rows.length, 0);
      return last.rows.length === PAGE && loaded < last.total ? loaded : undefined;
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const rows = useMemo(() => q.data?.pages.flatMap((p) => p.rows) ?? [], [q.data]);
  const total = q.data?.pages[0]?.total ?? 0;

  const userOptions = useMemo(
    () => [
      { value: '', label: 'Vsi uporabniki' },
      ...(users.data ?? []).map((u) => ({ value: String(u.id), label: u.name, hint: u.username })).sort((a, b) => a.label.localeCompare(b.label, 'sl')),
    ],
    [users.data],
  );

  const dirty = !!userId || type !== ALL || from !== '' || to !== '' || searchInput !== '';
  const reset = () => {
    setUserId(null);
    setType(ALL);
    setFrom('');
    setTo('');
    setSearchInput('');
    setSearch('');
  };
  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3 shadow-sm">
        <div className="w-60 space-y-1">
          <Label className="text-xs">Uporabnik</Label>
          <Combobox value={userId} onChange={(v) => setUserId(v || null)} options={userOptions} placeholder="Vsi uporabniki" searchPlaceholder="Išči uporabnika…" />
        </div>
        <div className="w-48 space-y-1">
          <Label className="text-xs">Vrsta</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger aria-label="Vrsta dogodka">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Vse vrste</SelectItem>
              {TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40 space-y-1">
          <Label className="text-xs" htmlFor="a-from">
            Od
          </Label>
          <DateField id="a-from" value={from} onChange={setFrom} />
        </div>
        <div className="w-40 space-y-1">
          <Label className="text-xs" htmlFor="a-to">
            Do
          </Label>
          <DateField id="a-to" value={to} onChange={setTo} />
        </div>
        <div className="w-64 space-y-1">
          <Label className="text-xs" htmlFor="a-search">
            Iskanje
          </Label>
          <Input id="a-search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Išči po dogodkih…" className="bg-card" maxLength={100} />
        </div>
        {dirty && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <X /> Ponastavi filtre
          </Button>
        )}
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => void q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={cn(q.isFetching && 'animate-spin')} /> Osveži
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {q.error ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : (
          <Table containerClassName="max-h-[calc(100vh-24rem)]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-44">Čas</TableHead>
                <TableHead className="w-56">Uporabnik</TableHead>
                <TableHead>Dogodek</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isPending
                ? Array.from({ length: 6 }, (_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      {Array.from({ length: 3 }, (_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full max-w-40" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : rows.map((r) => {
                    const expandable = r.changes != null;
                    const expanded = expandable && open.has(r.id);
                    return (
                      <Fragment key={r.id}>
                        <TableRow
                          data-clickable={expandable ? 'true' : undefined}
                          onClick={expandable ? () => toggle(r.id) : undefined}
                          aria-expanded={expandable ? expanded : undefined}
                        >
                          <TableCell className="whitespace-nowrap tabular-nums">{formatAt(r.at)}</TableCell>
                          <TableCell className="max-w-56 truncate">{r.username || '—'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {expandable ? (
                                expanded ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                              ) : (
                                <span className="size-4 shrink-0" />
                              )}
                              {r.action === 'login_failed' && <Badge variant="destructive">Neuspešna prijava</Badge>}
                              {r.action === 'login' && <Badge variant="secondary">Prijava</Badge>}
                              {r.action === 'clear_all' && <Badge variant="destructive">Brisanje podatkov</Badge>}
                              <span className="min-w-0 break-words">{r.summary}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expanded && r.changes && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell />
                            <TableCell />
                            <TableCell className="py-2 pl-9">
                              <ChangeList changes={r.changes} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
            </TableBody>
          </Table>
        )}
        {!q.error && !q.isPending && rows.length === 0 && (
          <EmptyState
            title={dirty ? 'Ni zadetkov' : 'Dnevnik je prazen'}
            description={dirty ? 'Poskusite z drugimi filtri.' : 'Dogodki se zapišejo od posodobitve na različico 2.0 naprej.'}
            className="py-14"
          />
        )}
      </div>

      {!q.error && !q.isPending && rows.length > 0 && (
        <div className="flex items-center gap-3 px-1">
          <p className="text-xs text-muted-foreground">
            Prikazano {rows.length} od {total} zapisov
          </p>
          {q.hasNextPage && (
            <Button variant="outline" size="sm" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
              Naloži več
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
