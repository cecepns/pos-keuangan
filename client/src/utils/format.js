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

/** Tanggal kalender lokal YYYY-MM-DD (bukan UTC — cocok untuk `<input type="date">` & filter API). */
export function toLocalDateStringYMD(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateID(dateStr, opts = {}) {
  if (!dateStr) return "—";
  let d;
  if (typeof dateStr === "string") {
    const cal = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (cal) {
      d = new Date(Number(cal[1]), Number(cal[2]) - 1, Number(cal[3]));
    } else {
      d = new Date(dateStr);
    }
  } else {
    d = dateStr;
  }
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...opts,
  }).format(d);
}

/** Tanggal dari API untuk sel laporan (DATE MySQL sering jadi ISO dengan Z — jangan ambil 10 char pertama = tanggal UTC). */
export function formatReportDateCell(value) {
  if (value == null || value === "") return "—";
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return formatDateID(s);
  const d = value instanceof Date ? value : new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return formatDateID(toLocalDateStringYMD(d));
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
