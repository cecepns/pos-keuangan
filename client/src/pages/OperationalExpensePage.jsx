import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PAGE_SIZE } from "../constants/pagination";
import { formatDateID, formatIDR } from "../utils/format";
import { PAGE_TABLE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";

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

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageStack>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pengeluaran operasional</h1>
        <p className="text-sm text-slate-500">Dicatat ke kas (keluar) dengan kategori biaya</p>
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
              type="number"
              min={1}
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">{formatDateID(r.flow_date)}</td>
                    <td className="px-4 py-3 text-sm">{r.expense_category_name || "—"}</td>
                    <td className="px-4 py-3 text-right">{formatIDR(r.amount)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{r.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-4 text-sm text-slate-500">Memuat…</p>
          )}
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span>Hal {page}/{pages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} className="rounded border px-2 py-0.5 disabled:opacity-40" onClick={() => setPage((p) => p - 1)}>
              Prev
            </button>
            <button type="button" disabled={page >= pages} className="rounded border px-2 py-0.5 disabled:opacity-40" onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Untuk pemasukan/transfer lengkap gunakan halaman{" "}
          <Link to="/app/cash-flow" className="text-brand-600 underline">
            Cash flow
          </Link>
          .
        </p>
      </div>
    </PageStack>
  );
}
