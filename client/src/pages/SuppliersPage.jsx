import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import api from "../api/client";
import { PAGE_SIZE } from "../constants/pagination";
import { formatIDR } from "../utils/format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TableSkeleton } from "../components/Skeleton";
import { PAGE_TABLE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";

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
          <h1 className="text-2xl font-bold">Supplier</h1>
          <p className="text-sm text-slate-500">Hutang supplier di kolom balance</p>
        </div>
        <button
          type="button"
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
          className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-5 py-2.5 font-semibold text-white max-w-fit"
        >
          <Plus className="h-5 w-5" /> Tambah
        </button>
      </div>

      <input
        className="max-w-md rounded-2xl border px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        placeholder="Cari..."
        value={q}
        onChange={(e) => {
          setPage(1);
          setQ(e.target.value);
        }}
      />

      <div className={PAGE_TABLE_WRAP}>
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={5} cols={5} />
          </div>
        ) : (
          <table className={PAGE_TABLE}>
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Kontak</th>
                <th className="px-4 py-3 text-right">Total beli</th>
                <th className="px-4 py-3 text-right">Hutang</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {list.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3">{s.whatsapp || s.phone}</td>
                  <td className="px-4 py-3 text-right">{formatIDR(s.total_purchase)}</td>
                  <td className="px-4 py-3 text-right text-red-600">{formatIDR(s.balance_payable)}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { form.reset(s); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" className="p-2 text-red-500" onClick={() => setDelId(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-between text-sm text-slate-500">
        <span>
          Hal {page}/{pages}
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} className="rounded-xl border px-3 py-1" onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          <button type="button" disabled={page >= pages} className="rounded-xl border px-3 py-1" onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>

      <Modal open={open} title={form.watch("id") ? "Edit supplier" : "Supplier baru"} onClose={() => setOpen(false)} wide>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
          <input type="hidden" {...form.register("id")} />
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500">Nama</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("name", { required: true })} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Kontak</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("contact_name")} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Telepon</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("phone")} />
          </div>
          <div>
            <label className="text-xs text-slate-500">WhatsApp</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("whatsapp")} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Email</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("email")} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Kategori</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("category")} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500">Alamat</label>
            <textarea className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" rows={2} {...form.register("address")} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500">Catatan</label>
            <textarea className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" rows={2} {...form.register("notes")} />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" className="rounded-xl border px-4 py-2" onClick={() => setOpen(false)}>
              Batal
            </button>
            <button type="submit" className="rounded-xl bg-brand-600 px-6 py-2 text-white">
              Simpan
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!delId}
        title="Hapus supplier?"
        message="Pastikan tidak ada referensi produk."
        danger
        onConfirm={async () => {
          await api.delete(`/api/suppliers/${delId}`);
          toast.success("Dihapus");
          load();
        }}
        onClose={() => setDelId(null)}
      />
    </PageStack>
  );
}
