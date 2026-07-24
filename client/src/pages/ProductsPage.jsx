import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, ScanBarcode, AlertTriangle, ImageOff, FolderOpen, Package } from "lucide-react";
import Select from "react-select";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PAGE_SIZE } from "../constants/pagination";
import { formatIDR } from "../utils/format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { SearchInput } from "../components/SearchInput";
import { ActionButton } from "../components/ActionButton";
import { Badge } from "../components/Badge";
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
      reward_points: 0,
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
      reward_points: 0,
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
        reward_points: data.reward_points || 0,
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
      reward_points: Number(values.reward_points || 0),
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
      toast.success("Produk berhasil disimpan", { id: t });
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
    toast.success("Gambar produk berhasil diunggah");
    load();
    if (String(form.watch("id")) === String(id) && data?.path) form.setValue("image_path", data.path);
  }

  async function confirmRemoveImage() {
    if (!removeImgId) return;
    const t = toast.loading("Menghapus gambar...");
    try {
      await api.delete(`/api/products/${removeImgId}/image`);
      toast.success("Gambar berhasil dihapus", { id: t });
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
    if (!code) return toast.error("Produk tidak memiliki barcode/SKU");
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
      <PageHeader
        title="Data Produk / Barang"
        subtitle={`${total} barang terdaftar · SKU, kategori, multi satuan & harga`}
      >
        <Link to="/app/categories">
          <ActionButton variant="secondary">
            <FolderOpen className="h-4 w-4" /> Kategori
          </ActionButton>
        </Link>
        <ActionButton
          variant={lowStockOnly ? "warning" : "secondary"}
          onClick={() => {
            setPage(1);
            setLowStockOnly((v) => !v);
          }}
        >
          <AlertTriangle className="h-4 w-4" /> Stok Limit
        </ActionButton>
        <ActionButton onClick={openCreate} variant="primary">
          <Plus className="h-4 w-4" /> Tambah Produk
        </ActionButton>
      </PageHeader>

      <SearchInput
        placeholder="Cari produk berdasarkan nama, SKU, barcode..."
        value={q}
        onChange={(val) => {
          setPage(1);
          setQ(val);
        }}
      />

      <div className={`${PAGE_TABLE_WRAP} overflow-x-auto`}>
        {loading ? (
          <LoadingSpinner label="Memuat produk..." />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Tidak ada produk"
            message={q ? "Tidak ada produk yang cocok dengan pencarian." : "Belum ada produk yang ditambahkan."}
          >
            {!q && (
              <ActionButton onClick={openCreate} variant="secondary" size="sm" className="mt-2">
                <Plus className="h-4 w-4" /> Tambah Produk Baru
              </ActionButton>
            )}
          </EmptyState>
        ) : (
          <table className={`${PAGE_TABLE} min-w-[1040px]`}>
            <thead>
              <tr>
                <th className="w-24">SKU</th>
                <th className="w-20">Status</th>
                <th className="w-14 text-center">Foto</th>
                <th>Nama Produk</th>
                <th className="text-right">Harga Beli</th>
                <th className="text-right">Harga Jual</th>
                <th className="text-right">Stok</th>
                <th className="text-right">Terjual</th>
                <th>Satuan</th>
                <th>Kategori</th>
                <th>Merek</th>
                <th className="w-32 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className={Number(p.is_active) === 0 ? "opacity-60" : ""}>
                  <td className="font-mono text-xs font-medium text-slate-600 dark:text-slate-400">{p.sku || "—"}</td>
                  <td>
                    {Number(p.is_active) === 0 ? (
                      <Badge variant="neutral">Nonaktif</Badge>
                    ) : (
                      <Badge variant="success">Aktif</Badge>
                    )}
                  </td>
                  <td className="text-center">
                    {p.image_path ? (
                      <div className="relative inline-flex">
                        <img
                          src={uploadSrc(p.image_path)}
                          alt=""
                          className="h-10 w-10 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                        <button
                          type="button"
                          title="Hapus gambar"
                          className="absolute -right-1 -top-1 rounded-full bg-red-600 p-0.5 text-white shadow hover:bg-red-700"
                          onClick={() => setRemoveImgId(p.id)}
                        >
                          <ImageOff className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="font-medium text-slate-900 dark:text-white">{p.name}</td>
                  <td className="text-right font-mono text-xs text-slate-600 dark:text-slate-400">{formatIDR(p.purchase_price)}</td>
                  <td className="text-right">
                    <div className="font-semibold text-slate-900 dark:text-white">{formatIDR(p.sell_price)}</div>
                    {p.prices && p.prices.length > 0 && (
                      <div className="mt-1 space-y-0.5 text-left font-mono text-[10px] text-slate-500 border-t pt-1 border-slate-100 dark:border-slate-800">
                        {p.prices.map((pr, idx) => (
                          <div key={idx} className="flex justify-between gap-2">
                            <span className="capitalize">{pr.customer_category}:</span>
                            <span>{formatIDR(pr.price)} ({pr.product_unit_id ? p.units?.find(u => u.id === pr.product_unit_id)?.unit_name : p.unit})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="text-right">
                    <span className={`font-mono text-xs font-semibold ${p.stock <= p.min_stock ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white"}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="text-right font-mono text-xs text-slate-600 dark:text-slate-400">
                    {Number(p.qty_sold || 0).toLocaleString("id-ID")}
                  </td>
                  <td>
                    <div className="font-medium text-slate-900 dark:text-white">{p.unit || "PCS"}</div>
                    {p.units && p.units.length > 0 && (
                      <div className="mt-1 space-y-0.5 text-[10px] text-slate-500 border-t pt-1 border-slate-100 dark:border-slate-800">
                        {p.units.map((u, idx) => (
                          <div key={idx} className="whitespace-nowrap">
                            1 {u.unit_name} = {u.conversion_value} {p.unit} ({formatIDR(u.sell_price)})
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="text-xs text-slate-600 dark:text-slate-400">{p.categories || "—"}</td>
                  <td className="text-xs text-slate-600 dark:text-slate-400">{p.brand || "—"}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ActionButton variant="ghost" size="icon" onClick={() => printBarcode(p)} title="Cetak Barcode">
                        <ScanBarcode className="h-4 w-4" />
                      </ActionButton>
                      <label className="cursor-pointer rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" title="Unggah Foto">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(p.id, e.target.files[0])} />
                        📷
                      </label>
                      <ActionButton variant="ghost-brand" size="icon" onClick={() => openEdit(p)} title="Edit">
                        <Edit2 className="h-4 w-4" />
                      </ActionButton>
                      <ActionButton variant="ghost-danger" size="icon" onClick={() => setDelId(p.id)} title="Hapus">
                        <Trash2 className="h-4 w-4" />
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && list.length > 0 && (
        <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Menampilkan {list.length} dari {total} produk (Hal {page} dari {pages})
          </span>
          <PaginationBar page={page} pages={pages} setPage={setPage} />
        </div>
      )}

      <Modal open={modal === "edit"} title={form.watch("id") ? "Edit Produk" : "Tambah Produk Baru"} onClose={() => setModal(null)} wide>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
          <input type="hidden" {...form.register("id")} />
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Produk</label>
            <input className="input-base mt-1.5" {...form.register("name", { required: true })} placeholder="Nama barang..." />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">SKU</label>
            <input className="input-base mt-1.5" {...form.register("sku")} placeholder="Kode SKU..." />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Barcode</label>
            <input className="input-base mt-1.5" {...form.register("barcode")} placeholder="Kode Barcode..." />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Harga Beli (Modal)</label>
            <input type="number" className="input-base mt-1.5" {...form.register("purchase_price")} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Harga Jual (Utama)</label>
            <input type="number" className="input-base mt-1.5" {...form.register("sell_price")} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{form.watch("id") ? "Stok Saat Ini" : "Stok Awal"}</label>
            <input type="number" className="input-base mt-1.5" {...form.register("stock")} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Min. Stok (Batas Menipis)</label>
            <input type="number" className="input-base mt-1.5" {...form.register("min_stock")} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Satuan Utama</label>
            <input className="input-base mt-1.5" {...form.register("unit")} placeholder="PCS" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Lokasi / Rak</label>
            <input className="input-base mt-1.5" {...form.register("location")} placeholder="misal: Rak A-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Merek / Tipe</label>
            <input className="input-base mt-1.5" {...form.register("brand")} placeholder="Merk..." />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Poin Hadiah (Per Item)</label>
            <input type="number" min="0" className="input-base mt-1.5" {...form.register("reward_points")} placeholder="0" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Supplier</label>
            <select className="input-base mt-1.5" {...form.register("supplier_id")}>
              <option value="">— Pilih Supplier —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kategori</label>
            <Controller
              name="category_ids"
              control={form.control}
              render={({ field }) => (
                <Select
                  isMulti
                  options={categoryOptions}
                  value={categoryOptions.filter((o) => (field.value || []).map(Number).includes(Number(o.value)))}
                  onChange={(chosen) => field.onChange((chosen || []).map((c) => c.value))}
                  placeholder="Pilih satu atau beberapa kategori..."
                  noOptionsMessage={() => "Belum ada kategori — buka halaman Data Kategori"}
                  classNamePrefix="prs"
                  className="mt-1.5"
                  styles={resolvedSelectStyles}
                  menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                  menuPosition="fixed"
                />
              )}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Deskripsi Produk</label>
            <textarea className="input-base mt-1.5" rows={3} {...form.register("description")} />
          </div>

          {form.watch("id") && form.watch("image_path") ? (
            <div className="md:col-span-2 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 p-3 dark:border-slate-800">
              <img
                src={uploadSrc(form.watch("image_path"))}
                alt=""
                className="h-16 w-16 rounded-lg border object-cover"
              />
              <ActionButton
                type="button"
                variant="ghost-danger"
                size="sm"
                onClick={() => setRemoveImgId(form.watch("id"))}
              >
                Hapus Gambar
              </ActionButton>
            </div>
          ) : null}

          {/* Section: Multi Satuan */}
          <div className="md:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Multi Satuan (Satuan Tambahan)</h3>
              <ActionButton
                type="button"
                onClick={addUnit}
                variant="secondary"
                size="xs"
              >
                + Tambah Satuan
              </ActionButton>
            </div>
            {watchUnits.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Belum ada satuan tambahan. Hanya menggunakan satuan dasar ({watchUnit}).</p>
            ) : (
              <div className="space-y-3">
                {watchUnits.map((u, index) => (
                  <div key={index} className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end border border-slate-100 dark:border-slate-800 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                    <div>
                      <label className="text-[10px] font-medium text-slate-500">Nama Satuan</label>
                      <input
                        className="input-base mt-1 py-1 px-2 text-xs"
                        placeholder="Contoh: DUS"
                        value={u.unit_name}
                        onChange={(e) => updateUnit(index, "unit_name", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-500">Konversi ke {watchUnit}</label>
                      <input
                        type="number"
                        min="1"
                        className="input-base mt-1 py-1 px-2 text-xs"
                        value={u.conversion_value}
                        onChange={(e) => updateUnit(index, "conversion_value", Number(e.target.value))}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-500">Harga Beli Satuan</label>
                      <input
                        type="number"
                        className="input-base mt-1 py-1 px-2 text-xs"
                        value={u.purchase_price}
                        onChange={(e) => updateUnit(index, "purchase_price", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-500">Harga Jual Satuan</label>
                      <input
                        type="number"
                        className="input-base mt-1 py-1 px-2 text-xs"
                        value={u.sell_price}
                        onChange={(e) => updateUnit(index, "sell_price", Number(e.target.value))}
                      />
                    </div>
                    <div className="flex items-center gap-1 col-span-2 md:col-span-1">
                      <div className="flex-1">
                        <label className="text-[10px] font-medium text-slate-500">Barcode Satuan</label>
                        <input
                          className="input-base mt-1 py-1 px-2 text-xs"
                          placeholder="Barcode"
                          value={u.barcode || ""}
                          onChange={(e) => updateUnit(index, "barcode", e.target.value)}
                        />
                      </div>
                      <ActionButton
                        type="button"
                        onClick={() => removeUnit(index)}
                        variant="ghost-danger"
                        size="icon"
                        className="mt-4"
                      >
                        <Trash2 className="h-4 w-4" />
                      </ActionButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Multi Harga */}
          <div className="md:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Multi Harga (Kategori Pelanggan)</h3>
              <ActionButton
                type="button"
                onClick={addPrice}
                variant="secondary"
                size="xs"
              >
                + Tambah Harga Kategori
              </ActionButton>
            </div>
            {watchPrices.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Belum ada harga khusus berdasarkan kategori pelanggan.</p>
            ) : (
              <div className="space-y-3">
                {watchPrices.map((p, index) => (
                  <div key={index} className="grid grid-cols-3 md:grid-cols-4 gap-2 items-end border border-slate-100 dark:border-slate-800 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                    <div>
                      <label className="text-[10px] font-medium text-slate-500">Satuan</label>
                      <select
                        className="input-base mt-1 py-1 px-2 text-xs"
                        value={p.unit_name}
                        onChange={(e) => updatePrice(index, "unit_name", e.target.value)}
                        required
                      >
                        <option value={watchUnit}>{watchUnit} (Utama)</option>
                        {watchUnits.map((u, ui) => u.unit_name && (
                          <option key={ui} value={u.unit_name}>{u.unit_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-500">Kategori Pelanggan</label>
                      <select
                        className="input-base mt-1 py-1 px-2 text-xs"
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
                      <label className="text-[10px] font-medium text-slate-500">Harga Jual Khusus</label>
                      <input
                        type="number"
                        className="input-base mt-1 py-1 px-2 text-xs"
                        value={p.price}
                        onChange={(e) => updatePrice(index, "price", Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="flex justify-end col-span-3 md:col-span-1">
                      <ActionButton
                        type="button"
                        onClick={() => removePrice(index)}
                        variant="ghost-danger"
                        size="xs"
                      >
                        Hapus
                      </ActionButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 md:col-span-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" className="accent-brand-600" checked={!!form.watch("is_active")} onChange={(e) => form.setValue("is_active", e.target.checked)} />
            Produk Aktif
          </label>
          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <ActionButton variant="secondary" onClick={() => setModal(null)}>
              Batal
            </ActionButton>
            <ActionButton variant="primary" type="submit">
              Simpan Produk
            </ActionButton>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!delId}
        title="Hapus Produk?"
        message="Data yang dihapus tidak dapat dikembalikan."
        danger
        onConfirm={async () => {
          await api.delete(`/api/products/${delId}`);
          toast.success("Produk berhasil dihapus");
          load();
        }}
        onClose={() => setDelId(null)}
      />

      <ConfirmDialog
        open={!!removeImgId}
        title="Hapus Gambar Produk?"
        message="File gambar di server akan dihapus dari disk."
        danger
        confirmText="Hapus"
        onConfirm={confirmRemoveImage}
        onClose={() => setRemoveImgId(null)}
      />
    </PageStack>
  );
}
