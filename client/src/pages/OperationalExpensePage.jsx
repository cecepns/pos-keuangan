import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Pencil, Trash2 } from "lucide-react";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PAGE_SIZE } from "../constants/pagination";
import { formatDateID, formatIDR } from "../utils/format";
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
    if (!name) return toast.error("Nama keperluan wajib");
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Biaya tidak valid");
    const accId = Number(cashAccountId || accounts[0]?.id);
    if (!accId) return toast.error("Belum ada rekening kas");
    const desc = keterangan.trim() ? `${name} — ${keterangan.trim()}` : name;
    const t = toast.loading("Menyimpan...");
    try {
      await api.post("/api/cash-flows", {
        type: "out",
        cash_account_id: accId,
        amount: amt,
        expense_category_id: expenseCategoryId ? Number(expenseCategoryId) : undefined,
        description: desc,
        flow_date: flowDate,
      });
      toast.success("Pengeluaran tercatat", { id: t });
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
    if (!name) return toast.error("Nama keperluan wajib");
    const amt = Number(editAmount);
    if (!amt || amt <= 0) return toast.error("Biaya tidak valid");
    const accId = Number(editCashAccountId || accounts[0]?.id);
    if (!accId) return toast.error("Belum ada rekening kas");
    const desc = editKeterangan.trim() ? `${name} — ${editKeterangan.trim()}` : name;
    const t = toast.loading("Menyimpan...");
    try {
      await api.put(`/api/cash-flows/${editRow.id}`, {
        cash_account_id: accId,
        amount: amt,
        expense_category_id: editCategoryId ? Number(editCategoryId) : null,
        description: desc,
        flow_date: editFlowDate,
      });
      toast.success("Diperbarui", { id: t });
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
      toast.success("Pengeluaran dihapus", { id: t });
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pengeluaran operasional</h1>
          <p className="text-sm text-slate-500">Dicatat ke kas (keluar) dengan kategori biaya</p>
        </div>
        <Link
          to="/app/expense-categories"
          className="inline-flex w-fit rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 dark:border-slate-600 dark:text-white"
        >
          Kelola kategori pengeluaran
        </Link>
      </div>

      <form
        onSubmit={submit}
        className="max-w-2xl space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <label className="text-xs text-slate-500">Kode (pratinjau)</label>
          <input readOnly className="mt-1 w-full rounded-xl border bg-slate-50 px-3 py-2 font-mono dark:bg-slate-950" value={nextCode} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Akun kas</label>
          <select
            className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
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
        <div>
          <label className="text-xs text-slate-500">Nama keperluan</label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={purposeName}
            onChange={(e) => setPurposeName(e.target.value)}
            placeholder="Mis. Bayar listrik toko"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Jenis pengeluaran</label>
          <select
            className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={expenseCategoryId}
            onChange={(e) => setExpenseCategoryId(e.target.value)}
          >
            <option value="">— Pilih —</option>
            {expenseCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-slate-500">Biaya</label>
            <input
              type="text"
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 14))}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Tanggal</label>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={flowDate}
              onChange={(e) => setFlowDate(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500">Keterangan</label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            placeholder="Opsional"
          />
        </div>
        <button type="submit" className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white">
          Simpan
        </button>
      </form>

      <div>
        <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Riwayat pengeluaran terbaru (global kas)</h2>
        <div className={PAGE_TABLE_WRAP}>
          {!loading ? (
            <table className={PAGE_TABLE}>
              <thead className="bg-slate-50 dark:bg-slate-800/80">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Tanggal</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Kategori</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Jumlah</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Keterangan</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => {
                  const locked = r.reference && String(r.reference).startsWith("trx:");
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3">{formatDateID(r.flow_date)}</td>
                      <td className="px-4 py-3 text-sm">{r.expense_category_name || "—"}</td>
                      <td className="px-4 py-3 text-right">{formatIDR(r.amount)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{r.description}</td>
                      <td className="px-4 py-3 text-right">
                        {locked ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              className="rounded-lg p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30"
                              title="Edit"
                              onClick={() => openEdit(r)}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              title="Hapus"
                              onClick={() => setDeleteId(r.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="p-4 text-sm text-slate-500">Memuat…</p>
          )}
        </div>
        <div className="mt-2 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Hal {page} / {pages}
          </span>
          <PaginationBar page={page} pages={pages} setPage={setPage} variant="compact" />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Untuk pemasukan/transfer lengkap gunakan halaman{" "}
          <Link to="/app/cash-flow" className="text-brand-600 underline">
            Cash flow
          </Link>
          .
        </p>
      </div>

      <Modal open={!!editRow} title="Edit pengeluaran" onClose={() => setEditRow(null)} wide>
        <form className="grid max-w-xl gap-3" onSubmit={saveEdit}>
          <div>
            <label className="text-xs text-slate-500">Akun kas</label>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
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
            <label className="text-xs text-slate-500">Nama keperluan</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={editPurpose}
              onChange={(e) => setEditPurpose(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Jenis pengeluaran</label>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={editCategoryId}
              onChange={(e) => setEditCategoryId(e.target.value)}
            >
              <option value="">— Pilih —</option>
              {expenseCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500">Biaya</label>
              <input
                type="text"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value.replace(/\D/g, "").slice(0, 14))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Tanggal</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={editFlowDate}
                onChange={(e) => setEditFlowDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500">Keterangan</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={editKeterangan}
              onChange={(e) => setEditKeterangan(e.target.value)}
              placeholder="Opsional"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-xl border px-4 py-2" onClick={() => setEditRow(null)}>
              Batal
            </button>
            <button type="submit" className="rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white">
              Simpan perubahan
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Hapus pengeluaran?"
        message="Entri akan dihapus dan saldo kas dikembalikan sesuai jumlah ini."
        danger
        confirmText="Hapus"
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </PageStack>
  );
}
