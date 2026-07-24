import clsx from "clsx";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { getPageNumberItems } from "../utils/paginationItems";

/**
 * « Prev [1][2]… Next » — konsisten di seluruh halaman ber-tabel.
 * @param {{ page: number; pages: number; setPage: (n: number | ((p: number) => number)) => void; variant?: "default" | "compact"; className?: string }} props
 */
export function PaginationBar({ page, pages, setPage, variant = "default", className }) {
  const safePages = Math.max(1, Math.floor(Number(pages) || 1));
  const safePage = Math.min(Math.max(1, Math.floor(Number(page) || 1)), safePages);
  const items = safePages <= 1 ? [] : getPageNumberItems(safePage, safePages);
  const compact = variant === "compact";

  const navBtn = clsx(
    "inline-flex items-center justify-center rounded-lg border border-slate-200 transition-all duration-100 disabled:opacity-30 dark:border-slate-700",
    compact ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm",
  );

  const numBase = clsx(
    "inline-flex items-center justify-center rounded-lg border font-medium tabular-nums transition-all duration-100 dark:border-slate-700",
    compact ? "h-7 min-w-[1.75rem] px-1.5 text-xs" : "h-8 min-w-[2rem] px-2 text-sm",
  );

  if (safePages <= 1) return null;

  return (
    <div className={clsx("flex flex-wrap items-center gap-1", className)}>
      <button type="button" disabled={safePage <= 1} className={navBtn} onClick={() => setPage(1)} title="Halaman pertama">
        <ChevronsLeft className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </button>
      <button type="button" disabled={safePage <= 1} className={navBtn} onClick={() => setPage((p) => p - 1)} title="Sebelumnya">
        <ChevronLeft className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </button>
      {items.map((item, idx) =>
        item.type === "ellipsis" ? (
          <span key={item.key ?? `ellipsis-${idx}`} className={clsx("px-1 text-slate-400", compact ? "text-xs" : "text-sm")}>
            …
          </span>
        ) : (
          <button
            key={item.value}
            type="button"
            className={clsx(
              numBase,
              safePage === item.value
                ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                : "border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800",
            )}
            onClick={() => setPage(item.value)}
          >
            {item.value}
          </button>
        ),
      )}
      <button type="button" disabled={safePage >= safePages} className={navBtn} onClick={() => setPage((p) => p + 1)} title="Berikutnya">
        <ChevronRight className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </button>
      <button type="button" disabled={safePage >= safePages} className={navBtn} onClick={() => setPage(safePages)} title="Halaman terakhir">
        <ChevronsRight className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </button>
    </div>
  );
}
