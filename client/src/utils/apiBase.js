/** Tanpa slash di akhir */
const DEFAULT_BASE = "https://api-inventory.isavralabel.com/pos-keuangan";

function normalizeBase(url) {
  return String(url || DEFAULT_BASE)
    .trim()
    .replace(/\/+$/, "");
}

export const API_BASE_URL = normalizeBase(import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE);

/** Gabung base dengan path (boleh diawali `/` atau tidak) */
export function apiUrl(path) {
  const p = String(path ?? "")
    .trim()
    .replace(/^\/+/, "");
  return p ? `${API_BASE_URL}/${p}` : API_BASE_URL;
}
