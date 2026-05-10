import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Printer, Save } from "lucide-react";
import Select from "react-select";
import JsBarcode from "jsbarcode";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { formatIDR } from "../utils/format";

const STORAGE_KEY = "barcode_label_settings_v1";

const defaultSettings = () => ({
  top: "name",
  bottom: "code",
  cols: 3,
});

function normalizeCols(val) {
  const n = Number.parseInt(String(val ?? "").trim(), 10);
  if (!Number.isFinite(n)) return defaultSettings().cols;
  return Math.min(5, Math.max(1, n));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    const p = JSON.parse(raw);
    return {
      ...defaultSettings(),
      ...p,
      top: p.top || defaultSettings().top,
      bottom: p.bottom || defaultSettings().bottom,
      cols: normalizeCols(p.cols),
    };
  } catch {
    return defaultSettings();
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function labelLine(kind, prod) {
  const code = prod.barcode || prod.sku || "";
  if (kind === "name") return prod.name || "";
  if (kind === "code") return code;
  if (kind === "price") return formatIDR(prod.sell_price);
  return "";
}

export default function BarcodeLabelsPage() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  /** String agar bisa dikosongkan saat diketik */
  const [copies, setCopies] = useState("1");
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    (async () => {
      try {
        const rows = await fetchAllPages("/api/products", { active: 1 });
        setProducts(rows);
        if (rows.length && !productId) setProductId(String(rows[0].id));
      } catch {
        toast.error("Gagal memuat produk");
      }
    })();
  }, []);

  const options = useMemo(
    () =>
      products.map((p) => ({
        value: String(p.id),
        label: `${p.sku} | ${p.name}`,
        product: p,
      })),
    [products]
  );

  const selected = options.find((o) => o.value === productId);

  function persistSettings() {
    const payload = { ...settings, cols: normalizeCols(settings.cols) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setSettings(payload);
    toast.success("Pengaturan disimpan");
  }

  function printSheet() {
    const p = selected?.product;
    if (!p) return toast.error("Pilih barang");
    const code = p.barcode || p.sku;
    if (!code) return toast.error("Produk tanpa barcode/SKU");
    const nParsed = Number.parseInt(String(copies).trim(), 10);
    const n = Math.min(100, Math.max(1, Number.isFinite(nParsed) ? nParsed : 1));
    const colCount = normalizeCols(settings.cols);
    const top = labelLine(settings.top, p);
    const bottom = labelLine(settings.bottom, p);

    const cells = [];
    for (let i = 0; i < n; i++) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      JsBarcode(svg, String(code), { format: "CODE128", width: 1.4, height: 44, displayValue: false });
      cells.push(
        `<div class="cell">
          <div class="t">${escapeHtml(top)}</div>
          <div class="bc">${svg.outerHTML}</div>
          <div class="b mono">${escapeHtml(bottom)}</div>
        </div>`
      );
    }

    const w = window.open("", "_blank");
    if (!w) return toast.error("Popup diblokir");
    w.document.write(`<!DOCTYPE html><html><head><title>Cetak barcode</title><style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: system-ui, sans-serif; font-size: 11px; }
      .grid { display: grid; gap: 8px 10px; padding: 12px; grid-template-columns: repeat(${colCount}, minmax(0, 1fr)); }
      .cell {
        border: 1px dashed #ccc;
        padding: 8px 6px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .cell .t { font-weight: 600; line-height: 1.25; margin: 0 0 4px 0; max-width: 100%; word-break: break-word; }
      .cell .bc { display: flex; justify-content: center; align-items: center; margin: 0; flex-shrink: 0; }
      .cell .bc svg { max-width: 100%; height: auto; display: block; }
      .cell .b { margin: 4px 0 0 0; font-size: 10px; line-height: 1.25; }
      @media print { .cell { border-color: transparent; } }
    </style></head><body><div class="grid">${cells.join("")}</div>
    <script>
      window.onload=function(){
        document.querySelectorAll(".grid").forEach(function(el){
          el.style.gridTemplateColumns = "repeat(${colCount}, minmax(0, 1fr))";
        });
        window.print();
      }
    <\/script></body></html>`);
    w.document.close();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cetak label barcode</h1>
        <p className="text-sm text-slate-500">Nama di atas barcode, kode di bawah — sesuai layout etiket</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Modul cetak</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500">Nama barang</label>
              <Select
                className="mt-1"
                classNamePrefix="blb"
                options={options}
                value={selected || null}
                onChange={(o) => setProductId(o?.value || "")}
                placeholder="Pilih produk..."
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                styles={{
                  menuPortal: (base) => ({ ...base, zIndex: 10000 }),
                }}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Barcode / kode</label>
              <input
                readOnly
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
                value={selected?.product ? selected.product.barcode || selected.product.sku : ""}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Jumlah cetak</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                placeholder="1"
                value={copies}
                onChange={(e) => {
                  const x = e.target.value.replace(/\D/g, "");
                  setCopies(x);
                }}
                onBlur={() => {
                  const n = Number.parseInt(String(copies).trim(), 10);
                  if (!Number.isFinite(n) || n < 1) setCopies("1");
                }}
              />
            </div>
            <button
              type="button"
              onClick={printSheet}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 font-semibold text-white"
            >
              <Printer className="h-5 w-5" /> Print
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Pengaturan label</h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">Label bagian atas</p>
              <div className="flex flex-wrap gap-3">
                {["name", "code", "price"].map((k) => (
                  <label key={k} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="blb-label-top"
                      checked={settings.top === k}
                      onChange={() => setSettings((s) => ({ ...s, top: k }))}
                    />
                    {k === "name" ? "Nama" : k === "code" ? "Kode" : "Harga"}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">Label bagian bawah</p>
              <div className="flex flex-wrap gap-3">
                {["name", "code", "price"].map((k) => (
                  <label key={k} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="blb-label-bottom"
                      checked={settings.bottom === k}
                      onChange={() => setSettings((s) => ({ ...s, bottom: k }))}
                    />
                    {k === "name" ? "Nama" : k === "code" ? "Kode" : "Harga"}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">Jumlah kolom</p>
              <div className="flex flex-wrap gap-3">
                {[1, 2, 3, 4, 5].map((c) => (
                  <label key={c} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="blb-sheet-cols"
                      checked={normalizeCols(settings.cols) === c}
                      onChange={() => setSettings((s) => ({ ...s, cols: Number(c) }))}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={persistSettings}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white"
            >
              <Save className="h-4 w-4" /> Simpan pengaturan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
