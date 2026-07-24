import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, Users, Award, History, PlusCircle, MinusCircle } from "lucide-react";
import api from "../api/client";
import { API_ENDPOINTS } from "../utils/endpoints";
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
  
  // State modal poin
  const [pointsModalCustomer, setPointsModalCustomer] = useState(null);
  const [pointHistory, setPointHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  
  // State form penyesuaian poin
  const [adjustPoints, setAdjustPoints] = useState("");
  const [adjustType, setAdjustType] = useState("earn"); // earn | redeem | adjustment
  const [adjustNote, setAdjustNote] = useState("");
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  const form = useForm({ defaultValues: { name: "", whatsapp: "", address: "", category: "umum", notes: "" } });

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get(API_ENDPOINTS.CUSTOMERS.LIST, { params: { q: dq, page, limit: PAGE_SIZE } });
      setList(data.data || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [dq, page]);

  async function loadPointsHistory(customer, p = 1) {
    setHistoryLoading(true);
    try {
      const { data } = await api.get(API_ENDPOINTS.CUSTOMERS.POINTS_HISTORY(customer.id), {
        params: { page: p, limit: 10 }
      });
      setPointHistory(data.data || []);
      setHistoryTotal(data.total || 0);
      setHistoryPage(p);
    } catch {
      toast.error("Gagal memuat riwayat poin");
    } finally {
      setHistoryLoading(false);
    }
  }

  function openPointsModal(customer) {
    setPointsModalCustomer(customer);
    setAdjustPoints("");
    setAdjustType("earn");
    setAdjustNote("");
    loadPointsHistory(customer, 1);
  }

  async function handleAdjustPoints(e) {
    e.preventDefault();
    const pts = Number(adjustPoints);
    if (!pts || isNaN(pts)) {
      toast.error("Jumlah poin harus berupa angka valid");
      return;
    }
    const finalPoints = adjustType === "redeem" ? -Math.abs(pts) : Math.abs(pts);
    
    setSubmittingAdjust(true);
    const t = toast.loading("Memproses penyesuaian poin...");
    try {
      await api.post(API_ENDPOINTS.CUSTOMERS.ADJUST_POINTS(pointsModalCustomer.id), {
        points: finalPoints,
        type: adjustType === "redeem" ? "redeem" : adjustType === "earn" ? "earn" : "adjustment",
        description: adjustNote || (adjustType === "earn" ? "Bonus poin manual" : adjustType === "redeem" ? "Penukaran poin manual" : "Koreksi poin"),
      });
      toast.success("Poin berhasil diperbarui", { id: t });
      setAdjustPoints("");
      setAdjustNote("");
      // reload customer list & history
      load();
      // Update local customer object point balance
      const updatedPts = (pointsModalCustomer.points || 0) + finalPoints;
      setPointsModalCustomer({ ...pointsModalCustomer, points: Math.max(0, updatedPts) });
      loadPointsHistory(pointsModalCustomer, 1);
    } catch {
      toast.dismiss(t);
    } finally {
      setSubmittingAdjust(false);
    }
  }

  async function onSubmit(v) {
    const t = toast.loading("Menyimpan...");
    try {
      if (v.id) await api.put(API_ENDPOINTS.CUSTOMERS.DETAIL(v.id), v);
      else await api.post(API_ENDPOINTS.CUSTOMERS.LIST, v);
      toast.success("Data pelanggan berhasil disimpan", { id: t });
      setOpen(false);
      load();
    } catch {
      toast.dismiss(t);
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const historyPages = Math.max(1, Math.ceil(historyTotal / 10));

  return (
    <PageStack>
      <PageHeader
        title="Data Pelanggan"
        subtitle={`${total} pelanggan terdaftar · Riwayat belanja, piutang, dan poin loyalty`}
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
                <th className="text-center">Total Poin</th>
                <th className="text-right">Total Belanja</th>
                <th className="text-right">Piutang</th>
                <th className="w-32 text-right">Aksi</th>
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
                  <td className="text-center">
                    <button
                      onClick={() => openPointsModal(c)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60 transition-colors"
                      title="Klik untuk lihat / kelola poin"
                    >
                      <Award className="h-3.5 w-3.5 text-emerald-500" />
                      <span>{Number(c.points || 0).toLocaleString()} Pts</span>
                    </button>
                  </td>
                  <td className="text-right font-medium text-slate-800 dark:text-slate-200">{formatIDR(c.total_purchase)}</td>
                  <td className="text-right font-medium text-amber-600 dark:text-amber-400">{formatIDR(c.balance_receivable)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ActionButton variant="ghost-brand" size="icon" onClick={() => openPointsModal(c)} title="Kelola Poin">
                        <Award className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </ActionButton>
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

      {/* Modal Add/Edit Customer */}
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

      {/* Modal Riwayat & Adjust Poin */}
      <Modal
        open={!!pointsModalCustomer}
        title={`Riwayat & Kelola Poin: ${pointsModalCustomer?.name || ""}`}
        onClose={() => setPointsModalCustomer(null)}
        wide
      >
        <div className="space-y-6">
          {/* Card Total Poin */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
            <div>
              <p className="text-xs font-medium text-emerald-100 uppercase tracking-wider">Saldo Poin Pelanggan</p>
              <h3 className="text-2xl font-extrabold mt-0.5">{Number(pointsModalCustomer?.points || 0).toLocaleString()} Pts</h3>
            </div>
            <Award className="h-10 w-10 text-emerald-200/80" />
          </div>

          {/* Form Adjust Poin */}
          <form onSubmit={handleAdjustPoints} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <PlusCircle className="h-4 w-4 text-emerald-500" /> Penyesuaian Poin Manual
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Jenis Transaksi Poin</label>
                <select
                  className="input-base mt-1 py-1.5 text-xs"
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value)}
                >
                  <option value="earn">+ Tambah Poin (Earn / Bonus)</option>
                  <option value="redeem">- Kurangi Poin (Redeem / Potong)</option>
                  <option value="adjustment">Koreksi Poin (Adjustment)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Jumlah Poin</label>
                <input
                  type="number"
                  min="1"
                  className="input-base mt-1 py-1.5 text-xs"
                  placeholder="Jumlah poin..."
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Keterangan / Alasan</label>
                <input
                  type="text"
                  className="input-base mt-1 py-1.5 text-xs"
                  placeholder="misal: Bonus Ulang Tahun"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <ActionButton type="submit" variant="primary" size="sm" disabled={submittingAdjust}>
                Simpan Penyesuaian
              </ActionButton>
            </div>
          </form>

          {/* Tabel Riwayat Poin */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <History className="h-4 w-4 text-slate-500" /> Riwayat Perubahan Poin
            </h4>
            {historyLoading ? (
              <LoadingSpinner label="Memuat riwayat poin..." />
            ) : pointHistory.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">Belum ada riwayat transaksi poin untuk pelanggan ini.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2.5">Tanggal</th>
                      <th className="p-2.5">Tipe</th>
                      <th className="p-2.5 text-right">Poin</th>
                      <th className="p-2.5">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {pointHistory.map((h) => (
                      <tr key={h.id}>
                        <td className="p-2.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {new Date(h.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="p-2.5">
                          <Badge
                            variant={h.type === "earn" ? "success" : h.type === "redeem" ? "danger" : "warning"}
                            className="capitalize text-[10px]"
                          >
                            {h.type}
                          </Badge>
                        </td>
                        <td className={`p-2.5 text-right font-bold ${h.points > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {h.points > 0 ? `+${h.points}` : h.points}
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300">{h.description || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!historyLoading && historyPages > 1 && (
              <div className="mt-3 flex justify-end">
                <PaginationBar page={historyPage} pages={historyPages} setPage={(p) => loadPointsHistory(pointsModalCustomer, p)} />
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!delId}
        title="Hapus Pelanggan?"
        message="Pastikan tidak ada transaksi aktif yang terkait dengan pelanggan ini."
        danger
        onConfirm={async () => {
          await api.delete(API_ENDPOINTS.CUSTOMERS.DETAIL(delId));
          toast.success("Pelanggan berhasil dihapus");
          load();
        }}
        onClose={() => setDelId(null)}
      />
    </PageStack>
  );
}
