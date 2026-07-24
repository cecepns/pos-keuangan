import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Edit2, Trash2, FolderTree, Banknote } from "lucide-react";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PAGE_SIZE } from "../constants/pagination";
import { formatIDR, formatReportDateCell } from "../utils/format";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { ActionButton } from "../components/ActionButton";
import { Badge } from "../components/Badge";
import { PAGE_TABLE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";
import { PaginationBar } from "../components/PaginationBar";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";

function splitDescription(desc) {
  const s = String(desc || "");
  const i = s.indexOf(" — ");
  if (i === -1) return { purpose: s, keterangan: "" };
  return { purpose: s.slice(0, i), keterangan: s.slice(i + 3) };
}

export default function OperationalExpensePage() {
  const [nextCode, setNextCode] = useState("000001");
  const [accounts, setAccounts] = useState([]);
  const [expenseCats, setExpenseCats] = useState([]);
  const [purposeName, setPurposeName] = useState("");
  const [expenseCategoryId, setExpenseCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [flowDate, setFlowDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [keterangan, setKeterangan] = useState("");
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cashAccountId, setCashAccountId] = useState("");
  const [editRow, setEditRow] = useState(null);
  const [editPurpose, setEditPurpose] = useState("");
  const [editKeterangan, setEditKeterangan] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editFlowDate, setEditFlowDate] = useState("");
  const [editCashAccountId, setEditCashAccountId] = useState("");
  const [deleteId, setDeleteId] = useState(null);

  async function refreshPreview() {
    try {
      const { data } = await api.get("/api/cash-flows/next-code");
      if (data?.code) setNextCode(data.code);
    } catch {
      /* */
    }
  }

  async function loadRecent() {
    setLoading(true);
    try {
      const { data } = await api.get("/api/cash-flows", { params: { page, limit: PAGE_SIZE, type: "out" } });
      setRows(data.data || []);
      setTotal(Number(data.total ?? 0));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshPreview();
    (async () => {
      const acc = await fetchAllPages("/api/cash-accounts");
      setAccounts(acc);
      setCashAccountId((prev) => prev || (acc[0] ? String(acc[0].id) : ""));
      try {
        const { data } = await api.get("/api/expense-categories");
        setExpenseCats(data.data || []);
      } catch {
        setExpenseCats([]);
      }
    })();
  }, []);

  useEffect(() => {
    loadRecent();
  }, [page]);

  async function submit(e) {
    e.preventDefault();
    const name = purposeName.trim();
    if (!name) return toast.error("Nama keperluan wajib diisi");
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Biaya tidak valid");
    const accId = Number(cashAccountId || accounts[0]?.id);
    if (!accId) return toast.error("Belum ada rekening kas");
    const desc = keterangan.trim() ? `${name} — ${keterangan.trim()}` : name;
    const t = toast.loading("Menyimpan pengeluaran...");
    try {
      await api.post("/api/cash-flows", {
        type: "out",
        cash_account_id: accId,
        amount: amt,
        expense_category_id: expenseCategoryId ? Number(expenseCategoryId) : undefined,
        description: desc,
        flow_date: flowDate,
      });
      toast.success("Pengeluaran berhasil dicatat", { id: t });
      setPurposeName("");
      setAmount("");
      setKeterangan("");
      refreshPreview();
      loadRecent();
      const acc = await fetchAllPages("/api/cash-accounts");
      setAccounts(acc);
    } catch {
      toast.dismiss(t);
    }
  }

  function openEdit(r) {
    if (r.reference && String(r.reference).startsWith("trx:")) {
      toast.error("Pengeluaran dari penjualan tidak bisa diubah di sini");
      return;
    }
    if (r.type && r.type !== "out") {
      toast.error("Hanya pengeluaran (keluar) yang bisa diedit di halaman ini");
      return;
    }
    const { purpose, keterangan } = splitDescription(r.description);
    setEditRow(r);
    setEditPurpose(purpose);
    setEditKeterangan(keterangan);
    setEditCategoryId(r.category_id ? String(r.category_id) : "");
    setEditAmount(String(Math.round(Number(r.amount) || 0)));
    setEditFlowDate(String(r.flow_date || "").slice(0, 10));
    setEditCashAccountId(String(r.cash_account_id));
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editRow) return;
    const name = editPurpose.trim();
    if (!name) return toast.error("Nama keperluan wajib diisi");
    const amt = Number(editAmount);
    if (!amt || amt <= 0) return toast.error("Biaya tidak valid");
    const accId = Number(editCashAccountId || accounts[0]?.id);
    if (!accId) return toast.error("Belum ada rekening kas");
    const desc = editKeterangan.trim() ? `${name} — ${editKeterangan.trim()}` : name;
    const t = toast.loading("Menyimpan perubahan...");
    try {
      await api.put(`/api/cash-flows/${editRow.id}`, {
        cash_account_id: accId,
        amount: amt,
        expense_category_id: editCategoryId ? Number(editCategoryId) : null,
        description: desc,
        flow_date: editFlowDate,
      });
      toast.success("Pengeluaran berhasil diperbarui", { id: t });
      setEditRow(null);
      loadRecent();
      const acc = await fetchAllPages("/api/cash-accounts");
      setAccounts(acc);
    } catch {
      toast.dismiss(t);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const t = toast.loading("Menghapus...");
    try {
      await api.delete(`/api/cash-flows/${deleteId}`);
      toast.success("Pengeluaran berhasil dihapus", { id: t });
      setDeleteId(null);
      refreshPreview();
      loadRecent();
      const acc = await fetchAllPages("/api/cash-accounts");
      setAccounts(acc);
    } catch {
      toast.dismiss(t);
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageStack>
      <PageHeader
        title="Pengeluaran Operasional"
        subtitle="Pencatatan beban & biaya operasional ke akun kas"
      >
        <Link to="/app/expense-categories">
          <ActionButton variant="secondary">
            <FolderTree className="h-4 w-4" /> Kategori Pengeluaran
          </ActionButton>
        </Link>
      </PageHeader>

      <form onSubmit={submit} className="card max-w-2xl space-y-4 p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Form Input Pengeluaran</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kode Bukti (Pratinjau)</label>
            <input readOnly className="input-base mt-1.5 bg-slate-100/70 font-mono text-slate-500 dark:bg-slate-900" value={nextCode} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sumber Rekening Kas</label>
            <select
              className="input-base mt-1.5"
              value={cashAccountId || ""}
              onChange={(e) => setCashAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatIDR(a.balance)})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Keperluan</label>
            <input
              className="input-base mt-1.5"
              value={purposeName}
              onChange={(e) => setPurposeName(e.target.value)}
              placeholder="misal: Bayar Listrik Toko"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Jenis Kategori Pengeluaran</label>
            <select
              className="input-base mt-1.5"
              value={expenseCategoryId}
              onChange={(e) => setExpenseCategoryId(e.target.value)}
            >
              <option value="">— Pilih Kategori —</option>
              {expenseCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nominal Biaya (Rp)</label>
            <input
              type="text"
              inputMode="numeric"
              className="input-base mt-1.5 font-mono"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 14))}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tanggal Pengeluaran</label>
            <input
              type="date"
              className="input-base mt-1.5"
              value={flowDate}
              onChange={(e) => setFlowDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Keterangan Tambahan</label>
          <input
            className="input-base mt-1.5"
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            placeholder="Keterangan opsional..."
          />
        </div>

        <div className="pt-1">
          <ActionButton type="submit" variant="primary">
            Simpan Pengeluaran
          </ActionButton>
        </div>
      </form>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Riwayat Pengeluaran Terbaru</h2>
        
        <div className={PAGE_TABLE_WRAP}>
          {loading ? (
            <LoadingSpinner label="Memuat riwayat pengeluaran..." />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title="Tidak ada riwayat pengeluaran"
              message="Belum ada transaksi pengeluaran kas yang dicatat."
            />
          ) : (
            <table className={PAGE_TABLE}>
              <thead>
                <tr>
                  <th className="w-32">Tanggal</th>
                  <th>Kategori</th>
                  <th className="text-right">Nominal</th>
                  <th>Keterangan / Keperluan</th>
                  <th className="w-24 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const trxLocked = r.reference && String(r.reference).startsWith("trx:");
                  return (
                    <tr key={r.id}>
                      <td className="text-xs text-slate-600 dark:text-slate-400">{formatReportDateCell(r.flow_date)}</td>
                      <td>
                        <Badge variant="neutral">
                          {r.expense_category_name || "—"}
                        </Badge>
                      </td>
                      <td className="text-right font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                        {formatIDR(r.amount)}
                      </td>
                      <td className="text-slate-800 dark:text-slate-200">{r.description}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!trxLocked && (
                            <ActionButton variant="ghost-brand" size="icon" onClick={() => openEdit(r)} title="Edit">
                              <Edit2 className="h-4 w-4" />
                            </ActionButton>
                          )}
                          <ActionButton variant="ghost-danger" size="icon" onClick={() => setDeleteId(r.id)} title="Hapus">
                            <Trash2 className="h-4 w-4" />
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && rows.length > 0 && (
          <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Hal {page} dari {pages} ({total} pengeluaran)
            </span>
            <PaginationBar page={page} pages={pages} setPage={setPage} variant="compact" />
          </div>
        )}
      </div>

      <Modal open={!!editRow} title="Edit Pengeluaran Operasional" onClose={() => setEditRow(null)} wide>
        <form className="grid max-w-xl gap-4" onSubmit={saveEdit}>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sumber Rekening Kas</label>
            <select
              className="input-base mt-1.5"
              value={editCashAccountId}
              onChange={(e) => setEditCashAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatIDR(a.balance)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Keperluan</label>
            <input
              className="input-base mt-1.5"
              value={editPurpose}
              onChange={(e) => setEditPurpose(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Jenis Kategori Pengeluaran</label>
            <select
              className="input-base mt-1.5"
              value={editCategoryId}
              onChange={(e) => setEditCategoryId(e.target.value)}
            >
              <option value="">— Pilih Kategori —</option>
              {expenseCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nominal Biaya (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                className="input-base mt-1.5 font-mono"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value.replace(/\D/g, "").slice(0, 14))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tanggal</label>
              <input
                type="date"
                className="input-base mt-1.5"
                value={editFlowDate}
                onChange={(e) => setEditFlowDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Keterangan</label>
            <input
              className="input-base mt-1.5"
              value={editKeterangan}
              onChange={(e) => setEditKeterangan(e.target.value)}
              placeholder="Opsional"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <ActionButton variant="secondary" onClick={() => setEditRow(null)}>
              Batal
            </ActionButton>
            <ActionButton type="submit" variant="primary">
              Simpan Perubahan
            </ActionButton>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Hapus Pengeluaran?"
        message="Entri ini akan dihapus dan saldo kas terkait akan dikembalikan."
        danger
        confirmText="Hapus"
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </PageStack>
  );
}
