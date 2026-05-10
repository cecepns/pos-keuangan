/** Input angka boleh kosong saat diketik; kosong → fallback pada commit/blur */

export function parseOptionalInt(raw, fallback, opts = {}) {
  const min = opts.min ?? -Infinity;
  const max = opts.max ?? Infinity;
  const t = String(raw ?? "").trim();
  if (t === "") return fallback;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function parseOptionalFloat(raw, fallback, opts = {}) {
  const min = opts.min ?? -Infinity;
  const max = opts.max ?? Infinity;
  const t = String(raw ?? "").trim().replace(",", ".");
  if (t === "") return fallback;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
