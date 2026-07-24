/**
 * Wrapper + pola tabel untuk mobile: scroll horizontal hanya di dalam kartu,
 * `min-w-0` memutus rantai flex supaya tidak offset / halaman tidak melebar.
 */
export const PAGE_TABLE_WRAP =
  "relative w-full max-w-full min-w-0 touch-pan-x overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] card";

/** Konten kartu laporan: scroll dua sumbu tanpa memecahkan halaman */
export const REPORT_TABLE_SCROLL =
  "min-w-0 max-h-80 overflow-x-auto overflow-y-auto overscroll-x-contain overscroll-y-contain touch-pan-x [-webkit-overflow-scrolling:touch]";

export const REPORT_TABLE_SCROLL_TALL =
  "min-w-0 max-h-96 overflow-x-auto overflow-y-auto overscroll-x-contain overscroll-y-contain touch-pan-x [-webkit-overflow-scrolling:touch]";

/** Tabel data — use table-base class from CSS */
export const PAGE_TABLE = "table-base min-w-[680px]";

/** Kolom banyak */
export const PAGE_TABLE_WIDE = "table-base min-w-[720px]";

export function PageStack({ children, className = "" }) {
  return <div className={`min-w-0 w-full max-w-full space-y-5 ${className}`.trim()}>{children}</div>;
}

export function PageStackLoose({ children, className = "" }) {
  return <div className={`min-w-0 w-full max-w-full space-y-6 ${className}`.trim()}>{children}</div>;
}
