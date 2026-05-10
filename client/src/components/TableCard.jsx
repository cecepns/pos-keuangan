/**
 * Wrapper + pola tabel untuk mobile: scroll horizontal hanya di dalam kartu,
 * `min-w-0` memutus rantai flex supaya tidak offset / halaman tidak melebar.
 */
export const PAGE_TABLE_WRAP =
  "relative w-full max-w-full min-w-0 touch-pan-x overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] rounded-2xl border border-slate-100 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900";

/** Konten kartu laporan: scroll dua sumbu tanpa memecahkan halaman */
export const REPORT_TABLE_SCROLL = "min-w-0 max-h-80 overflow-auto overscroll-contain touch-pan-x";

export const REPORT_TABLE_SCROLL_TALL = "min-w-0 max-h-96 overflow-auto overscroll-contain touch-pan-x";

/** Tabel data — min-width memicu overflow-x di parent */
export const PAGE_TABLE = "w-full min-w-[680px] text-sm";

/** Kolom banyak */
export const PAGE_TABLE_WIDE = "w-full min-w-[720px] text-sm";

export function PageStack({ children, className = "" }) {
  return <div className={`min-w-0 w-full max-w-full space-y-4 ${className}`.trim()}>{children}</div>;
}

export function PageStackLoose({ children, className = "" }) {
  return <div className={`min-w-0 w-full max-w-full space-y-6 ${className}`.trim()}>{children}</div>;
}
