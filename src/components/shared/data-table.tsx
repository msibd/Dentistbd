"use client";

import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

// A sortable, searchable, paged table (TanStack Table v9, headless) drawn with the app's own
// `data-table` styles. Everything happens in the browser: use it for lists the API returns whole
// (inventory items, staff accounts…), not for server-paged lists.

export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, basic: sortFn_basic },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

type Features = typeof dataTableFeatures;
export type DataTableColumn<T extends RowData> = ColumnDef<Features, T>;
/** Typed column builder for a row type: `const col = dataTableColumns<Item>()`. */
export const dataTableColumns = <T extends RowData>() => createColumnHelper<Features, T>();

export type ColumnMeta = { numeric?: boolean };

export default function DataTable<T extends RowData>({
  data,
  columns,
  search = "",
  pageSize = 25,
  emptyMessage,
  caption,
  rowClassName,
  getRowId,
}: {
  /** Keep this array stable (state or useMemo): a new array every render recomputes every model. */
  data: T[];
  /** Define at module scope or with useMemo. */
  columns: DataTableColumn<T>[];
  /** Text to search for in every searchable column. */
  search?: string;
  pageSize?: number;
  emptyMessage: ReactNode;
  caption?: string;
  rowClassName?: (row: T) => string | undefined;
  getRowId?: (row: T) => string;
}) {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: getRowId ? (row: T) => getRowId(row) : undefined,
    state: { globalFilter: search },
    globalFilterFn: "includesString",
    initialState: { pagination: { pageIndex: 0, pageSize } },
  });

  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const { pageIndex } = table.state.pagination;
  const pageCount = table.getPageCount();
  const colSpan = table.getAllLeafColumns().length;

  return (
    <>
      <div className="table-scroll">
        <table className="data-table">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const numeric = (header.column.columnDef.meta as ColumnMeta | undefined)?.numeric;
                  const sorted = header.column.getIsSorted();
                  const label = header.isPlaceholder ? null : <table.FlexRender header={header} />;
                  return (
                    <th key={header.id} className={numeric ? "numeric" : undefined}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : header.column.getCanSort() ? "none" : undefined}>
                      {header.column.getCanSort() ? (
                        <button type="button" className={`inline-flex items-center gap-1 font-[inherit] text-inherit ${numeric ? "flex-row-reverse" : ""}`} onClick={header.column.getToggleSortingHandler()}>
                          {label}
                          {sorted === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : sorted === "desc" ? <ArrowDown size={12} aria-hidden="true" /> : <ArrowUpDown size={12} className="opacity-40" aria-hidden="true" />}
                        </button>
                      ) : label}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={rowClassName?.(row.original)}>
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className={(cell.column.columnDef.meta as ColumnMeta | undefined)?.numeric ? "numeric" : undefined}>
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={colSpan}>{emptyMessage}</td></tr>}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <nav className="pagination" aria-label="Table pages">
          <button type="button" className="button-secondary inline-flex items-center gap-1" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="text-sm text-ink-2" aria-live="polite">Page {pageIndex + 1} of {pageCount} · {filteredCount} rows</span>
          <button type="button" className="button-secondary inline-flex items-center gap-1" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next <ChevronRight size={14} />
          </button>
        </nav>
      )}
    </>
  );
}
