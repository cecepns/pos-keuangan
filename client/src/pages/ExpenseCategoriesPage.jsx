import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Plus, Edit2, ArrowLeft } from "lucide-react";
import api from "../api/client";
import { PAGE_TABLE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Modal } from "../components/Modal";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { ActionButton } from "../components/ActionButton";
import { Badge } from "../components/Badge";

const TYPES = [
  { value: "operational", label: "Operasional" },
  { value: "alat", label: "Alat / Perlengkapan" },
  { value: "pos", label: "POS / Kasir" },
  { value: "lainnya", label: "Lainnya" },
];

export default function ExpenseCategoriesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", type: "operational" });
  const [delId, setDelId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/api/expense-categories");
      setRows(data.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm({ name: "", type: "operational", id: null });
    setModal("edit");
  }

  function openEdit(r) {
    setForm({ id: r.id, name: r.name, type: r.type || "operational" });
    setModal("edit");
  }

  async function save(e) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return toast.error("Nama kategori wajib diisi");
    const t = toast.loading("Menyimpan...");
    try {
      if (form.id) await api.put(`/api/expense-categories/${form.id}`, { name, type: form.type });
      else await api.post("/api/expense-categories", { name, type: form.type });
      toast.success("Kategori pengeluaran disimpan", { id: t });
      setModal(null);
      load();
    } catch {
      toast.dismiss(t);
    }
  }

  return (
    <PageStack>
      <PageHeader
        title="Kategori Pengeluaran"
        subtitle="Kategori biaya operasional (sewa, gaji, perlengkapan, dll)"
      >
        <Link to="/app/expenses">
          <ActionButton variant="secondary">
            <ArrowLeft className="h-4 w-4" /> Kembali ke Pengeluaran
          </ActionButton>
        </Link>
        <ActionButton onClick={openCreate} variant="primary">
          <Plus className="h-4 w-4" /> Tambah Kategori
        </ActionButton>
      </PageHeader>

      <div className={PAGE_TABLE_WRAP}>
        {loading ? (
          <LoadingSpinner label="Memuat kategori pengeluaran..." />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Tidak ada kategori pengeluaran"
            message="Belum ada kategori pengeluaran yang dibuat."
          >
            <ActionButton onClick={openCreate} variant="secondary" size="sm" className="mt-2">
              <Plus className="h-4 w-4" /> Tambah Kategori Baru
            </ActionButton>
          </EmptyState>
        ) : (
          <table className={PAGE_TABLE}>
            <thead>
              <tr>
                <th>Nama Kategori</th>
                <th>Tipe</th>
                <th className="w-24 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium text-slate-900 dark:text-white">{r.name}</td>
                  <td>
                    <Badge variant="neutral" className="capitalize">
                      {TYPES.find((t) => t.value === r.type)?.label || r.type || "—"}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <ActionButton variant="ghost-brand" size="icon" onClick={() => openEdit(r)} title="Edit">
                      <Edit2 className="h-4 w-4" />
                    </ActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modal === "edit"} title={form.id ? "Edit Kategori Pengeluaran" : "Tambah Kategori Baru"} onClose={() => setModal(null)}>
        <form className="space-y-4" onSubmit={save}>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Kategori</label>
            <input
              className="input-base mt-1.5"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="misal: Gaji Karyawan, Listrik & Air..."
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipe Pengeluaran</label>
            <select
              className="input-base mt-1.5"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-between items-center pt-2">
            <div>
              {form.id && (
                <ActionButton type="button" variant="ghost-danger" onClick={() => setDelId(form.id)}>
                  Hapus
                </ActionButton>
              )}
            </div>
            <div className="flex gap-2">
              <ActionButton type="button" variant="secondary" onClick={() => setModal(null)}>
                Batal
              </ActionButton>
              <ActionButton type="submit" variant="primary">
                Simpan
              </ActionButton>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!delId}
        title="Hapus Kategori?"
        message="Kategori yang sudah dipakai di aliran kas tetap aman di data historis."
        danger
        onClose={() => setDelId(null)}
        onConfirm={async () => {
          await api.delete(`/api/expense-categories/${delId}`);
          toast.success("Kategori berhasil dihapus");
          setDelId(null);
          setModal(null);
          load();
        }}
      />
    </PageStack>
  );
}
