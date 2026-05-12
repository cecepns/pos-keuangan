import clsx from "clsx";
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

  const navBtn = compact
    ? "rounded border border-slate-200 px-2 py-0.5 text-xs font-medium disabled:opacity-40 dark:border-slate-700"
    : "rounded-xl border border-slate-200 px-3 py-1 text-sm disabled:opacity-40 dark:border-slate-700";

  const edgeBtn = compact
    ? "rounded border border-slate-200 px-2 py-0.5 text-xs font-medium disabled:opacity-40 dark:border-slate-700"
    : "rounded-xl border border-slate-200 px-2.5 py-1 text-sm font-medium disabled:opacity-40 dark:border-slate-700";

  const numBase = compact
    ? "min-w-[1.75rem] rounded border px-1.5 py-0.5 text-xs font-medium tabular-nums dark:border-slate-700"
    : "min-w-[2.25rem] rounded-xl border px-2.5 py-1 text-sm font-medium tabular-nums dark:border-slate-700";

  return (
    <div className={clsx("flex flex-wrap items-center gap-1", className)}>
      <button
        type="button"
        disabled={safePage <= 1}
        className={edgeBtn}
        onClick={() => setPage(1)}
        title="Halaman pertama"
      >
        «
      </button>
      <button type="button" disabled={safePage <= 1} className={navBtn} onClick={() => setPage((p) => p - 1)}>
        Prev
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
                : "border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800"
            )}
            onClick={() => setPage(item.value)}
          >
            {item.value}
          </button>
        )
      )}
      <button type="button" disabled={safePage >= safePages} className={navBtn} onClick={() => setPage((p) => p + 1)}>
        Next
      </button>
      <button
        type="button"
        disabled={safePage >= safePages}
        className={edgeBtn}
        onClick={() => setPage(safePages)}
        title="Halaman terakhir"
      >
        »
      </button>
    </div>
  );
}
