import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, ScanBarcode, AlertTriangle, ImageOff } from "lucide-react";
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
import { PaginationBar } from "../components/PaginationBar";
import { useThemeStore } from "../store/themeStore";
import JsBarcode from "jsbarcode";
import { uploadSrc } from "../utils/uploadUrl";

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
  const [removeImgId, setRemoveImgId] = useState(null);
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
      image_path: "",
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

  const watchUnits = form.watch("units") || [];
  const watchPrices = form.watch("prices") || [];
  const watchUnit = form.watch("unit") || "PCS";

  const addUnit = () => {
    const current = form.getValues("units") || [];
    form.setValue("units", [...current, { unit_name: "", conversion_value: 1, purchase_price: 0, sell_price: 0, barcode: "" }]);
  };

  const removeUnit = (index) => {
    const current = form.getValues("units") || [];
    const removedUnitName = current[index]?.unit_name;
    form.setValue("units", current.filter((_, i) => i !== index));
    // Also remove related prices
    if (removedUnitName) {
      const curPrices = form.getValues("prices") || [];
      form.setValue("prices", curPrices.filter(p => String(p.unit_name).toLowerCase() !== String(removedUnitName).toLowerCase()));
    }
  };

  const updateUnit = (index, field, value) => {
    const current = form.getValues("units") || [];
    const updated = [...current];
    updated[index][field] = value;
    form.setValue("units", updated);
  };

  const addPrice = () => {
    const current = form.getValues("prices") || [];
    form.setValue("prices", [...current, { unit_name: watchUnit, customer_category: "grosir", price: 0 }]);
  };

  const removePrice = (index) => {
    const current = form.getValues("prices") || [];
    form.setValue("prices", current.filter((_, i) => i !== index));
  };

  const updatePrice = (index, field, value) => {
    const current = form.getValues("prices") || [];
    const updated = [...current];
    updated[index][field] = value;
    form.setValue("prices", updated);
  };

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
      image_path: "",
      units: [],
      prices: [],
    });
    setModal("edit");
  }

  function openEdit(p) {
    api.get(`/api/products/${p.id}`).then(({ data }) => {
      const fetchedUnits = data.units || [];
      const fetchedPrices = (data.prices || []).map((pr) => {
        let unit_name = data.unit || "PCS";
        if (pr.product_unit_id) {
          const matchedUnit = fetchedUnits.find((u) => u.id === pr.product_unit_id);
          if (matchedUnit) {
            unit_name = matchedUnit.unit_name;
          }
        }
        return {
          ...pr,
          unit_name
        };
      });

      form.reset({
        ...data,
        unit: data.unit || "PCS",
        location: data.location || "",
        brand: data.brand || "",
        supplier_id: data.supplier_id || "",
        category_ids: data.category_ids || [],
        units: fetchedUnits,
        prices: fetchedPrices,
      });
      setModal("edit");
    });
  }

  async function onSubmit(values) {
    const stockNum = Number(values.stock);
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
      units: values.units || [],
      prices: values.prices || [],
    };
    if (values.id) {
      if (Number.isFinite(stockNum)) payload.stock = stockNum;
    } else {
      payload.stock = Number.isFinite(stockNum) ? stockNum : 0;
    }
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
    const { data } = await api.post(`/api/products/${id}/image`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    toast.success("Gambar diunggah");
    load();
    if (String(form.watch("id")) === String(id) && data?.path) form.setValue("image_path", data.path);
  }

  async function confirmRemoveImage() {
    if (!removeImgId) return;
    const t = toast.loading("Menghapus gambar...");
    try {
      await api.delete(`/api/products/${removeImgId}/image`);
      toast.success("Gambar dihapus", { id: t });
      if (String(form.watch("id")) === String(removeImgId)) form.setValue("image_path", "");
      setRemoveImgId(null);
      load();
    } catch {
      toast.dismiss(t);
      setRemoveImgId(null);
    }
  }

  function printBarcode(product) {
    const code = product?.barcode || product?.sku || product;
    const name = typeof product === "object" && product?.name ? String(product.name) : "";
    if (!code) return toast.error("Tanpa kode barcode/SKU");
    const w = window.open("", "_blank", "width=320,height=260");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, String(code), {
      format: "CODE128",
      width: 1.8,
      height: 48,
      displayValue: true,
      fontSize: 11,
      margin: 0,
      textMargin: 1,
    });
    const title = name
      ? `<div style="font-weight:600;font-size:13px;line-height:1.15;margin:0 0 4px 0">${name.replace(/</g, "&lt;")}</div>`
      : "";
    w.document.write(
      `<!DOCTYPE html><html><body style="margin:12px;text-align:center;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;gap:4px">${title}<div style="line-height:0">${svg.outerHTML}</div></body></html>`
    );
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
            <TableSkeleton rows={6} cols={14} />
          </div>
        ) : (
          <table className={`${PAGE_TABLE} min-w-[1040px] divide-y divide-slate-100 text-sm dark:divide-slate-800`}>
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">SKU</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Status</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Aksi</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Foto</th>
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
                <tr key={p.id} className={Number(p.is_active) === 0 ? "opacity-60" : ""}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{p.sku}</td>
                  <td className="px-4 py-3">
                    {Number(p.is_active) === 0 ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                        Nonaktif
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                        Aktif
                      </span>
                    )}
                  </td>
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
                  <td className="px-4 py-3">
                    {p.image_path ? (
                      <div className="relative inline-flex">
                        <img
                          src={uploadSrc(p.image_path)}
                          alt=""
                          className="h-12 w-12 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                        <button
                          type="button"
                          title="Hapus gambar"
                          className="absolute -right-1 -top-1 rounded-full bg-red-600 p-1 text-white shadow hover:bg-red-700"
                          onClick={() => setRemoveImgId(p.id)}
                        >
                          <ImageOff className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-right">{formatIDR(p.purchase_price)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-semibold">{formatIDR(p.sell_price)}</div>
                    {p.prices && p.prices.length > 0 && (
                      <div className="text-[10px] text-slate-500 mt-1 space-y-0.5 text-left border-t pt-1 border-slate-100 dark:border-slate-800">
                        {p.prices.map((pr, idx) => (
                          <div key={idx} className="flex justify-between gap-2">
                            <span className="capitalize">{pr.customer_category}:</span>
                            <span className="font-mono">{formatIDR(pr.price)} ({pr.product_unit_id ? p.units?.find(u => u.id === pr.product_unit_id)?.unit_name : p.unit})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{p.stock}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                    {Number(p.qty_sold || 0).toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{p.unit || "PCS"}</div>
                    {p.units && p.units.length > 0 && (
                      <div className="text-[10px] text-slate-500 mt-1 space-y-0.5 border-t pt-1 border-slate-100 dark:border-slate-800">
                        {p.units.map((u, idx) => (
                          <div key={idx} className="whitespace-nowrap">
                            1 {u.unit_name} = {u.conversion_value} {p.unit} ({formatIDR(u.sell_price)})
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
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

      <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className="text-slate-500">
          Hal {page} / {pages} · {total} produk
        </span>
        <PaginationBar page={page} pages={pages} setPage={setPage} />
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
          <div>
            <label className="text-xs text-slate-500">{form.watch("id") ? "Stok saat ini (ubah langsung)" : "Stok awal"}</label>
            <input type="number" className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...form.register("stock")} />
          </div>
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
          {form.watch("id") && form.watch("image_path") ? (
            <div className="md:col-span-2 flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
              <img
                src={uploadSrc(form.watch("image_path"))}
                alt=""
                className="h-20 w-20 rounded-lg border object-cover"
              />
              <button
                type="button"
                className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                onClick={() => setRemoveImgId(form.watch("id"))}
              >
                Hapus gambar
              </button>
            </div>
          ) : null}
          {/* Section: Multi Satuan */}
          <div className="md:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Multi Satuan (Satuan Tambahan)</h3>
              <button
                type="button"
                onClick={addUnit}
                className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:border-brand-900/50 dark:bg-brand-950/20 dark:text-brand-300"
              >
                + Tambah Satuan
              </button>
            </div>
            {watchUnits.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Belum ada satuan tambahan. Hanya menggunakan satuan dasar ({watchUnit}).</p>
            ) : (
              <div className="space-y-3">
                {watchUnits.map((u, index) => (
                  <div key={index} className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end border border-slate-100 dark:border-slate-800 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                    <div>
                      <label className="text-[10px] text-slate-500">Nama Satuan</label>
                      <input
                        className="mt-1 w-full rounded-lg border px-2 py-1 text-sm dark:bg-slate-950"
                        placeholder="Contoh: BOX, DUS"
                        value={u.unit_name}
                        onChange={(e) => updateUnit(index, "unit_name", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Nilai Konversi ke {watchUnit}</label>
                      <input
                        type="number"
                        min="1"
                        className="mt-1 w-full rounded-lg border px-2 py-1 text-sm dark:bg-slate-950"
                        value={u.conversion_value}
                        onChange={(e) => updateUnit(index, "conversion_value", Number(e.target.value))}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Harga Beli Satuan</label>
                      <input
                        type="number"
                        className="mt-1 w-full rounded-lg border px-2 py-1 text-sm dark:bg-slate-950"
                        value={u.purchase_price}
                        onChange={(e) => updateUnit(index, "purchase_price", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Harga Jual Satuan</label>
                      <input
                        type="number"
                        className="mt-1 w-full rounded-lg border px-2 py-1 text-sm dark:bg-slate-950"
                        value={u.sell_price}
                        onChange={(e) => updateUnit(index, "sell_price", Number(e.target.value))}
                      />
                    </div>
                    <div className="flex items-center gap-1 col-span-2 md:col-span-1">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500">Barcode Satuan</label>
                        <input
                          className="mt-1 w-full rounded-lg border px-2 py-1 text-sm dark:bg-slate-950"
                          placeholder="Barcode khusus"
                          value={u.barcode || ""}
                          onChange={(e) => updateUnit(index, "barcode", e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeUnit(index)}
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 mt-4"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Multi Harga */}
          <div className="md:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Multi Harga (Harga Kategori Pelanggan)</h3>
              <button
                type="button"
                onClick={addPrice}
                className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:border-brand-900/50 dark:bg-brand-950/20 dark:text-brand-300"
              >
                + Tambah Harga Kategori
              </button>
            </div>
            {watchPrices.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Belum ada harga khusus berdasarkan kategori pelanggan.</p>
            ) : (
              <div className="space-y-3">
                {watchPrices.map((p, index) => (
                  <div key={index} className="grid grid-cols-3 md:grid-cols-4 gap-2 items-end border border-slate-100 dark:border-slate-800 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                    <div>
                      <label className="text-[10px] text-slate-500">Satuan</label>
                      <select
                        className="mt-1 w-full rounded-lg border px-2 py-1 text-sm dark:bg-slate-950"
                        value={p.unit_name}
                        onChange={(e) => updatePrice(index, "unit_name", e.target.value)}
                        required
                      >
                        <option value={watchUnit}>{watchUnit} (Dasar)</option>
                        {watchUnits.map((u, ui) => u.unit_name && (
                          <option key={ui} value={u.unit_name}>{u.unit_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Kategori Pelanggan</label>
                      <select
                        className="mt-1 w-full rounded-lg border px-2 py-1 text-sm dark:bg-slate-950"
                        value={p.customer_category}
                        onChange={(e) => updatePrice(index, "customer_category", e.target.value)}
                        required
                      >
                        <option value="umum">Umum</option>
                        <option value="member">Member</option>
                        <option value="grosir">Grosir</option>
                        <option value="wholesale">Wholesale</option>
                        <option value="retail">Retail</option>
                        <option value="institusi">Institusi</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Harga Jual Khusus</label>
                      <input
                        type="number"
                        className="mt-1 w-full rounded-lg border px-2 py-1 text-sm dark:bg-slate-950"
                        value={p.price}
                        onChange={(e) => updatePrice(index, "price", Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="flex justify-end col-span-3 md:col-span-1">
                      <button
                        type="button"
                        onClick={() => removePrice(index)}
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

      <ConfirmDialog
        open={!!removeImgId}
        title="Hapus gambar produk?"
        message="File gambar di server akan dihapus dari disk."
        danger
        confirmText="Hapus"
        onConfirm={confirmRemoveImage}
        onClose={() => setRemoveImgId(null)}
      />

    </PageStack>
  );
}
