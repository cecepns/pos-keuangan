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
          <h1 className="text-2xl font-bold">Pelanggan</h1>
          <p className="text-sm text-slate-500">Total belanja & piutang di backend</p>
        </div>
        <button
          type="button"
          onClick={() => {
            form.reset({ name: "", whatsapp: "", address: "", category: "umum", notes: "" });
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-5 py-2.5 font-semibold text-white max-w-fit"
        >
          <Plus className="h-5 w-5" /> Tambah
        </button>
      </div>

      <input
        className="max-w-md rounded-2xl border px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        placeholder="Cari nama / WA..."
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
                <th className="px-4 py-3 text-left">WhatsApp</th>
                <th className="px-4 py-3 text-left">Kategori</th>
                <th className="px-4 py-3 text-right">Total belanja</th>
                <th className="px-4 py-3 text-right">Piutang</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {list.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">{c.whatsapp}</td>
                  <td className="px-4 py-3 capitalize">{c.category}</td>
                  <td className="px-4 py-3 text-right">{formatIDR(c.total_purchase)}</td>
                  <td className="px-4 py-3 text-right text-amber-600">{formatIDR(c.balance_receivable)}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg" onClick={() => { form.reset(c); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" className="p-2 text-red-500" onClick={() => setDelId(c.id)}>
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

      <Modal open={open} title={form.watch("id") ? "Edit pelanggan" : "Pelanggan baru"} onClose={() => setOpen(false)} wide>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
          <input type="hidden" {...form.register("id")} />
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500">Nama</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("name", { required: true })} />
          </div>
          <div>
            <label className="text-xs text-slate-500">WhatsApp</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("whatsapp")} />
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
        title="Hapus pelanggan?"
        message="Pastikan tidak ada transaksi tertaut."
        danger
        onConfirm={async () => {
          await api.delete(`/api/customers/${delId}`);
          toast.success("Dihapus");
          load();
        }}
        onClose={() => setDelId(null)}
      />
    </PageStack>
  );
}
