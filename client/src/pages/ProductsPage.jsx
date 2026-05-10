import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, ScanBarcode, Tag } from "lucide-react";
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
import { useAuthStore } from "../store/authStore";
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
  const userRole = useAuthStore((s) => s.user?.role_name);
  const isAdmin = userRole === "admin";
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
  const [catModal, setCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editingCatId, setEditingCatId] = useState(null);
  const [editCatDraft, setEditCatDraft] = useState("");
  const [delCategoryId, setDelCategoryId] = useState(null);
  const [catBusy, setCatBusy] = useState(false);

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
      const { data } = await api.get("/api/products", { params: { q: dq, page, limit: PAGE_SIZE } });
      setList(data.data || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [dq, page]);

  useEffect(() => {
    refreshCategories();
    (async () => {
      const s = await fetchAllPages("/api/suppliers");
      setSuppliers(s);
    })();
  }, [refreshCategories]);

  useEffect(() => {
    if (catModal) refreshCategories();
  }, [catModal, refreshCategories]);

  async function addCategory() {
    const name = newCatName.trim();
    if (!name) return;
    setCatBusy(true);
    const t = toast.loading("Menyimpan...");
    try {
      await api.post("/api/categories", { name });
      toast.success("Kategori ditambahkan", { id: t });
      setNewCatName("");
      await refreshCategories();
    } catch {
      toast.dismiss(t);
    } finally {
      setCatBusy(false);
    }
  }

  async function saveCategoryEdit(id) {
    const name = editCatDraft.trim();
    if (!name) return;
    setCatBusy(true);
    const t = toast.loading("Menyimpan...");
    try {
      await api.put(`/api/categories/${id}`, { name });
      toast.success("Diperbarui", { id: t });
      setEditingCatId(null);
      await refreshCategories();
    } catch {
      toast.dismiss(t);
    } finally {
      setCatBusy(false);
    }
  }

  async function deleteCategory() {
    if (!delCategoryId) return;
    const t = toast.loading("Menghapus...");
    try {
      await api.delete(`/api/categories/${delCategoryId}`);
      toast.success("Kategori dihapus", { id: t });
      setDelCategoryId(null);
      const curIds = form.getValues("category_ids") || [];
      form.setValue(
        "category_ids",
        curIds.filter((cid) => Number(cid) !== Number(delCategoryId))
      );
      await refreshCategories();
    } catch {
      toast.dismiss(t);
    }
  }

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

  function printBarcode(code) {
    const w = window.open("", "_blank", "width=320,height=200");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, code, { format: "CODE128", width: 2, height: 60, displayValue: true });
    w.document.write(`<!DOCTYPE html><html><body style="margin:12px;text-align:center">${svg.outerHTML}</body></html>`);
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
          <p className="text-sm text-slate-500">Kelola SKU, harga, stok & barcode</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCatModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            <Tag className="h-5 w-5 text-brand-600" /> Kelola kategori
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

      <div className={PAGE_TABLE_WRAP}>
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={6} cols={6} />
          </div>
        ) : (
          <table className={`${PAGE_TABLE} divide-y divide-slate-100 text-sm dark:divide-slate-800`}>
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Produk</th>
                <th className="px-4 py-3 text-left font-semibold">SKU</th>
                <th className="px-4 py-3 text-right font-semibold">Beli</th>
                <th className="px-4 py-3 text-right font-semibold">Jual</th>
                <th className="px-4 py-3 text-right font-semibold">Stok</th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {list.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-slate-500">{p.sku}</td>
                  <td className="px-4 py-3 text-right">{formatIDR(p.purchase_price)}</td>
                  <td className="px-4 py-3 text-right">{formatIDR(p.sell_price)}</td>
                  <td className="px-4 py-3 text-right">{p.stock}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button type="button" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => printBarcode(p.barcode || p.sku)}>
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
                  noOptionsMessage={() => "Belum ada kategori — kelola dari tombol atas"}
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

      <Modal open={catModal} title="Kelola kategori" onClose={() => { setCatModal(false); setEditingCatId(null); }}>
        <div className="space-y-4">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              addCategory();
            }}
          >
            <div className="min-w-0 flex-1">
              <label className="text-xs text-slate-500">Nama kategori baru</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="contoh: Tanaman hias"
                disabled={catBusy}
              />
            </div>
            <button
              type="submit"
              disabled={catBusy || !newCatName.trim()}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Tambah
            </button>
          </form>

          <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border dark:divide-slate-800 dark:border-slate-800">
            {categories.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-slate-500">Belum ada kategori</li>
            )}
            {categories.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                {editingCatId === c.id ? (
                  <>
                    <input
                      className="min-w-[8rem] flex-1 rounded-lg border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                      value={editCatDraft}
                      onChange={(e) => setEditCatDraft(e.target.value)}
                      disabled={catBusy}
                    />
                    <button
                      type="button"
                      disabled={catBusy}
                      className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white"
                      onClick={() => saveCategoryEdit(c.id)}
                    >
                      Simpan
                    </button>
                    <button type="button" className="rounded-lg border px-3 py-1 text-xs dark:border-slate-700" onClick={() => setEditingCatId(null)} disabled={catBusy}>
                      Batal
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-900 dark:text-white">{c.name}</span>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={() => {
                        setEditingCatId(c.id);
                        setEditCatDraft(c.name);
                      }}
                      aria-label={`Edit ${c.name}`}
                    >
                      <Pencil className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => setDelCategoryId(c.id)}
                        aria-label={`Hapus ${c.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>

          <p className="text-xs text-slate-500">
            Hapus kategori hanya untuk admin (relasi produk akan dilepas otomatis). Owner dapat menambah dan mengedit nama.
          </p>
        </div>
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
        open={!!delCategoryId}
        title="Hapus kategori?"
        message="Produk yang memakai kategori ini akan kehilangan tag ini. Lanjutkan?"
        danger
        onConfirm={deleteCategory}
        onClose={() => setDelCategoryId(null)}
      />
    </PageStack>
  );
}
