import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, ScanBarcode, AlertTriangle } from "lucide-react";
import Select from "react-select";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PAGE_SIZE } from "../constants/pagination";
import { formatIDR } from "../utils/format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TableSkeleton } from "../components/Skeleton";
import { PAGE_TABLE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";
import { useThemeStore } from "../store/themeStore";
import JsBarcode from "jsbarcode";

function selectStyles(isDark) {
  const border = isDark ? "#334155" : "#e2e8f0";
  const bg = isDark ? "#0f172a" : "#ffffff";
  const bgHover = isDark ? "#1e293b" : "#f1f5f9";
  const text = isDark ? "#f1f5f9" : "#0f172a";
  const brand = "#0d9488";
  return {
    control: (base, state) => ({
      ...base,
      borderRadius: "0.75rem",
      minHeight: 42,
      backgroundColor: bg,
      borderColor: state.isFocused ? brand : border,
      boxShadow: state.isFocused ? `0 0 0 1px ${brand}` : "none",
      "&:hover": { borderColor: brand },
    }),
    menuPortal: (base) => ({ ...base, zIndex: 10000 }),
    menu: (base) => ({
      ...base,
      borderRadius: "0.75rem",
      overflow: "hidden",
      backgroundColor: bg,
      border: `1px solid ${border}`,
      boxShadow: "0 10px 40px rgba(0,0,0,.12)",
    }),
    input: (base) => ({ ...base, color: text }),
    singleValue: (base) => ({ ...base, color: text }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: isDark ? "#1e293b" : "#e2e8f0",
      borderRadius: "0.5rem",
    }),
    multiValueLabel: (base) => ({ ...base, color: text }),
    placeholder: (base) => ({ ...base, color: isDark ? "#64748b" : "#94a3b8" }),
    option: (base, state) => ({
      ...base,
      cursor: "pointer",
      color: text,
      backgroundColor: state.isSelected ? brand : state.isFocused ? bgHover : "transparent",
      "&:active": { backgroundColor: state.isSelected ? brand : bgHover },
    }),
  };
}

