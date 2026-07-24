import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Search, X, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../utils/api";
import { API_ENDPOINTS } from "../utils/endpoints";

export default function CatalogAdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Load categories
  const loadCategories = async () => {
    setLoading(true);
    try {
      let url = `${API_ENDPOINTS.ADMIN.CATEGORIES}?page=${page}&limit=${limit}`;
      if (debouncedSearch) url += `&q=${encodeURIComponent(debouncedSearch)}`;
      
      const res = await api.get(url);
      if (res.data?.success) {
        setCategories(res.data.data);
        setTotal(res.data.pagination?.total || 0);
      }
    } catch (err) {
      toast.error("Gagal mengambil data kategori");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [page, limit, debouncedSearch]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormName("");
    setFormCode("");
    setModalOpen(true);
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setFormName(cat.name || "");
    setFormCode(cat.code || "");
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Nama kategori wajib diisi");
      return;
    }
    
    setSubmitting(true);
    try {
      const payload = {
        name: formName.trim(),
        code: formCode.trim() || null
      };
      
      if (editingCategory) {
        // Edit mode
        await api.put(`${API_ENDPOINTS.ADMIN.CATEGORIES}/${editingCategory.id}`, payload);
        toast.success("Kategori berhasil diperbarui");
      } else {
        // Create mode
        await api.post(API_ENDPOINTS.ADMIN.CATEGORIES, payload);
        toast.success("Kategori berhasil dibuat");
      }
      
      setModalOpen(false);
      loadCategories();
    } catch (err) {
      const msg = err.response?.data?.error || "Gagal menyimpan kategori";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (cat) => {
    const confirm = window.confirm(`Apakah Anda yakin ingin menghapus kategori "${cat.name}"?`);
    if (!confirm) return;
    
    const t = toast.loading("Menghapus kategori...");
    try {
      await api.delete(`${API_ENDPOINTS.ADMIN.CATEGORIES}/${cat.id}`);
      toast.success("Kategori berhasil dihapus", { id: t });
      loadCategories();
    } catch (err) {
      const msg = err.response?.data?.error || "Gagal menghapus kategori";
      toast.error(msg, { id: t });
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      
      {/* Top action toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-3 text-slate-400 w-4.5 h-4.5" />
          <input
            type="text"
            placeholder="Cari kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white rounded-xl text-xs font-semibold outline-none border border-slate-100 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
          />
        </div>

        {/* Add button */}
        <button
          onClick={openCreateModal}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs px-5 py-3 rounded-xl shadow-md shadow-emerald-600/15 cursor-pointer transition-all"
        >
          <Plus className="w-4.5 h-4.5" />
          Tambah Kategori
        </button>
      </div>

      {/* Categories table container */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        
        {/* Table content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-2xs uppercase font-extrabold tracking-wider">
                <th className="px-6 py-4">Kode Kategori</th>
                <th className="px-6 py-4">Nama Kategori</th>
                <th className="px-6 py-4">Slug</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-10 text-center">
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
                    <span className="text-xs text-slate-400 font-semibold mt-2 inline-block">Memuat data...</span>
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-10 text-center">
                    <span className="text-xs text-slate-400 font-bold">Kategori kosong. Silakan tambah kategori baru.</span>
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/50 text-xs font-medium text-slate-600 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{cat.code || "—"}</td>
                    <td className="px-6 py-4 text-slate-800 font-extrabold">{cat.name}</td>
                    <td className="px-6 py-4 font-mono text-slate-400">{cat.slug}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(cat)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg transition-all"
                          title="Ubah"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cat)}
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

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="text-2xs font-semibold text-slate-500">
              Menampilkan {categories.length} dari {total} data
            </div>

            <div className="flex items-center gap-3">
              {/* Limit selector */}
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

              {/* Page buttons */}
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

      {/* Modal Form Create/Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in duration-150">
            {/* Close */}
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-md font-extrabold text-slate-800 mb-4 uppercase tracking-tight">
              {editingCategory ? "Ubah Kategori" : "Buat Kategori Baru"}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Nama Kategori</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Anggrek Bulan"
                  className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-xs font-semibold rounded-xl border border-slate-150 focus:border-emerald-300 outline-none transition-all focus:ring-2 focus:ring-emerald-50"
                />
              </div>

              <div>
                <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Kode Kategori (Opsional)</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="Contoh: AB-01"
                  className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-xs font-semibold rounded-xl border border-slate-150 focus:border-emerald-300 outline-none transition-all focus:ring-2 focus:ring-emerald-50"
                />
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
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
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
