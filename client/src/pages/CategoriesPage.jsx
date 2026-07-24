import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2 } from "lucide-react";
import api from "../api/client";
import { PAGE_SIZE } from "../constants/pagination";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { SearchInput } from "../components/SearchInput";
import { ActionButton } from "../components/ActionButton";
import { PAGE_TABLE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";
import { PaginationBar } from "../components/PaginationBar";
import { useAuthStore } from "../store/authStore";

function displayCode(row) {
  if (row.code && String(row.code).trim()) return String(row.code).trim();
  return String(row.id).padStart(4, "0");
}

export default function CategoriesPage() {
  const role = useAuthStore((s) => s.user?.role_name);
  const isAdmin = role === "admin";
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 350);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [delId, setDelId] = useState(null);
  const [draft, setDraft] = useState({ id: null, name: "", code: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/categories", { params: { q: dq, page, limit: PAGE_SIZE } });
      setList(data.data || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [dq, page]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setDraft({ id: null, name: "", code: "" });
    setOpen(true);
  }

  function openEdit(c) {
    setDraft({ id: c.id, name: c.name, code: c.code || "" });
    setOpen(true);
  }

  async function save() {
    const name = draft.name.trim();
    if (!name) return toast.error("Nama wajib diisi");
    const code = draft.code.trim() || null;
    const t = toast.loading("Menyimpan...");
    try {
      if (draft.id) await api.put(`/api/categories/${draft.id}`, { name, code });
      else await api.post("/api/categories", { name, code });
      toast.success("Kategori berhasil disimpan", { id: t });
      setOpen(false);
      load();
    } catch {
      toast.dismiss(t);
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageStack>
      <PageHeader
        title="Data Kategori"
        subtitle={`${total} kategori terdaftar · kode bisa diisi manual atau otomatis`}
      >
        <ActionButton onClick={openCreate} variant="primary">
          <Plus className="h-4 w-4" /> Tambah Kategori
        </ActionButton>
      </PageHeader>

      <SearchInput
        placeholder="Cari kategori..."
        value={q}
        onChange={(val) => {
          setPage(1);
          setQ(val);
        }}
      />

      <div className={PAGE_TABLE_WRAP}>
        {loading ? (
          <LoadingSpinner label="Memuat kategori..." />
        ) : list.length === 0 ? (
          <EmptyState
            title="Tidak ada kategori"
            message={q ? "Tidak ada kategori yang cocok dengan pencarian." : "Belum ada kategori yang ditambahkan."}
          >
            {!q && (
              <ActionButton onClick={openCreate} variant="secondary" size="sm" className="mt-2">
                <Plus className="h-4 w-4" /> Tambah Sekarang
              </ActionButton>
            )}
          </EmptyState>
        ) : (
          <table className={PAGE_TABLE}>
            <thead>
              <tr>
                <th className="w-16 text-center">No</th>
                <th className="w-32">Kode</th>
                <th>Nama Kategori</th>
                <th className="w-32 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c, i) => (
                <tr key={c.id}>
                  <td className="text-center font-mono text-xs text-slate-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="font-mono text-xs font-medium text-slate-600 dark:text-slate-400">{displayCode(c)}</td>
                  <td className="font-medium text-slate-900 dark:text-white">{c.name}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ActionButton variant="ghost-brand" size="icon" onClick={() => openEdit(c)} title="Edit">
                        <Edit2 className="h-4 w-4" />
                      </ActionButton>
                      {isAdmin && (
                        <ActionButton variant="ghost-danger" size="icon" onClick={() => setDelId(c.id)} title="Hapus">
                          <Trash2 className="h-4 w-4" />
                        </ActionButton>
                      )}
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
            Menampilkan {list.length} dari {total} kategori (Hal {page} dari {pages})
          </span>
          <PaginationBar page={page} pages={pages} setPage={setPage} />
        </div>
      )}

      <Modal open={open} title={draft.id ? "Edit Kategori" : "Tambah Kategori Baru"} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kode Kategori (Opsional)</label>
            <input
              className="input-base mt-1.5"
              value={draft.code}
              onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
              placeholder="Misal: KAT-001"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Kategori</label>
            <input
              className="input-base mt-1.5"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Nama kategori barang..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <ActionButton variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </ActionButton>
            <ActionButton variant="primary" onClick={save}>
              Simpan
            </ActionButton>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!delId}
        title="Hapus Kategori?"
        message="Pastikan kategori ini tidak sedang digunakan oleh barang lain."
        danger
        onConfirm={async () => {
          try {
            await api.delete(`/api/categories/${delId}`);
            toast.success("Kategori berhasil dihapus");
            load();
          } catch {
            toast.error("Gagal menghapus kategori");
          }
          setDelId(null);
        }}
        onClose={() => setDelId(null)}
      />
    </PageStack>
  );
}
