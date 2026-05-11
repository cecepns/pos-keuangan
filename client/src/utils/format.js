/** Input nominal: tampil "20.000"; simpan state sebagai digit murni ("20000"). */
export function formatThousandsIdInput(digitsOnly) {
  const d = String(digitsOnly ?? "").replace(/\D/g, "");
  if (!d) return "";
  const n = Number(d);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("id-ID");
}

export function formatIDR(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDateID(dateStr, opts = {}) {
  if (!dateStr) return "—";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...opts,
  }).format(d);
}

/** Tanggal dari API (ISO / Date / YYYY-MM-DD) untuk sel laporan */
export function formatReportDateCell(value) {
  if (value == null || value === "") return "—";
  const s = String(value);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return formatDateID(m[1]);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return formatDateID(d.toISOString().slice(0, 10));
}

export function formatDateTimeID(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
