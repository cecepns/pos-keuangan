import { apiUrl } from "./apiBase";

/**
 * Path gambar dari API (`image_path`) relatif, mis. `/uploads/prod_xxx.jpg`.
 * URL absolut dari API_BASE_URL (+ optional `VITE_API_BASE_URL`). Data lama ber-URL absolut tetap dipakai.
 */
export function uploadSrc(path) {
  if (path == null || path === "") return "";
  const s = String(path).trim();
  if (/^https?:\/\//i.test(s)) return s;
  const tail = s.replace(/^\/+/, "");
  return apiUrl(tail);
}