export default function ProductsPage() {
  const dark = useThemeStore((s) => s.dark);

  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 350);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [delId, setDelId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const form = useForm({
    defaultValues: {
      name: "",
      sku: "",
      barcode: "",
      description: "",
      purchase_price: 0,
      sell_price: 0,
      stock: 0,
      min_stock: 0,
      unit: "PCS",
      location: "",
      brand: "",
      supplier_id: "",
      category_ids: [],
      is_active: true,
    },
  });

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories]
  );
  const resolvedSelectStyles = useMemo(() => selectStyles(dark), [dark]);

  const refreshCategories = useCallback(async () => {
    try {
      const c = await fetchAllPages("/api/categories");
      setCategories(c);
    } catch {
      toast.error("Gagal memuat kategori");
    }
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/api/products", {
        params: { q: dq, page, limit: PAGE_SIZE, ...(lowStockOnly ? { low_stock: 1 } : {}) },
      });
      setList(data.data || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [dq, page, lowStockOnly]);

  useEffect(() => {
    refreshCategories();
    (async () => {
      const s = await fetchAllPages("/api/suppliers");
      setSuppliers(s);
    })();
  }, [refreshCategories]);

  function openCreate() {
    form.reset({
      name: "",
      sku: "",
      barcode: "",
      description: "",
      purchase_price: 0,
      sell_price: 0,
      stock: 0,
      min_stock: 5,
      unit: "PCS",
      location: "",
      brand: "",
      supplier_id: "",
      category_ids: [],
      is_active: true,
    });
    setModal("edit");
  }

  function openEdit(p) {
    api.get(`/api/products/${p.id}`).then(({ data }) => {
      form.reset({
        ...data,
        unit: data.unit || "PCS",
        location: data.location || "",
        brand: data.brand || "",
        supplier_id: data.supplier_id || "",
        category_ids: data.category_ids || [],
      });
      setModal("edit");
    });
  }

  async function onSubmit(values) {
    const payload = {
      ...values,
      supplier_id: values.supplier_id || null,
      category_ids: values.category_ids || [],
      purchase_price: Number(values.purchase_price),
      sell_price: Number(values.sell_price),
      min_stock: Number(values.min_stock),
      unit: values.unit || "PCS",
      location: values.location || null,
      brand: values.brand || null,
    };
    const t = toast.loading("Menyimpan...");
    try {
      if (values.id) {
        await api.put(`/api/products/${values.id}`, payload);
      } else {
        await api.post("/api/products", payload);
      }
      toast.success("Disimpan", { id: t });
      setModal(null);
      load();
    } catch {
      toast.dismiss(t);
    }
  }

  async function uploadImage(id, file) {
    const fd = new FormData();
    fd.append("image", file);
    await api.post(`/api/products/${id}/image`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    toast.success("Gambar diunggah");
    load();
  }

  function printBarcode(product) {
    const code = product?.barcode || product?.sku || product;
    const name = typeof product === "object" && product?.name ? String(product.name) : "";
    if (!code) return toast.error("Tanpa kode barcode/SKU");
    const w = window.open("", "_blank", "width=320,height=260");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, String(code), { format: "CODE128", width: 1.8, height: 52, displayValue: true, fontSize: 11 });
    const title = name ? `<div style="font-weight:600;font-size:13px;margin-bottom:8px">${name.replace(/</g, "&lt;")}</div>` : "";
    w.document.write(`<!DOCTYPE html><html><body style="margin:12px;text-align:center;font-family:sans-serif">${title}${svg.outerHTML}</body></html>`);
    w.document.close();
    w.onload = () => {
      w.print();
      w.close();
    };
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageStack>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Produk</h1>
          <p className="text-sm text-slate-500">SKU, kategori, harga, terjual, stok tipis — halaman barcode terpisah</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/categories"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            Data kategori
          </Link>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setLowStockOnly((v) => !v);
            }}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-sm ${
              lowStockOnly
                ? "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                : "border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            }`}
          >
            <AlertTriangle className="h-5 w-5" /> Stok limit
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-2.5 font-semibold text-white shadow-soft"
          >
            <Plus className="h-5 w-5" /> Tambah
          </button>
        </div>
      </div>

      <input
        className="w-full max-w-md rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        placeholder="Cari produk..."
        value={q}
        onChange={(e) => {
          setPage(1);
          setQ(e.target.value);
        }}
      />

      <div className={`${PAGE_TABLE_WRAP} overflow-x-auto`}>
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={6} cols={12} />
          </div>
        ) : (
          <table className={`${PAGE_TABLE} min-w-[960px] divide-y divide-slate-100 text-sm dark:divide-slate-800`}>
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Aksi</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">SKU</th>
                <th className="min-w-[8rem] px-4 py-3 text-left font-semibold">Nama</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Beli</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Jual</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Stok</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Terjual</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Satuan</th>
                <th className="min-w-[6rem] px-4 py-3 text-left font-semibold">Kategori</th>
                <th className="min-w-[5rem] px-4 py-3 text-left font-semibold">Lokasi</th>
                <th className="min-w-[5rem] px-4 py-3 text-left font-semibold">Merek</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {list.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-nowrap justify-end gap-1">
                      <button type="button" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => printBarcode(p)}>
                        <ScanBarcode className="h-4 w-4" />
                      </button>
                      <label className="cursor-pointer rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(p.id, e.target.files[0])} />
                        📷
                      </label>
                      <button type="button" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => setDelId(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{p.sku}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-right">{formatIDR(p.purchase_price)}</td>
                  <td className="px-4 py-3 text-right">{formatIDR(p.sell_price)}</td>
                  <td className="px-4 py-3 text-right font-medium">{p.stock}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                    {Number(p.qty_sold || 0).toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-3">{p.unit || "PCS"}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{p.categories || "—"}</td>
                  <td className="px-4 py-3 text-xs">{p.location || "—"}</td>
                  <td className="px-4 py-3 text-xs">{p.brand || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{String(p.id).padStart(6, "0")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">
          Hal {page} / {pages} · {total} produk
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} className="rounded-xl border px-3 py-1 disabled:opacity-40" onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          <button type="button" disabled={page >= pages} className="rounded-xl border px-3 py-1 disabled:opacity-40" onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>

      <Modal open={modal === "edit"} title={form.watch("id") ? "Edit produk" : "Produk baru"} onClose={() => setModal(null)} wide>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
          <input type="hidden" {...form.register("id")} />
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500">Nama</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...form.register("name", { required: true })} />
          </div>
          <div>
            <label className="text-xs text-slate-500">SKU</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...form.register("sku")} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Barcode</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...form.register("barcode")} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Harga beli</label>
            <input type="number" className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...form.register("purchase_price")} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Harga jual</label>
            <input type="number" className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...form.register("sell_price")} />
          </div>
          {!form.watch("id") && (
            <div>
              <label className="text-xs text-slate-500">Stok awal</label>
              <input type="number" className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...form.register("stock")} />
            </div>
          )}
          <div>
            <label className="text-xs text-slate-500">Min stok</label>
            <input type="number" className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...form.register("min_stock")} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Satuan</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...form.register("unit")} placeholder="PCS" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Lokasi</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...form.register("location")} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Merek / tipe</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...form.register("brand")} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Supplier</label>
            <select className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...form.register("supplier_id")}>
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500">Kategori</label>
            <Controller
              name="category_ids"
              control={form.control}
              render={({ field }) => (
                <Select
                  isMulti
                  options={categoryOptions}
                  value={categoryOptions.filter((o) => (field.value || []).map(Number).includes(Number(o.value)))}
                  onChange={(chosen) => field.onChange((chosen || []).map((c) => c.value))}
                  placeholder="Pilih satu atau beberapa kategori…"
                  noOptionsMessage={() => "Belum ada kategori — buka halaman Data kategori"}
                  classNamePrefix="prs"
                  className="mt-1"
                  styles={resolvedSelectStyles}
                  menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                  menuPosition="fixed"
                />
              )}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500">Deskripsi</label>
            <textarea className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" rows={3} {...form.register("description")} />
          </div>
          <label className="flex items-center gap-2 md:col-span-2">
            <input type="checkbox" checked={!!form.watch("is_active")} onChange={(e) => form.setValue("is_active", e.target.checked)} />
            Aktif
          </label>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" className="rounded-xl border px-4 py-2" onClick={() => setModal(null)}>
              Batal
            </button>
            <button type="submit" className="rounded-xl bg-brand-600 px-6 py-2 font-semibold text-white">
              Simpan
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!delId}
        title="Hapus produk?"
        message="Data yang dihapus tidak dapat dikembalikan."
        danger
        onConfirm={async () => {
          await api.delete(`/api/products/${delId}`);
          toast.success("Dihapus");
          load();
        }}
        onClose={() => setDelId(null)}
      />

    </PageStack>
  );
}
