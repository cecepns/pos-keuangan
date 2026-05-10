import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Select from "react-select";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PageStack } from "../components/TableCard";
import { useThemeStore } from "../store/themeStore";

export default function StockAdjustPage() {
  const dark = useThemeStore((s) => s.dark);
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [actual, setActual] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const rows = await fetchAllPages("/api/products");
        setProducts(rows);
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
  const recorded = selected ? Number(selected.product.stock) : null;

  async function submit() {
    if (!productId) return toast.error("Pilih barang");
    const a = Number(actual);
    if (Number.isNaN(a) || a < 0) return toast.error("Stok aktual tidak valid");
    setBusy(true);
    const t = toast.loading("Menyesuaikan...");
    try {
      await api.post("/api/stock/physical-adjust", {
        product_id: Number(productId),
        actual_stock: a,
        notes,
      });
      toast.success("Stok disesuaikan", { id: t });
      const rows = await fetchAllPages("/api/products");
      setProducts(rows);
      setNotes("");
    } catch (e) {
      toast.error(e.response?.data?.error || "Gagal", { id: t });
    } finally {
      setBusy(false);
    }
  }

  const border = dark ? "#334155" : "#e2e8f0";
  const bg = dark ? "#0f172a" : "#ffffff";
  const text = dark ? "#f1f5f9" : "#0f172a";

  return (
    <PageStack>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Penyesuaian stok</h1>
        <p className="text-sm text-slate-500">Masukkan stok fisik aktual; sistem menghitung selisih dan mencatat mutasi</p>
      </div>

      <div className="max-w-xl space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label className="text-xs text-slate-500">Pilih barang</label>
          <Select
            className="mt-1"
            classNamePrefix="adj"
            options={options}
            value={selected || null}
            onChange={(o) => {
              setProductId(o?.value || "");
              if (o?.product) setActual(String(o.product.stock));
            }}
            placeholder="SKU | nama..."
            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            styles={{
              control: (base, state) => ({
                ...base,
                borderRadius: "0.75rem",
                minHeight: 42,
                backgroundColor: bg,
                borderColor: state.isFocused ? "#0d9488" : border,
              }),
              menuPortal: (base) => ({ ...base, zIndex: 10000 }),
              menu: (base) => ({ ...base, backgroundColor: bg, border: `1px solid ${border}` }),
              singleValue: (base) => ({ ...base, color: text }),
              input: (base) => ({ ...base, color: text }),
            }}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Stok tercatat</label>
          <input
            readOnly
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={recorded != null ? String(recorded) : ""}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Stok aktual (fisik)</label>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Keterangan</label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opsional"
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          Sesuaikan
        </button>
      </div>
    </PageStack>
  );
}
