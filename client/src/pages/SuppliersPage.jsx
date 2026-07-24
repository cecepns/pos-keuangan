import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, Truck, ExternalLink } from "lucide-react";
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
import { PAGE_TABLE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";
import { PaginationBar } from "../components/PaginationBar";

export default function SuppliersPage() {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 350);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [delId, setDelId] = useState(null);
  const form = useForm({
    defaultValues: { name: "", contact_name: "", phone: "", whatsapp: "", email: "", address: "", category: "", notes: "" },
  });

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/api/suppliers", { params: { q: dq, page, limit: PAGE_SIZE } });
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
      if (v.id) await api.put(`/api/suppliers/${v.id}`, v);
      else await api.post("/api/suppliers", v);
      toast.success("Data supplier berhasil disimpan", { id: t });
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
        title="Data Supplier"
        subtitle={`${total} supplier terdaftar · Kelola hutang dan riwayat pembelian`}
      >
        <Link to="/app/supplier-payables">
          <ActionButton variant="secondary">
            Hutang Supplier <ExternalLink className="h-3.5 w-3.5" />
          </ActionButton>
        </Link>
        <ActionButton
          onClick={() => {
            form.reset({
              name: "",
              contact_name: "",
              phone: "",
              whatsapp: "",
              email: "",
              address: "",
              category: "",
              notes: "",
            });
            setOpen(true);
          }}
          variant="primary"
        >
          <Plus className="h-4 w-4" /> Tambah Supplier
        </ActionButton>
      </PageHeader>

      <SearchInput
        placeholder="Cari nama supplier, kontak..."
        value={q}
        onChange={(val) => {
          setPage(1);
          setQ(val);
        }}
      />

      <div className={PAGE_TABLE_WRAP}>
        {loading ? (
          <LoadingSpinner label="Memuat data supplier..." />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="Tidak ada supplier"
            message={q ? "Tidak ada supplier yang cocok dengan kata kunci." : "Belum ada supplier terdaftar."}
          />
        ) : (
          <table className={PAGE_TABLE}>
            <thead>
              <tr>
                <th>Nama Supplier</th>
                <th>Kontak / WhatsApp</th>
                <th className="text-right">Total Pembelian</th>
                <th className="text-right">Sisa Hutang</th>
                <th className="w-28 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium text-slate-900 dark:text-white">{s.name}</td>
                  <td className="font-mono text-xs text-slate-600 dark:text-slate-400">{s.whatsapp || s.phone || "—"}</td>
                  <td className="text-right font-medium text-slate-800 dark:text-slate-200">{formatIDR(s.total_purchase)}</td>
                  <td className="text-right font-medium text-red-600 dark:text-red-400">{formatIDR(s.balance_payable)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ActionButton variant="ghost-brand" size="icon" onClick={() => { form.reset(s); setOpen(true); }} title="Edit">
                        <Edit2 className="h-4 w-4" />
                      </ActionButton>
                      <ActionButton variant="ghost-danger" size="icon" onClick={() => setDelId(s.id)} title="Hapus">
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
            Menampilkan {list.length} dari {total} supplier (Hal {page} dari {pages})
          </span>
          <PaginationBar page={page} pages={pages} setPage={setPage} />
        </div>
      )}

      <Modal open={open} title={form.watch("id") ? "Edit Supplier" : "Tambah Supplier Baru"} onClose={() => setOpen(false)} wide>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
          <input type="hidden" {...form.register("id")} />
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Supplier / PT</label>
            <input className="input-base mt-1.5" {...form.register("name", { required: true })} placeholder="Nama supplier..." />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Kontak (Sales/PIC)</label>
            <input className="input-base mt-1.5" {...form.register("contact_name")} placeholder="Nama PIC..." />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">WhatsApp</label>
            <input className="input-base mt-1.5" {...form.register("whatsapp")} placeholder="08..." />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Telepon</label>
            <input className="input-base mt-1.5" {...form.register("phone")} placeholder="No. telp kantor..." />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <input className="input-base mt-1.5" {...form.register("email")} placeholder="email@supplier.com" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kategori Barang Supplier</label>
            <input className="input-base mt-1.5" {...form.register("category")} placeholder="misal: Pupuk, Pot, Anggrek..." />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Alamat Kantor / Gudang</label>
            <textarea className="input-base mt-1.5" rows={2} {...form.register("address")} />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Catatan</label>
            <textarea className="input-base mt-1.5" rows={2} {...form.register("notes")} />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <ActionButton variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </ActionButton>
            <ActionButton variant="primary" type="submit">
              Simpan Supplier
            </ActionButton>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!delId}
        title="Hapus Supplier?"
        message="Pastikan tidak ada barang atau riwayat transaksi terkait dengan supplier ini."
        danger
        onConfirm={async () => {
          await api.delete(`/api/suppliers/${delId}`);
          toast.success("Supplier berhasil dihapus");
          load();
        }}
        onClose={() => setDelId(null)}
      />
    </PageStack>
  );
}
