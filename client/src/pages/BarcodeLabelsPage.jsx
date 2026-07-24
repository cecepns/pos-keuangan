import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Printer, Save } from "lucide-react";
import Select from "react-select";
import JsBarcode from "jsbarcode";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { formatIDR } from "../utils/format";
import { PageHeader } from "../components/PageHeader";
import { ActionButton } from "../components/ActionButton";

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
    toast.success("Pengaturan label disimpan");
  }

  function printSheet() {
    const p = selected?.product;
    if (!p) return toast.error("Pilih barang terlebih dahulu");
    const code = p.barcode || p.sku;
    if (!code) return toast.error("Produk belum memiliki barcode/SKU");
    const nParsed = Number.parseInt(String(copies).trim(), 10);
    const n = Math.min(100, Math.max(1, Number.isFinite(nParsed) ? nParsed : 1));
    const colCount = normalizeCols(settings.cols);
    const top = labelLine(settings.top, p);
    const bottom = labelLine(settings.bottom, p);

    const cells = [];
    for (let i = 0; i < n; i++) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      JsBarcode(svg, String(code), {
        format: "CODE128",
        width: 2.2,
        height: 64,
        displayValue: true,
        fontSize: 12,
        textMargin: 3,
        margin: 10,
      });
      cells.push(
        `<div class="cell">
          <div class="t">${escapeHtml(top)}</div>
          <div class="bc">${svg.outerHTML}</div>
          <div class="b mono">${escapeHtml(bottom)}</div>
        </div>`
      );
    }

    const w = window.open("", "_blank");
    if (!w) return toast.error("Popup diblokir oleh browser");
    w.document.write(`<!DOCTYPE html><html><head><title>Cetak barcode</title><style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: system-ui, sans-serif; font-size: 11px; }
      .grid { display: grid; gap: 8px 10px; padding: 12px; grid-template-columns: repeat(${colCount}, minmax(0, 1fr)); }
      .cell {
        border: 1px dashed #ccc;
        padding: 6px 4px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 2px;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .cell .t { font-weight: 600; line-height: 1.15; margin: 0; max-width: 100%; word-break: break-word; }
      .cell .bc { display: flex; justify-content: center; align-items: center; margin: 0; flex-shrink: 0; line-height: 0; }
      .cell .bc svg { max-width: 100%; height: auto; display: block; vertical-align: top; }
      .cell .b { margin: 0; font-size: 10px; line-height: 1.15; }
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
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Cetak Label Barcode"
        subtitle="Cetak lembar etiket barcode untuk ditempel pada produk/kemasan"
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card space-y-4 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Modul Cetak</h2>
          <div className="space-y-3.5">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Pilih Barang</label>
              <Select
                className="mt-1.5"
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
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Barcode / Kode SKU</label>
              <input
                readOnly
                className="input-base mt-1.5 bg-slate-100/70 font-mono text-slate-600 dark:bg-slate-900 dark:text-slate-400"
                value={selected?.product ? selected.product.barcode || selected.product.sku : ""}
                placeholder="—"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Jumlah Cetak (Lembar)</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                className="input-base mt-1.5 font-mono"
                placeholder="1"
                value={copies}
                onChange={(e) => setCopies(e.target.value.replace(/\D/g, ""))}
                onBlur={() => {
                  const n = Number.parseInt(String(copies).trim(), 10);
                  if (!Number.isFinite(n) || n < 1) setCopies("1");
                }}
              />
            </div>
            <div className="pt-2">
              <ActionButton onClick={printSheet} variant="primary" className="w-full">
                <Printer className="h-4 w-4" /> Cetak Barcode
              </ActionButton>
            </div>
          </div>
        </div>

        <div className="card space-y-4 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Pengaturan Format Label</h2>
          <div className="space-y-4 text-xs">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Teks Bagian Atas Barcode</p>
              <div className="flex flex-wrap gap-4">
                {["name", "code", "price"].map((k) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="blb-label-top"
                      className="accent-brand-600"
                      checked={settings.top === k}
                      onChange={() => setSettings((s) => ({ ...s, top: k }))}
                    />
                    {k === "name" ? "Nama Barang" : k === "code" ? "Kode Barcode/SKU" : "Harga Jual"}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Teks Bagian Bawah Barcode</p>
              <div className="flex flex-wrap gap-4">
                {["name", "code", "price"].map((k) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="blb-label-bottom"
                      className="accent-brand-600"
                      checked={settings.bottom === k}
                      onChange={() => setSettings((s) => ({ ...s, bottom: k }))}
                    />
                    {k === "name" ? "Nama Barang" : k === "code" ? "Kode Barcode/SKU" : "Harga Jual"}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Jumlah Kolom Per Lembar</p>
              <div className="flex flex-wrap gap-4">
                {[1, 2, 3, 4, 5].map((c) => (
                  <label key={c} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="blb-sheet-cols"
                      className="accent-brand-600"
                      checked={normalizeCols(settings.cols) === c}
                      onChange={() => setSettings((s) => ({ ...s, cols: Number(c) }))}
                    />
                    {c} Kolom
                  </label>
                ))}
              </div>
            </div>
            <div className="pt-2">
              <ActionButton onClick={persistSettings} variant="secondary">
                <Save className="h-4 w-4" /> Simpan Format Label
              </ActionButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
