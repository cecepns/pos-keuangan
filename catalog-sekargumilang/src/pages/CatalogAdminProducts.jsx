import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Search, X, Loader2, Upload, Trash, GripVertical } from "lucide-react";

function reorderList(list, fromIndex, toIndex) {
  if (fromIndex === null || fromIndex === toIndex) return list;
  const next = [...list];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
}
import toast from "react-hot-toast";
import { api } from "../utils/api";
import { API_ENDPOINTS } from "../utils/endpoints";
import { formatIDR } from "../utils/format";

export default function CatalogAdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Form fields state
  const [formName, setFormName] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formBarcode, setFormBarcode] = useState("");
  const [formSellPrice, setFormSellPrice] = useState("");
  const [formCrossedPrice, setFormCrossedPrice] = useState("");
  const [formStock, setFormStock] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formSubcategoryId, setFormSubcategoryId] = useState("");
  const [formSortOrder, setFormSortOrder] = useState("");

  // Images upload state
  const [pendingFiles, setPendingFiles] = useState([]); // { file, previewUrl } for Create Mode
  const [existingImages, setExistingImages] = useState([]); // for Edit Mode

  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [dragProductIdx, setDragProductIdx] = useState(null);
  const [reorderingProducts, setReorderingProducts] = useState(false);
  const [dragImageIdx, setDragImageIdx] = useState(null);
  const [dragImageType, setDragImageType] = useState(null);
  const [reorderingImages, setReorderingImages] = useState(false);

  const canReorderProducts = !debouncedSearch.trim();

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Load parent categories & subcategories
  const loadCategories = async () => {
    try {
      const catRes = await api.get(`${API_ENDPOINTS.ADMIN.CATEGORIES}?limit=100`);
      if (catRes.data?.success) setCategories(catRes.data.data);
      
      const subRes = await api.get(`${API_ENDPOINTS.ADMIN.SUBCATEGORIES}?limit=100`);
      if (subRes.data?.success) setSubcategories(subRes.data.data);
    } catch (err) {
      console.error("Gagal mengambil data kategori/subkategori:", err);
    }
  };

  // Load products list
  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get(API_ENDPOINTS.ADMIN.PRODUCTS, {
        params: {
          page,
          limit,
          ...(debouncedSearch ? { q: debouncedSearch } : {}),
        },
      });
      if (res.data?.success) {
        const rows = res.data.data || [];
        const respTotal = res.data.pagination?.total || 0;
        const respLimit = Number(res.data.pagination?.limit) || limit;
        setProducts(rows);
        setTotal(respTotal);
        if (limit > respLimit && rows.length < respTotal && rows.length <= respLimit) {
          toast.error(
            `Server masih membatasi ${respLimit} baris/halaman. Deploy ulang backend terbaru agar limit ${limit} berlaku.`,
            { id: "catalog-limit-cap", duration: 6000 }
          );
        }
      }
    } catch (err) {
      toast.error("Gagal mengambil data produk");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [page, limit, debouncedSearch]);

  const resolveImageUrl = (path) => {
    if (!path) return "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?w=500&auto=format&fit=crop&q=60";
    const apiBase = import.meta.env.VITE_API_BASE_URL || "https://api-be.sekargumilangorchid.my.id";
    return path.startsWith("http") ? path : `${apiBase}${path}`;
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormName("");
    setFormSku("");
    setFormBarcode("");
    setFormSellPrice("");
    setFormCrossedPrice("");
    setFormStock("0");
    setFormDescription("");
    setFormCategoryId(categories[0]?.id || "");
    setFormSubcategoryId("");
    setFormSortOrder("");
    setPendingFiles([]);
    setExistingImages([]);
    setModalOpen(true);
  };

  const openEditModal = (prod) => {
    setEditingProduct(prod);
    setFormName(prod.name || "");
    setFormSku(prod.sku || "");
    setFormBarcode(prod.barcode || "");
    setFormSellPrice(prod.sell_price || "");
    setFormCrossedPrice(prod.crossed_price || "");
    setFormStock(prod.stock !== undefined ? String(prod.stock) : "0");
    setFormDescription(prod.description || "");

    setFormCategoryId(prod.category_id || (categories[0]?.id || ""));
    setFormSubcategoryId(prod.subcategory_id || "");
    setFormSortOrder(prod.sort_order != null ? String(prod.sort_order) : "");

    setPendingFiles([]);
    setExistingImages(prod.images || []);
    setModalOpen(true);
  };

  // Handle local image file selections
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Check size limit: 4MB
    for (const file of files) {
      if (file.size > 4 * 1024 * 1024) {
        toast.error(`File ${file.name} melebihi batas 4MB`);
        return;
      }
    }

    if (editingProduct) {
      // In Edit Mode, upload immediately to the server
      setUploadingImages(true);
      const t = toast.loading("Mengunggah gambar...");
      try {
        const formData = new FormData();
        files.forEach((file) => {
          formData.append("images", file);
        });

        const res = await api.post(API_ENDPOINTS.ADMIN.UPLOAD_IMAGES(editingProduct.id), formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });

        if (res.data?.success) {
          toast.success("Gambar berhasil diunggah", { id: t });
          setExistingImages([...existingImages, ...res.data.images]);
          loadProducts(); // Reload parent list to update primary image if it was null
        }
      } catch (err) {
        toast.error("Gagal mengunggah gambar", { id: t });
      } finally {
        setUploadingImages(false);
      }
    } else {
      // In Create Mode, save files locally for upload after product creation
      const nextPending = [...pendingFiles];
      files.forEach((file) => {
        nextPending.push({
          file,
          previewUrl: URL.createObjectURL(file)
        });
      });
      setPendingFiles(nextPending);
    }
  };

  const handleRemovePendingFile = (index) => {
    const next = [...pendingFiles];
    // Revoke object URL to prevent memory leaks
    URL.revokeObjectURL(next[index].previewUrl);
    next.splice(index, 1);
    setPendingFiles(next);
  };

  const handleProductDrop = async (dropIndex) => {
    if (!canReorderProducts || dragProductIdx === null || dragProductIdx === dropIndex) {
      setDragProductIdx(null);
      return;
    }
    const next = reorderList(products, dragProductIdx, dropIndex);
    setProducts(next);
    setDragProductIdx(null);
    setReorderingProducts(true);
    const t = toast.loading("Menyimpan urutan produk...");
    try {
      await api.put(API_ENDPOINTS.ADMIN.REORDER_PRODUCTS, {
        ids: next.map((p) => p.id),
        sort_values: [...products]
          .map((p) => Number(p.sort_order || 0))
          .sort((a, b) => a - b),
      });
      toast.success("Urutan produk disimpan", { id: t });
    } catch {
      toast.error("Gagal menyimpan urutan produk", { id: t });
      loadProducts();
    } finally {
      setReorderingProducts(false);
    }
  };

  const handleImageDrop = async (dropIndex, type) => {
    if (dragImageIdx === null || dragImageType !== type || dragImageIdx === dropIndex) {
      setDragImageIdx(null);
      setDragImageType(null);
      return;
    }

    if (type === "existing") {
      const next = reorderList(existingImages, dragImageIdx, dropIndex);
      setExistingImages(next);
      setDragImageIdx(null);
      setDragImageType(null);
      if (!editingProduct) return;

      setReorderingImages(true);
      const t = toast.loading("Menyimpan urutan gambar...");
      try {
        await api.put(API_ENDPOINTS.ADMIN.REORDER_IMAGES(editingProduct.id), {
          ids: next.map((img) => img.id),
          sort_values: [...existingImages]
            .map((img) => Number(img.sort_order || 0))
            .sort((a, b) => a - b),
        });
        toast.success("Urutan gambar disimpan", { id: t });
        loadProducts();
      } catch {
        toast.error("Gagal menyimpan urutan gambar", { id: t });
        try {
          const { data } = await api.get(`${API_ENDPOINTS.ADMIN.PRODUCTS}/${editingProduct.id}`);
          if (data?.success) setExistingImages(data.data?.images || []);
        } catch {
          /* */
        }
      } finally {
        setReorderingImages(false);
      }
      return;
    }

    setPendingFiles(reorderList(pendingFiles, dragImageIdx, dropIndex));
    setDragImageIdx(null);
    setDragImageType(null);
  };

  const handleDeleteExistingImage = async (imgId) => {
    if (!editingProduct) return;
    const confirm = window.confirm("Hapus gambar ini dari produk?");
    if (!confirm) return;

    const t = toast.loading("Menghapus gambar...");
    try {
      await api.delete(API_ENDPOINTS.ADMIN.DELETE_IMAGE(editingProduct.id, imgId));
      toast.success("Gambar berhasil dihapus", { id: t });
      setExistingImages(existingImages.filter(img => img.id !== imgId));
      loadProducts(); // Update primary image on product list if needed
    } catch (err) {
      toast.error("Gagal menghapus gambar", { id: t });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Nama produk wajib diisi");
      return;
    }
    if (!formSellPrice || Number(formSellPrice) <= 0) {
      toast.error("Harga jual tidak valid");
      return;
    }
    if (formSortOrder !== "" && (!Number.isFinite(Number(formSortOrder)) || Number(formSortOrder) < 0)) {
      toast.error("Nomor urutan harus angka 0 atau lebih besar");
      return;
    }

    setSubmitting(true);
    const t = toast.loading("Menyimpan data produk...");
    try {
      const payload = {
        name: formName.trim(),
        sku: formSku.trim() || null,
        barcode: formBarcode.trim() || null,
        sell_price: Number(formSellPrice),
        crossed_price: formCrossedPrice ? Number(formCrossedPrice) : null,
        stock: Number(formStock || 0),
        description: formDescription.trim() || null,
        category_id: Number(formCategoryId),
        subcategory_id: formSubcategoryId ? Number(formSubcategoryId) : null,
        is_active: 1,
        ...(formSortOrder !== "" ? { sort_order: Math.trunc(Number(formSortOrder)) } : {}),
      };

      let productId = null;
      if (editingProduct) {
        productId = editingProduct.id;
        await api.put(`${API_ENDPOINTS.ADMIN.PRODUCTS}/${productId}`, payload);
        toast.success("Produk berhasil diperbarui", { id: t });
      } else {
        const res = await api.post(API_ENDPOINTS.ADMIN.PRODUCTS, payload);
        productId = res.data.id;

        // If there are pending files to upload
        if (pendingFiles.length > 0) {
          toast.loading("Mengunggah gambar produk...", { id: t });
          const formData = new FormData();
          pendingFiles.forEach((p) => {
            formData.append("images", p.file);
          });

          await api.post(API_ENDPOINTS.ADMIN.UPLOAD_IMAGES(productId), formData, {
            headers: { "Content-Type": "multipart/form-data" }
          });
        }
        toast.success("Produk berhasil dibuat", { id: t });
      }

      // Cleanup pending object URLs
      pendingFiles.forEach(p => URL.revokeObjectURL(p.previewUrl));
      setModalOpen(false);
      loadProducts();
    } catch (err) {
      const msg = err.response?.data?.error || "Gagal menyimpan produk";
      toast.error(msg, { id: t });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (prod) => {
    const confirm = window.confirm(`Apakah Anda yakin ingin menghapus produk "${prod.name}"?`);
    if (!confirm) return;

    const t = toast.loading("Menghapus produk...");
    try {
      await api.delete(`${API_ENDPOINTS.ADMIN.PRODUCTS}/${prod.id}`);
      toast.success("Produk berhasil dihapus", { id: t });
      loadProducts();
    } catch (err) {
      const msg = err.response?.data?.error || "Gagal menghapus produk";
      toast.error(msg, { id: t });
    }
  };

  const filteredSubcategories = subcategories.filter(
    (s) => Number(s.category_id) === Number(formCategoryId)
  );

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">

      {/* Action bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-3 text-slate-400 w-4.5 h-4.5" />
          <input
            type="text"
            placeholder="Cari produk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white rounded-xl text-xs font-semibold outline-none border border-slate-100 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
          />
        </div>

        {/* Add Product */}
        <button
          onClick={openCreateModal}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs px-5 py-3 rounded-xl shadow-md shadow-emerald-600/15 cursor-pointer transition-all"
        >
          <Plus className="w-4.5 h-4.5" />
          Tambah Produk
        </button>
      </div>

      {!canReorderProducts && (
        <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
          Kosongkan pencarian untuk mengatur urutan produk dengan drag & drop.
        </p>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-2xs uppercase font-extrabold tracking-wider font-sans">
                <th className="px-3 py-4 w-10" aria-label="Urutan" />
                <th className="px-4 py-4 w-16 text-center">No</th>
                <th className="px-6 py-4 w-28">Foto</th>
                <th className="px-6 py-4">Nama Produk</th>
                <th className="px-6 py-4">Harga Jual</th>
                <th className="px-6 py-4">Harga Coret</th>
                <th className="px-6 py-4">Stok</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-10 text-center">
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
                    <span className="text-xs text-slate-400 font-semibold mt-2 inline-block">Memuat data...</span>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-10 text-center">
                    <span className="text-xs text-slate-400 font-bold">Produk kosong. Tambah produk katalog baru.</span>
                  </td>
                </tr>
              ) : (
                products.map((prod, index) => (
                  <tr
                    key={prod.id}
                    className={`hover:bg-slate-50/50 text-xs font-medium text-slate-600 transition-colors ${
                      dragProductIdx === index ? "bg-emerald-50/60" : ""
                    } ${reorderingProducts ? "opacity-70" : ""}`}
                    onDragOver={(e) => {
                      if (!canReorderProducts) return;
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      if (!canReorderProducts) return;
                      e.preventDefault();
                      handleProductDrop(index);
                    }}
                  >
                    <td className="px-3 py-3">
                      {canReorderProducts ? (
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            setDragProductIdx(index);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => setDragProductIdx(null)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 cursor-grab active:cursor-grabbing"
                          title="Seret untuk mengubah urutan"
                          aria-label="Seret untuk mengubah urutan"
                        >
                          <GripVertical className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="inline-block w-7" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs font-bold text-slate-500 tabular-nums">
                      {prod.sort_order ?? "—"}
                    </td>
                    <td className="px-6 py-3">
                      <div className="w-20 h-20 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center shadow-sm">
                        <img
                          src={resolveImageUrl(prod.image_path)}
                          alt={prod.name}
                          className="object-cover w-full h-full"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-3 font-extrabold text-slate-800">
                      <div>
                        {prod.name}
                        {prod.sku && <div className="text-4xs text-slate-400 font-mono tracking-wider font-bold uppercase mt-0.5">{prod.sku}</div>}
                      </div>
                    </td>
                    <td className="px-6 py-3 font-black text-emerald-800">{formatIDR(prod.sell_price)}</td>
                    <td className="px-6 py-3 font-bold text-slate-400 line-through">
                      {prod.crossed_price && Number(prod.crossed_price) > 0 ? formatIDR(prod.crossed_price) : "—"}
                    </td>
                    <td className="px-6 py-3 font-black">
                      {prod.stock > 0 ? (
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-extrabold">{prod.stock}</span>
                      ) : (
                        <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded font-extrabold">Habis</span>
                      )}
                    </td>
                    <td className="px-6 py-3 font-bold">
                      <span className="text-slate-500">
                        {prod.categories || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(prod)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg transition-all"
                          title="Ubah"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod)}
                          className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-all"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination — tampilkan selama ada data agar pemilih jumlah baris tetap bisa dipakai */}
        {total > 0 && (
          <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="text-2xs font-semibold text-slate-500">
              Menampilkan {products.length} dari {total} data
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-2xs font-bold text-slate-400 uppercase">Baris:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-white border border-slate-100 text-2xs font-bold px-2.5 py-1.5 rounded-lg outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-2.5 py-1.5 bg-white border border-slate-100 text-2xs font-bold text-slate-600 rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-all"
                >
                  Sebelumnya
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2.5 py-1.5 bg-white border border-slate-100 text-2xs font-bold text-slate-600 rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-all"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal create/edit product */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl relative my-8 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            <button
              onClick={() => {
                pendingFiles.forEach(p => URL.revokeObjectURL(p.previewUrl));
                setModalOpen(false);
              }}
              className="absolute top-4 right-4 z-10 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 border-b border-slate-100">
              <h3 className="text-md font-extrabold text-slate-800 uppercase tracking-tight">
                {editingProduct ? `Ubah Produk: ${editingProduct.name}` : "Tambah Produk Baru"}
              </h3>
            </div>

            <form onSubmit={handleSave} className="flex-grow overflow-y-auto p-6 space-y-5">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Nama Produk *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Contoh: Dendrobium A0061"
                    className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-xs font-semibold rounded-xl border border-slate-200 focus:border-emerald-300 outline-none transition-all focus:ring-2 focus:ring-emerald-50"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">SKU (Opsional)</label>
                  <input
                    type="text"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    placeholder="Contoh: AG-D01"
                    className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-xs font-semibold rounded-xl border border-slate-200 focus:border-emerald-300 outline-none transition-all focus:ring-2 focus:ring-emerald-50"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Barcode (Opsional)</label>
                  <input
                    type="text"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    placeholder="Contoh: 899..."
                    className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-xs font-semibold rounded-xl border border-slate-200 focus:border-emerald-300 outline-none transition-all focus:ring-2 focus:ring-emerald-50"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Jumlah Stok *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    placeholder="Contoh: 10"
                    className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-xs font-semibold rounded-xl border border-slate-200 focus:border-emerald-300 outline-none transition-all focus:ring-2 focus:ring-emerald-50"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Harga Jual (Rp) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formSellPrice}
                    onChange={(e) => setFormSellPrice(e.target.value)}
                    placeholder="Contoh: 150000"
                    className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-xs font-semibold rounded-xl border border-slate-200 focus:border-emerald-300 outline-none transition-all focus:ring-2 focus:ring-emerald-50"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Harga Coret (Rp) (Opsional)</label>
                  <input
                    type="number"
                    min="0"
                    value={formCrossedPrice}
                    onChange={(e) => setFormCrossedPrice(e.target.value)}
                    placeholder="Contoh: 200000"
                    className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-xs font-semibold rounded-xl border border-slate-200 focus:border-emerald-300 outline-none transition-all focus:ring-2 focus:ring-emerald-50"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Kategori Induk *</label>
                  <select
                    required
                    value={formCategoryId}
                    onChange={(e) => {
                      setFormCategoryId(e.target.value);
                      setFormSubcategoryId(""); // Reset subcategory when category changes
                    }}
                    className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-xs font-semibold rounded-xl border border-slate-200 focus:border-emerald-300 outline-none transition-all cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Sub Kategori (Opsional)</label>
                  <select
                    value={formSubcategoryId}
                    onChange={(e) => setFormSubcategoryId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-xs font-semibold rounded-xl border border-slate-200 focus:border-emerald-300 outline-none transition-all cursor-pointer"
                  >
                    <option value="">-- Tanpa Sub Kategori --</option>
                    {filteredSubcategories.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                    Nomor Urutan {editingProduct ? "" : "(Opsional)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(e.target.value)}
                    placeholder={editingProduct ? "Contoh: 10" : "Kosongkan = otomatis di akhir"}
                    className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-xs font-semibold rounded-xl border border-slate-200 focus:border-emerald-300 outline-none transition-all focus:ring-2 focus:ring-emerald-50"
                  />
                  <p className="mt-1 text-[10px] text-slate-400 font-medium">
                    Angka lebih kecil tampil lebih dulu di katalog. Bisa juga diatur lewat drag & drop di tabel.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Deskripsi Produk</label>
                <textarea
                  rows="3"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Keterangan tambahan..."
                  className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-xs font-semibold rounded-xl border border-slate-200 focus:border-emerald-300 outline-none transition-all focus:ring-2 focus:ring-emerald-50"
                ></textarea>
              </div>

              {/* Multiple Images Selector */}
              <div className="space-y-2.5">
                <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider">Gambar Produk (Bisa Multiple)</label>
                <p className="text-[10px] text-slate-400 font-medium">
                  Seret ikon grip pada gambar untuk mengatur urutan. Gambar pertama = foto utama produk.
                </p>

                {/* Images grid list */}
                <div className={`flex flex-wrap gap-3 ${reorderingImages ? "opacity-70 pointer-events-none" : ""}`}>

                  {/* Upload box */}
                  <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all">
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="text-[10px] text-slate-400 font-bold">Upload</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={uploadingImages}
                    />
                  </label>

                  {/* Existing Images Previews (Edit Mode) */}
                  {existingImages.map((img, index) => (
                    <div
                      key={img.id}
                      className={`relative w-24 h-24 rounded-2xl border overflow-hidden bg-slate-50 group ${
                        dragImageIdx === index && dragImageType === "existing"
                          ? "border-emerald-400 ring-2 ring-emerald-100"
                          : "border-slate-100"
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleImageDrop(index, "existing");
                      }}
                    >
                      {index === 0 && (
                        <span className="absolute top-1 left-1 z-10 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          Utama
                        </span>
                      )}
                      <img src={resolveImageUrl(img.image_path)} className="object-cover w-full h-full" alt="existing-img" />
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          setDragImageIdx(index);
                          setDragImageType("existing");
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDragImageIdx(null);
                          setDragImageType(null);
                        }}
                        className="absolute top-1 right-1 z-10 rounded bg-white/90 p-1 text-slate-500 shadow cursor-grab active:cursor-grabbing"
                        title="Seret untuk mengubah urutan"
                        aria-label="Seret untuk mengubah urutan gambar"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteExistingImage(img.id)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-150 cursor-pointer"
                      >
                        <Trash className="w-5 h-5 text-rose-400" />
                      </button>
                    </div>
                  ))}

                  {/* Pending upload previews (Create Mode) */}
                  {pendingFiles.map((p, idx) => (
                    <div
                      key={p.previewUrl}
                      className={`relative w-24 h-24 rounded-2xl border overflow-hidden bg-slate-50 group animate-in fade-in duration-100 ${
                        dragImageIdx === idx && dragImageType === "pending"
                          ? "border-emerald-400 ring-2 ring-emerald-100"
                          : "border-slate-100"
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleImageDrop(idx, "pending");
                      }}
                    >
                      {idx === 0 && (
                        <span className="absolute top-1 left-1 z-10 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          Utama
                        </span>
                      )}
                      <img src={p.previewUrl} className="object-cover w-full h-full" alt={`pending-img-${idx}`} />
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          setDragImageIdx(idx);
                          setDragImageType("pending");
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDragImageIdx(null);
                          setDragImageType(null);
                        }}
                        className="absolute top-1 right-1 z-10 rounded bg-white/90 p-1 text-slate-500 shadow cursor-grab active:cursor-grabbing"
                        title="Seret untuk mengubah urutan"
                        aria-label="Seret untuk mengubah urutan gambar"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemovePendingFile(idx)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-150 cursor-pointer"
                      >
                        <Trash className="w-5 h-5 text-rose-400" />
                      </button>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-slate-400 font-medium italic">
                  * File gambar maksimal 4MB.
                </p>
              </div>

              {/* Modal Buttons Footer */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    pendingFiles.forEach(p => URL.revokeObjectURL(p.previewUrl));
                    setModalOpen(false);
                  }}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 text-xs font-extrabold rounded-xl hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/10"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Produk
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
