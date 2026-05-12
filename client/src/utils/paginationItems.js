/**
 * Daftar item untuk tombol nomor halaman (dengan elipsis bila halaman banyak).
 * @param {number} page Halaman aktif (1-based)
 * @param {number} pages Total halaman (minimal 1)
 * @returns {Array<{ type: "page"; value: number } | { type: "ellipsis"; key: string }>}
 */
export function getPageNumberItems(page, pages) {
  const p = Math.max(1, Math.floor(Number(pages) || 1));
  const cur = Math.min(Math.max(1, Math.floor(Number(page) || 1)), p);
  if (p <= 1) return [];
  if (p <= 9) {
    return Array.from({ length: p }, (_, i) => ({ type: "page", value: i + 1 }));
  }
  const items = [];
  const pushPage = (n) => items.push({ type: "page", value: n });
  const pushEllipsis = () => {
    if (items.length && items[items.length - 1].type === "ellipsis") return;
    items.push({ type: "ellipsis", key: `e-${items.length}` });
  };
  const windowRadius = 2;
  pushPage(1);
  const start = Math.max(2, cur - windowRadius);
  const end = Math.min(p - 1, cur + windowRadius);
  if (start > 2) pushEllipsis();
  for (let i = start; i <= end; i++) pushPage(i);
  if (end < p - 1) pushEllipsis();
  pushPage(p);
  return items;
}
