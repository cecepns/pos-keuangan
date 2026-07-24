import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, Users } from "lucide-react";
import api from "../api/client";
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

export default function CustomersPage() {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 350);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [delId, setDelId] = useState(null);
  const form = useForm({ defaultValues: { name: "", whatsapp: "", address: "", category: "umum", notes: "" } });

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/api/customers", { params: { q: dq, page, limit: PAGE_SIZE } });
      setList(data.data || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [dq, page]);

  async function onSubmit(v) {
    const t = toast.loading("Menyimpan...");
    try {
      if (v.id) await api.put(`/api/customers/${v.id}`, v);
      else await api.post("/api/customers", v);
      toast.success("Data pelanggan berhasil disimpan", { id: t });
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
        title="Data Pelanggan"
        subtitle={`${total} pelanggan terdaftar · Riwayat belanja dan piutang`}
      >
        <ActionButton
          onClick={() => {
            form.reset({ name: "", whatsapp: "", address: "", category: "umum", notes: "" });
            setOpen(true);
          }}
          variant="primary"
        >
          <Plus className="h-4 w-4" /> Tambah Pelanggan
        </ActionButton>
      </PageHeader>

      <SearchInput
        placeholder="Cari nama atau nomor WhatsApp..."
        value={q}
        onChange={(val) => {
          setPage(1);
          setQ(val);
        }}
      />

      <div className={PAGE_TABLE_WRAP}>
        {loading ? (
          <LoadingSpinner label="Memuat data pelanggan..." />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Tidak ada pelanggan"
            message={q ? "Tidak ada pelanggan yang cocok dengan kata kunci." : "Belum ada pelanggan terdaftar."}
          />
        ) : (
          <table className={PAGE_TABLE}>
            <thead>
              <tr>
                <th>Nama Pelanggan</th>
                <th>WhatsApp</th>
                <th>Kategori</th>
                <th className="text-right">Total Belanja</th>
                <th className="text-right">Piutang</th>
                <th className="w-28 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium text-slate-900 dark:text-white">{c.name}</td>
                  <td className="font-mono text-xs text-slate-600 dark:text-slate-400">{c.whatsapp || "—"}</td>
                  <td>
                    <Badge variant="info" className="capitalize">
                      {c.category || "Umum"}
                    </Badge>
                  </td>
                  <td className="text-right font-medium text-slate-800 dark:text-slate-200">{formatIDR(c.total_purchase)}</td>
                  <td className="text-right font-medium text-amber-600 dark:text-amber-400">{formatIDR(c.balance_receivable)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ActionButton variant="ghost-brand" size="icon" onClick={() => { form.reset(c); setOpen(true); }} title="Edit">
                        <Edit2 className="h-4 w-4" />
                      </ActionButton>
                      <ActionButton variant="ghost-danger" size="icon" onClick={() => setDelId(c.id)} title="Hapus">
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
            Menampilkan {list.length} dari {total} pelanggan (Hal {page} dari {pages})
          </span>
          <PaginationBar page={page} pages={pages} setPage={setPage} />
        </div>
      )}

      <Modal open={open} title={form.watch("id") ? "Edit Pelanggan" : "Tambah Pelanggan Baru"} onClose={() => setOpen(false)} wide>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
          <input type="hidden" {...form.register("id")} />
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Pelanggan</label>
            <input className="input-base mt-1.5" {...form.register("name", { required: true })} placeholder="Nama lengkap..." />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nomor WhatsApp</label>
            <input className="input-base mt-1.5" {...form.register("whatsapp")} placeholder="08..." />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kategori Pelanggan</label>
            <input className="input-base mt-1.5" {...form.register("category")} placeholder="misal: Umum / Member / Grosir" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Alamat</label>
            <textarea className="input-base mt-1.5" rows={2} {...form.register("address")} placeholder="Alamat lengkap..." />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Catatan</label>
            <textarea className="input-base mt-1.5" rows={2} {...form.register("notes")} placeholder="Catatan khusus..." />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <ActionButton variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </ActionButton>
            <ActionButton variant="primary" type="submit">
              Simpan Pelanggan
            </ActionButton>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!delId}
        title="Hapus Pelanggan?"
        message="Pastikan tidak ada transaksi aktif yang terkait dengan pelanggan ini."
        danger
        onConfirm={async () => {
          await api.delete(`/api/customers/${delId}`);
          toast.success("Pelanggan berhasil dihapus");
          load();
        }}
        onClose={() => setDelId(null)}
      />
    </PageStack>
  );
}
