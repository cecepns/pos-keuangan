import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Select from "react-select";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PageHeader } from "../components/PageHeader";
import { ActionButton } from "../components/ActionButton";
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
    if (!productId) return toast.error("Pilih barang terlebih dahulu");
    const a = Number(actual);
    if (Number.isNaN(a) || a < 0) return toast.error("Stok aktual tidak valid");
    setBusy(true);
    const t = toast.loading("Menyesuaikan stok...");
    try {
      await api.post("/api/stock/physical-adjust", {
        product_id: Number(productId),
        actual_stock: a,
        notes,
      });
      toast.success("Stok berhasil disesuaikan", { id: t });
      const rows = await fetchAllPages("/api/products");
      setProducts(rows);
      setNotes("");
    } catch (e) {
      toast.error(e.response?.data?.error || "Gagal menyesuaikan stok", { id: t });
    } finally {
      setBusy(false);
    }
  }

  const border = dark ? "#334155" : "#e2e8f0";
  const bg = dark ? "#0f172a" : "#ffffff";
  const text = dark ? "#f1f5f9" : "#0f172a";

  return (
    <PageStack>
      <PageHeader
        title="Penyesuaian Stok"
        subtitle="Masukkan hasil stok opname/fisik aktual; sistem menghitung selisih dan mencatat mutasi"
      />

      <div className="card max-w-xl space-y-4 p-6">
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Pilih Barang</label>
          <Select
            className="mt-1.5"
            classNamePrefix="adj"
            options={options}
            value={selected || null}
            onChange={(o) => {
              setProductId(o?.value || "");
              if (o?.product) setActual(String(o.product.stock));
            }}
            placeholder="Ketik SKU atau Nama Barang..."
            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            styles={{
              control: (base, state) => ({
                ...base,
                borderRadius: "0.75rem",
                minHeight: 42,
                backgroundColor: bg,
                borderColor: state.isFocused ? "#0d9488" : border,
                boxShadow: state.isFocused ? "0 0 0 1px #0d9488" : "none",
                "&:hover": { borderColor: "#0d9488" },
              }),
              menuPortal: (base) => ({ ...base, zIndex: 10000 }),
              menu: (base) => ({ ...base, backgroundColor: bg, border: `1px solid ${border}`, borderRadius: "0.75rem" }),
              singleValue: (base) => ({ ...base, color: text }),
              input: (base) => ({ ...base, color: text }),
            }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Stok Tercatat Sistem</label>
            <input
              readOnly
              className="input-base mt-1.5 bg-slate-100/70 font-mono text-slate-600 dark:bg-slate-900 dark:text-slate-400"
              value={recorded != null ? String(recorded) : ""}
              placeholder="—"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Stok Fisik (Aktual)</label>
            <input
              type="text"
              inputMode="numeric"
              className="input-base mt-1.5 font-mono"
              value={actual}
              onChange={(e) => setActual(e.target.value.replace(/\D/g, "").slice(0, 9))}
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Keterangan / Alasan</label>
          <input
            className="input-base mt-1.5"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="misal: Opname bulanan, barang rusak, dsb (opsional)"
          />
        </div>

        <div className="pt-2">
          <ActionButton
            type="button"
            disabled={busy}
            onClick={submit}
            variant="primary"
            className="w-full"
          >
            Sesuaikan Stok
          </ActionButton>
        </div>
      </div>
    </PageStack>
  );
}
