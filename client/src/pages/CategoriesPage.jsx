import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";
import api from "../api/client";
import { PAGE_SIZE } from "../constants/pagination";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TableSkeleton } from "../components/Skeleton";
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
    if (!name) return toast.error("Nama wajib");
    const code = draft.code.trim() || null;
    const t = toast.loading("Menyimpan...");
    try {
      if (draft.id) await api.put(`/api/categories/${draft.id}`, { name, code });
      else await api.post("/api/categories", { name, code });
      toast.success("Disimpan", { id: t });
      setOpen(false);
      load();
    } catch {
      toast.dismiss(t);
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageStack>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Data kategori</h1>
          <p className="text-sm text-slate-500">
            {total} kategori · kode bisa diisi manual atau otomatis dari ID
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-5 py-2.5 font-semibold text-white"
        >
          <Plus className="h-5 w-5" /> Tambah
        </button>
      </div>

      <input
        className="max-w-md rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        placeholder="Cari kategori..."
        value={q}
        onChange={(e) => {
          setPage(1);
          setQ(e.target.value);
        }}
      />

      <div className={PAGE_TABLE_WRAP}>
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={6} cols={4} />
          </div>
        ) : (
          <table className={PAGE_TABLE}>
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">No</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Kode</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Nama</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Opsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.map((c, i) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-slate-500">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-4 py-3 font-mono text-sm">{displayCode(c)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{c.name}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="mr-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                      onClick={() => openEdit(c)}
                    >
                      Edit
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                        onClick={() => setDelId(c.id)}
                      >
                        Hapus
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Hal {page} / {pages}
        </span>
        <PaginationBar page={page} pages={pages} setPage={setPage} />
      </div>

      <Modal open={open} title={draft.id ? "Edit kategori" : "Kategori baru"} onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500">Kode (opsional)</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={draft.code}
              onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
              placeholder="Mis. 0001"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Nama</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Nama kategori"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="rounded-xl border px-4 py-2" onClick={() => setOpen(false)}>
              Batal
            </button>
            <button type="button" className="rounded-xl bg-brand-600 px-5 py-2 font-semibold text-white" onClick={save}>
              Simpan
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!delId}
        title="Hapus kategori?"
        message="Pastikan tidak digunakan untuk mapping penting."
        danger
        onConfirm={async () => {
          try {
            await api.delete(`/api/categories/${delId}`);
            toast.success("Dihapus");
            load();
          } catch {
            toast.error("Gagal menghapus");
          }
          setDelId(null);
        }}
        onClose={() => setDelId(null)}
      />
    </PageStack>
  );
}
