// Generic data table (TanStack Table) used by every list page.
//
//   <DataTable
//     columns={columns}            // ColumnDef<T>[]; set meta: { align: 'right', footer: rows => <b>..</b>, className }
//     data={rows} loading={q.isLoading} error={q.error}
//     searchText={(r) => `${r.name} ${r.email}`}   // diacritics-insensitive global search haystack
//     filters={[{ id: 'status', label: 'Status', options: [{ value: 'active', label: 'Aktivni' }] }]}
//     onRowClick={(r) => ...} toolbar={<Button/>} initialSort={[{ id: 'name', desc: false }]}
//     footerLabel="Skupaj" />
//
// Column filters match on the column's accessor value (string compare). Footer
// cells are computed over the *filtered* rows. The table scrolls inside its card
// (sticky header / footer); pass `maxHeightClass` to change the height.

import { useMemo, useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, SearchX, Inbox, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { compareText, normalize } from '@/lib/text';
import { cn } from '@/lib/utils';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    align?: 'left' | 'right' | 'center';
    className?: string;
    /** Footer cell content computed from the filtered rows. */
    footer?: (rows: TData[]) => ReactNode;
  }
}

export type TableFilter = {
  /** Column id the filter applies to. */
  id: string;
  label: string;
  options: { value: string; label: string }[];
};

type Props<T> = {
  columns: ColumnDef<T, any>[];
  data: T[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Haystack for the global search; omit to hide the search box. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: TableFilter[];
  /** Right-aligned toolbar content (buttons). */
  toolbar?: ReactNode;
  initialSort?: SortingState;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
  footerLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Name for the row-count line, e.g. ['sodnik', 'sodnika', 'sodniki'] unused; plain noun phrase instead. */
  countLabel?: string;
  maxHeightClass?: string;
  /** Extra classes for the card wrapper. */
  className?: string;
};

const ALL = '__all__';

export function DataTable<T>({
  columns,
  data,
  loading,
  error,
  onRetry,
  searchText,
  searchPlaceholder = 'Iskanje…',
  filters,
  toolbar,
  initialSort,
  onRowClick,
  getRowId,
  footerLabel = 'Skupaj',
  emptyTitle = 'Ni podatkov',
  emptyDescription,
  emptyAction,
  countLabel = 'zapisov',
  maxHeightClass = 'max-h-[calc(100vh-17rem)]',
  className,
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSort ?? []);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    getRowId: getRowId ? (r) => getRowId(r) : undefined,
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableSortingRemoval: true,
    defaultColumn: {
      filterFn: 'equalsString',
      sortingFn: (a: Row<T>, b: Row<T>, id: string) => {
        const x = a.getValue(id);
        const y = b.getValue(id);
        if (typeof x === 'number' && typeof y === 'number') return x - y;
        if (x == null || x === '') return y == null || y === '' ? 0 : 1; // empties last
        if (y == null || y === '') return -1;
        return compareText(String(x), String(y));
      },
    },
    globalFilterFn: (row, _id, value: string) => {
      if (!searchText) return true;
      const needle = normalize(value).trim();
      if (!needle) return true;
      const hay = normalize(searchText(row.original));
      return needle.split(/\s+/).every((w) => hay.includes(w));
    },
  });

  const rows = table.getRowModel().rows;
  const filteredRows = table.getFilteredRowModel().rows;
  const filteredData = useMemo(() => filteredRows.map((r) => r.original), [filteredRows]);
  const hasFooter = columns.some((c) => c.meta?.footer);
  const filtering = globalFilter.trim() !== '' || columnFilters.length > 0;
  const colCount = table.getVisibleLeafColumns().length;

  const setFilter = (id: string, value: string) =>
    setColumnFilters((prev) => {
      const rest = prev.filter((f) => f.id !== id);
      return value === ALL ? rest : [...rest, { id, value }];
    });

  const alignClass = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : '');

  return (
    <div className={cn('space-y-3', className)}>
      {(searchText || filters?.length || toolbar) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchText && (
            <div className="relative w-72 max-w-full">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="bg-card pr-8 pl-9"
                aria-label="Iskanje"
              />
              {globalFilter && (
                <button
                  type="button"
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setGlobalFilter('')}
                  aria-label="Počisti iskanje"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          )}
          {filters?.map((f) => (
            <Select
              key={f.id}
              value={(columnFilters.find((c) => c.id === f.id)?.value as string | undefined) ?? ALL}
              onValueChange={(v) => setFilter(f.id, v)}
            >
              <SelectTrigger className="w-44 bg-card" aria-label={f.label}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{f.label}: vse</SelectItem>
                {f.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
          {filtering && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setGlobalFilter('');
                setColumnFilters([]);
              }}
            >
              <X /> Počisti filtre
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">{toolbar}</div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {error ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : (
          <Table containerClassName={maxHeightClass}>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((h) => {
                    const sortable = h.column.getCanSort();
                    const dir = h.column.getIsSorted();
                    return (
                      <TableHead
                        key={h.id}
                        className={cn(alignClass(h.column.columnDef.meta?.align), h.column.columnDef.meta?.className)}
                        aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}
                      >
                        {h.isPlaceholder ? null : sortable ? (
                          <button
                            type="button"
                            className={cn(
                              'inline-flex items-center gap-1 uppercase hover:text-foreground',
                              h.column.columnDef.meta?.align === 'right' && 'flex-row-reverse',
                              dir && 'text-foreground',
                            )}
                            onClick={h.column.getToggleSortingHandler()}
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {dir === 'asc' ? (
                              <ArrowUp className="size-3.5" />
                            ) : dir === 'desc' ? (
                              <ArrowDown className="size-3.5" />
                            ) : (
                              <ArrowUpDown className="size-3.5 opacity-40" />
                            )}
                          </button>
                        ) : (
                          flexRender(h.column.columnDef.header, h.getContext())
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 6 }, (_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      {Array.from({ length: colCount }, (_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full max-w-40" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-clickable={onRowClick ? 'true' : undefined}
                      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(alignClass(cell.column.columnDef.meta?.align), cell.column.columnDef.meta?.className)}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
            </TableBody>
            {hasFooter && !loading && rows.length > 0 && (
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  {table.getVisibleLeafColumns().map((col, i) => (
                    <TableCell key={col.id} className={cn('font-semibold', alignClass(col.columnDef.meta?.align))}>
                      {col.columnDef.meta?.footer ? col.columnDef.meta.footer(filteredData) : i === 0 ? footerLabel : null}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            )}
          </Table>
        )}
        {!error && !loading && rows.length === 0 && (
          <EmptyState
            icon={filtering ? SearchX : Inbox}
            title={filtering ? 'Ni zadetkov' : emptyTitle}
            description={filtering ? 'Poskusite z drugim iskalnim nizom ali odstranite filtre.' : emptyDescription}
            action={filtering ? undefined : emptyAction}
            className="py-14"
          />
        )}
      </div>
      {!error && !loading && data.length > 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          {filtering ? `Prikazano ${rows.length} od ${data.length} ${countLabel}` : `Skupaj ${data.length} ${countLabel}`}
        </p>
      )}
    </div>
  );
}
