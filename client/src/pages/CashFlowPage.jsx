import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Pencil, Plus, Trash2, Wallet, ArrowRightLeft, Settings } from "lucide-react";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PAGE_SIZE } from "../constants/pagination";
import { formatDateID, formatIDR, formatReportDateCell, formatThousandsIdInput } from "../utils/format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { SearchInput } from "../components/SearchInput";
import { ActionButton } from "../components/ActionButton";
import { Badge } from "../components/Badge";
import { PAGE_TABLE_WIDE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";
import { PaginationBar } from "../components/PaginationBar";

const TYPE_LABEL = { kas: "Kas", bank: "Bank", ewallet: "E-Wallet" };

function flowRowEditable(r) {
  if (!r || (r.type !== "in" && r.type !== "out")) return false;
  if (r.reference && String(r.reference).startsWith("trx:")) return false;
  return true;
}

function parseDateRange(dari, sampai) {
  const d = String(dari ?? "").trim();
  const s = String(sampai ?? "").trim();
  if (!d && !s) return null;
  let from = d || s;
  let to = s || d;
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

export default function CashFlowPage() {
  const [rows, setRows] = useState([]);
  const [flowTotal, setFlowTotal] = useState(0);
  const [flowPage, setFlowPage] = useState(1);
  const [tanggalDari, setTanggalDari] = useState("");
  const [tanggalSampai, setTanggalSampai] = useState("");
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [qInput, setQInput] = useState("");
  const dq = useDebouncedValue(qInput, 350);
  const [accounts, setAccounts] = useState([]);
  const [incomeCats, setIncomeCats] = useState([]);
  const [expenseCats, setExpenseCats] = useState([]);
  const [open, setOpen] = useState(false);
  const [accountsManageOpen, setAccountsManageOpen] = useState(false);
  const [managedAccounts, setManagedAccounts] = useState([]);
  const [accountEditor, setAccountEditor] = useState(null);
  const [deactivateId, setDeactivateId] = useState(null);
  const [editFlow, setEditFlow] = useState(null);
  const [deleteFlowId, setDeleteFlowId] = useState(null);
  const [editFlowAccounts, setEditFlowAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const periodeFilter = useMemo(() => parseDateRange(tanggalDari, tanggalSampai), [tanggalDari, tanggalSampai]);

  const visibleAccounts = useMemo(() => {
    if (periodeFilter) {
      return accounts;
    }
    const q = dq.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => String(a.name || "").toLowerCase().includes(q));
  }, [accounts, dq, periodeFilter]);

  const totalSaldoTampil = useMemo(() => {
    if (!visibleAccounts.length) return null;
    if (periodeFilter && accountsLoading) return null;
    return visibleAccounts.reduce((sum, a) => {
      if (periodeFilter && Number.isFinite(Number(a.mutasi_net_period))) {
        return sum + Number(a.mutasi_net_period);
      }
      const saldo = Number(a.balance);
      return sum + (Number.isFinite(saldo) ? saldo : 0);
    }, 0);
  }, [visibleAccounts, periodeFilter, accountsLoading]);

  const form = useForm({
    defaultValues: {
      mode: "in",
      cash_account_id: "",
      amount: "",
      description: "",
      flow_date: new Date().toISOString().slice(0, 10),
      from_account_id: "",
      to_account_id: "",
      income_category_id: "",
      expense_category_id: "",
    },
  });

  const reloadActiveAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const extra =
        periodeFilter != null
          ? {
              mutasi_from: periodeFilter.from,
              mutasi_to: periodeFilter.to,
              ...(dq.trim() ? { mutasi_q: dq.trim() } : {}),
            }
          : {};
      const acc = await fetchAllPages("/api/cash-accounts", extra);
      setAccounts(acc);
    } catch {
      /* biarkan daftar rekening sebelumnya */
    } finally {
      setAccountsLoading(false);
    }
  }, [periodeFilter, dq]);

  const refreshManagedAccounts = useCallback(async () => {
    const rows = await fetchAllPages("/api/cash-accounts", { all: 1 });
    setManagedAccounts(rows);
  }, []);

  const loadFlows = useCallback(async () => {
    setLoading(true);
    try {
      const params = { q: dq, page: flowPage, limit: PAGE_SIZE };
      if (periodeFilter) {
        params.from = periodeFilter.from;
        params.to = periodeFilter.to;
      }
      const { data } = await api.get("/api/cash-flows", { params });
      setRows(data.data || []);
      setFlowTotal(Number(data.total ?? 0));
    } finally {
      setLoading(false);
    }
  }, [dq, flowPage, periodeFilter]);

  useEffect(() => {
    setFlowPage(1);
  }, [dq, tanggalDari, tanggalSampai]);

  useEffect(() => {
    loadFlows().catch(() => {});
  }, [loadFlows]);

  useEffect(() => {
    reloadActiveAccounts().catch(() => {});
  }, [reloadActiveAccounts]);

  useEffect(() => {
    if (!accountsManageOpen) return;
    refreshManagedAccounts().catch(() => {});
  }, [accountsManageOpen, refreshManagedAccounts]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [inc, exp] = await Promise.all([api.get("/api/income-categories"), api.get("/api/expense-categories")]);
        setIncomeCats(inc.data?.data || []);
        setExpenseCats(exp.data?.data || []);
      } catch {
        setIncomeCats([]);
        setExpenseCats([]);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!editFlow) return;
    fetchAllPages("/api/cash-accounts")
      .then(setEditFlowAccounts)
      .catch(() => setEditFlowAccounts([]));
    (async () => {
      try {
        const [inc, exp] = await Promise.all([api.get("/api/income-categories"), api.get("/api/expense-categories")]);
        setIncomeCats(inc.data?.data || []);
        setExpenseCats(exp.data?.data || []);
      } catch {
        setIncomeCats([]);
        setExpenseCats([]);
      }
    })();
  }, [editFlow]);

  async function onSubmit(v) {
    const amtDigits = String(v.amount ?? "").replace(/\D/g, "");
    const amountNum = amtDigits === "" ? 0 : Number(amtDigits);
    const t = toast.loading("Menyimpan mutasi...");
    try {
      if (v.mode === "transfer") {
        const fid = Number(v.from_account_id);
        const tid = Number(v.to_account_id);
        if (!Number.isFinite(fid) || !accounts.some((a) => Number(a.id) === fid)) {
          toast.dismiss(t);
          toast.error("Pilih rekening asal");
          return;
        }
        if (!Number.isFinite(tid) || !accounts.some((a) => Number(a.id) === tid)) {
          toast.dismiss(t);
          toast.error("Pilih rekening tujuan");
          return;
        }
        if (fid === tid) {
          toast.dismiss(t);
          toast.error("Rekening asal dan tujuan harus berbeda");
          return;
        }
        await api.post("/api/cash-flows", {
          type: "transfer_out",
          from_account_id: fid,
          to_account_id: tid,
          amount: amountNum,
          description: v.description,
          flow_date: v.flow_date,
        });
      } else {
        const cid = Number(v.cash_account_id);
        if (!Number.isFinite(cid) || !accounts.some((a) => Number(a.id) === cid)) {
          toast.dismiss(t);
          toast.error("Pilih rekening kas");
          return;
        }
        const body = {
          type: v.mode,
          cash_account_id: cid,
          amount: amountNum,
          description: v.description,
          flow_date: v.flow_date,
        };
        if (v.mode === "in" && v.income_category_id) body.income_category_id = Number(v.income_category_id);
        if (v.mode === "out" && v.expense_category_id) body.expense_category_id = Number(v.expense_category_id);
        await api.post("/api/cash-flows", body);
      }
      toast.success("Mutasi kas berhasil dicatat", { id: t });
      setOpen(false);
      await reloadActiveAccounts();
      loadFlows();
    } catch {
      toast.dismiss(t);
    }
  }

  function openEditFlow(r) {
    if (!flowRowEditable(r)) {
      toast.error(
        r.reference && String(r.reference).startsWith("trx:")
          ? "Mutasi dari penjualan POS tidak dapat diubah di sini"
          : "Hanya pemasukan/pengeluaran manual yang dapat diubah",
      );
      return;
    }
    setEditFlow({
      id: r.id,
      type: r.type,
      cash_account_id: String(r.cash_account_id ?? ""),
      account_name: r.account_name || "",
      amountStr: String(Math.round(Number(r.amount) || 0)),
      description: r.description || "",
      flow_date: String(r.flow_date || "").slice(0, 10),
      income_category_id: r.income_category_id ? String(r.income_category_id) : "",
      expense_category_id: r.expense_category_id ? String(r.expense_category_id) : "",
    });
  }

  async function saveEditFlow(e) {
    e.preventDefault();
    if (!editFlow) return;
    const cid = Number(editFlow.cash_account_id);
    if (!Number.isFinite(cid)) return toast.error("Pilih rekening kas");
    const amt = Number(String(editFlow.amountStr).replace(/\D/g, "")) || 0;
    if (amt <= 0) return toast.error("Masukkan nominal yang valid");

    const body = {
      cash_account_id: cid,
      amount: amt,
      description: editFlow.description,
      flow_date: editFlow.flow_date,
    };
    if (editFlow.type === "in") {
      body.income_category_id = editFlow.income_category_id ? Number(editFlow.income_category_id) : null;
    }
    if (editFlow.type === "out") {
      body.expense_category_id = editFlow.expense_category_id ? Number(editFlow.expense_category_id) : null;
    }

    const t = toast.loading("Menyimpan...");
    try {
      await api.put(`/api/cash-flows/${editFlow.id}`, body);
      toast.success("Mutasi berhasil diperbarui", { id: t });
      setEditFlow(null);
      await reloadActiveAccounts();
      loadFlows();
    } catch {
      toast.dismiss(t);
    }
  }

  async function confirmDeleteFlow() {
    if (!deleteFlowId) return;
    const t = toast.loading("Menghapus mutasi...");
    try {
      await api.delete(`/api/cash-flows/${deleteFlowId}`);
      toast.success("Mutasi berhasil dihapus", { id: t });
      setDeleteFlowId(null);
      await reloadActiveAccounts();
      loadFlows();
    } catch {
      toast.dismiss(t);
    }
  }

  function openCreateAccount() {
    setAccountEditor({ id: null, name: "", type: "kas", account_number: "", initial_balance: "0", is_active: true });
  }

  function openEditAccount(a) {
    setAccountEditor({
      id: a.id,
      name: a.name,
      type: a.type || "kas",
      account_number: a.account_number || "",
      initial_balance: String(Math.round(Number(a.initial_balance) || 0)),
      is_active: a.is_active !== false && Number(a.is_active) !== 0,
    });
  }

  async function saveAccount(e) {
    e.preventDefault();
    if (!accountEditor) return;
    const name = accountEditor.name.trim();
    if (!name) return toast.error("Nama rekening wajib diisi");
    const initBal = Number(String(accountEditor.initial_balance).replace(/\D/g, "")) || 0;
    const t = toast.loading("Menyimpan rekening...");
    try {
      if (accountEditor.id) {
        await api.put(`/api/cash-accounts/${accountEditor.id}`, {
          name,
          type: accountEditor.type,
          account_number: accountEditor.account_number || null,
          initial_balance: initBal,
          is_active: accountEditor.is_active,
        });
      } else {
        await api.post("/api/cash-accounts", {
          name,
          type: accountEditor.type,
          account_number: accountEditor.account_number || null,
          initial_balance: initBal,
        });
      }
      toast.success("Rekening kas disimpan", { id: t });
      setAccountEditor(null);
      await refreshManagedAccounts();
      await reloadActiveAccounts();
      loadFlows();
    } catch {
      toast.dismiss(t);
    }
  }

  async function confirmDeactivateAccount() {
    if (!deactivateId) return;
    const t = toast.loading("Menonaktifkan...");
    try {
      await api.delete(`/api/cash-accounts/${deactivateId}`);
      toast.success("Rekening kas dinonaktifkan", { id: t });
      setDeactivateId(null);
      await refreshManagedAccounts();
      await reloadActiveAccounts();
    } catch {
      toast.dismiss(t);
    }
  }

  const pages = Math.max(1, Math.ceil(flowTotal / PAGE_SIZE));

  return (
    <PageStack>
      <PageHeader
        title="Cash Flow & Rekening Kas"
        subtitle="Kelola saldo kas/bank, catat arus pemasukan, pengeluaran & transfer antar rekening"
      >
        <ActionButton onClick={() => setAccountsManageOpen(true)} variant="secondary">
          <Settings className="h-4 w-4" /> Kelola Rekening Kas
        </ActionButton>
        <ActionButton
          onClick={() => {
            form.reset({
              mode: "in",
              cash_account_id: accounts[0] ? String(accounts[0].id) : "",
              amount: "",
              description: "",
              flow_date: new Date().toISOString().slice(0, 10),
              from_account_id: accounts[0] ? String(accounts[0].id) : "",
              to_account_id: accounts[1] ? String(accounts[1].id) : accounts[0] ? String(accounts[0].id) : "",
              income_category_id: "",
              expense_category_id: "",
            });
            setOpen(true);
          }}
          variant="primary"
        >
          <Plus className="h-4 w-4" /> Catat Mutasi
        </ActionButton>
      </PageHeader>

      {/* Saldo cards */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {periodeFilter
              ? `Mutasi Net Rekening (${formatDateID(periodeFilter.from)} — ${formatDateID(periodeFilter.to)})`
              : "Saldo Saat Ini"}
          </h2>
          {totalSaldoTampil != null && (
            <div className="text-xs text-slate-500">
              {periodeFilter ? "Total Net Periode: " : "Total Saldo Kas: "}
              <strong className="font-mono text-sm text-brand-600 dark:text-brand-400">
                {formatIDR(totalSaldoTampil)}
              </strong>
            </div>
          )}
        </div>

        {accountsLoading ? (
          <LoadingSpinner label="Memuat saldo rekening..." />
        ) : visibleAccounts.length === 0 ? (
          <EmptyState title="Belum Ada Rekening Kas" message="Tambahkan rekening kas/bank pertama Anda.">
            <ActionButton onClick={openCreateAccount} variant="secondary" size="sm" className="mt-2">
              <Plus className="h-4 w-4" /> Tambah Rekening
            </ActionButton>
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {visibleAccounts.map((a) => (
              <div key={a.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      {TYPE_LABEL[a.type] || a.type}
                    </span>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{a.name}</h3>
                    {a.account_number && (
                      <p className="font-mono text-[11px] text-slate-500">{a.account_number}</p>
                    )}
                  </div>
                  <div className="rounded-lg bg-brand-50 p-2 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
                    <Wallet className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400">{periodeFilter ? "Mutasi Net" : "Saldo"}</span>
                  <p className="font-mono text-base font-bold text-slate-900 dark:text-white">
                    {formatIDR(periodeFilter ? a.mutasi_net_period : a.balance)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter & Riwayat */}
      <div className="card space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            placeholder="Cari deskripsi, nominal, rekening…"
            value={qInput}
            onChange={(val) => setQInput(val)}
          />

          <div className="flex flex-wrap items-center gap-2">
            <div>
              <input
                type="date"
                className="input-base py-1.5 text-xs"
                value={tanggalDari}
                onChange={(e) => setTanggalDari(e.target.value)}
              />
            </div>
            <span className="text-xs text-slate-400">s/d</span>
            <div>
              <input
                type="date"
                className="input-base py-1.5 text-xs"
                value={tanggalSampai}
                onChange={(e) => setTanggalSampai(e.target.value)}
              />
            </div>
            {(tanggalDari || tanggalSampai) && (
              <ActionButton
                variant="ghost"
                size="xs"
                onClick={() => {
                  setTanggalDari("");
                  setTanggalSampai("");
                }}
              >
                Reset
              </ActionButton>
            )}
          </div>
        </div>

        <div className={PAGE_TABLE_WRAP}>
          {loading ? (
            <LoadingSpinner label="Memuat riwayat mutasi..." />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={ArrowRightLeft}
              title="Tidak Ada Mutasi"
              message={qInput || periodeFilter ? "Tidak ada mutasi yang cocok dengan filter." : "Belum ada riwayat mutasi kas."}
            />
          ) : (
            <table className={PAGE_TABLE_WIDE}>
              <thead>
                <tr>
                  <th className="w-32">Tanggal</th>
                  <th>Rekening</th>
                  <th>Tipe</th>
                  <th className="text-right">Nominal</th>
                  <th>Keterangan</th>
                  <th className="w-24 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const editable = flowRowEditable(r);
                  const isPosTrx = r.reference && String(r.reference).startsWith("trx:");
                  return (
                    <tr key={r.id}>
                      <td className="text-xs text-slate-600 dark:text-slate-400">{formatReportDateCell(r.flow_date)}</td>
                      <td className="font-medium text-slate-900 dark:text-white">{r.account_name}</td>
                      <td>
                        {r.type === "in" ? (
                          <Badge variant="success">Pemasukan</Badge>
                        ) : r.type === "out" ? (
                          <Badge variant="danger">Pengeluaran</Badge>
                        ) : r.type === "transfer_out" ? (
                          <Badge variant="warning">Transfer Keluar</Badge>
                        ) : (
                          <Badge variant="info">Transfer Masuk</Badge>
                        )}
                      </td>
                      <td className={`text-right font-mono text-xs font-semibold ${
                        r.type === "in" || r.type === "transfer_in" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}>
                        {r.type === "in" || r.type === "transfer_in" ? "+" : "-"}{formatIDR(r.amount)}
                      </td>
                      <td className="text-slate-700 dark:text-slate-300">
                        {r.description}
                        {r.category_name && (
                          <span className="ml-2 text-xs text-slate-400">({r.category_name})</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {editable && (
                            <ActionButton variant="ghost-brand" size="icon" onClick={() => openEditFlow(r)} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </ActionButton>
                          )}
                          {!isPosTrx && (
                            <ActionButton variant="ghost-danger" size="icon" onClick={() => setDeleteFlowId(r.id)} title="Hapus">
                              <Trash2 className="h-4 w-4" />
                            </ActionButton>
                          )}
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
          <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between pt-1">
            <span>
              Hal {flowPage} dari {pages} ({flowTotal} mutasi)
            </span>
            <PaginationBar page={flowPage} pages={pages} setPage={setFlowPage} />
          </div>
        )}
      </div>

      {/* Modal Mutasi */}
      <Modal open={open} title="Catat Mutasi Kas" onClose={() => setOpen(false)}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Jenis Mutasi</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              <button
                type="button"
                className={`rounded-xl py-2 text-xs font-semibold border transition-all ${
                  form.watch("mode") === "in"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
                onClick={() => form.setValue("mode", "in")}
              >
                Pemasukan
              </button>
              <button
                type="button"
                className={`rounded-xl py-2 text-xs font-semibold border transition-all ${
                  form.watch("mode") === "out"
                    ? "border-rose-600 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
                onClick={() => form.setValue("mode", "out")}
              >
                Pengeluaran
              </button>
              <button
                type="button"
                className={`rounded-xl py-2 text-xs font-semibold border transition-all ${
                  form.watch("mode") === "transfer"
                    ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
                onClick={() => form.setValue("mode", "transfer")}
              >
                Transfer
              </button>
            </div>
          </div>

          {form.watch("mode") === "transfer" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Dari Rekening</label>
                <select className="input-base mt-1.5" {...form.register("from_account_id")}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatIDR(a.balance)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Ke Rekening</label>
                <select className="input-base mt-1.5" {...form.register("to_account_id")}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatIDR(a.balance)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Rekening Kas</label>
              <select className="input-base mt-1.5" {...form.register("cash_account_id")}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatIDR(a.balance)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.watch("mode") === "in" && (
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kategori Pemasukan</label>
              <select className="input-base mt-1.5" {...form.register("income_category_id")}>
                <option value="">— Opsional —</option>
                {incomeCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.watch("mode") === "out" && (
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kategori Pengeluaran</label>
              <select className="input-base mt-1.5" {...form.register("expense_category_id")}>
                <option value="">— Opsional —</option>
                {expenseCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nominal (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                className="input-base mt-1.5 font-mono"
                placeholder="0"
                value={formatThousandsIdInput(form.watch("amount"))}
                onChange={(e) => form.setValue("amount", e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tanggal</label>
              <input type="date" className="input-base mt-1.5" {...form.register("flow_date")} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Keterangan</label>
            <input className="input-base mt-1.5" placeholder="Keterangan transaksi..." {...form.register("description")} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ActionButton type="button" variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </ActionButton>
            <ActionButton type="submit" variant="primary">
              Simpan Mutasi
            </ActionButton>
          </div>
        </form>
      </Modal>

      {/* Modal Edit Flow */}
      <Modal open={!!editFlow} title="Edit Mutasi Kas" onClose={() => setEditFlow(null)}>
        {editFlow && (
          <form className="space-y-4" onSubmit={saveEditFlow}>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Rekening Kas</label>
              <select
                className="input-base mt-1.5"
                value={editFlow.cash_account_id}
                onChange={(e) => setEditFlow((f) => ({ ...f, cash_account_id: e.target.value }))}
              >
                {editFlowAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {editFlow.type === "in" && (
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kategori Pemasukan</label>
                <select
                  className="input-base mt-1.5"
                  value={editFlow.income_category_id}
                  onChange={(e) => setEditFlow((f) => ({ ...f, income_category_id: e.target.value }))}
                >
                  <option value="">— Opsional —</option>
                  {incomeCats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {editFlow.type === "out" && (
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kategori Pengeluaran</label>
                <select
                  className="input-base mt-1.5"
                  value={editFlow.expense_category_id}
                  onChange={(e) => setEditFlow((f) => ({ ...f, expense_category_id: e.target.value }))}
                >
                  <option value="">— Opsional —</option>
                  {expenseCats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nominal (Rp)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="input-base mt-1.5 font-mono"
                  value={formatThousandsIdInput(editFlow.amountStr)}
                  onChange={(e) => setEditFlow((f) => ({ ...f, amountStr: e.target.value.replace(/\D/g, "") }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tanggal</label>
                <input
                  type="date"
                  className="input-base mt-1.5"
                  value={editFlow.flow_date}
                  onChange={(e) => setEditFlow((f) => ({ ...f, flow_date: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Keterangan</label>
              <input
                className="input-base mt-1.5"
                value={editFlow.description}
                onChange={(e) => setEditFlow((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <ActionButton type="button" variant="secondary" onClick={() => setEditFlow(null)}>
                Batal
              </ActionButton>
              <ActionButton type="submit" variant="primary">
                Simpan Perubahan
              </ActionButton>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Kelola Rekening Kas */}
      <Modal open={accountsManageOpen} title="Kelola Rekening Kas / Bank" onClose={() => setAccountsManageOpen(false)} wide>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Daftar rekening kas aktif dan nonaktif</p>
            <ActionButton variant="primary" size="sm" onClick={openCreateAccount}>
              <Plus className="h-4 w-4" /> Rekening Baru
            </ActionButton>
          </div>

          <div className={PAGE_TABLE_WRAP}>
            <table className={PAGE_TABLE}>
              <thead>
                <tr>
                  <th>Nama Rekening</th>
                  <th>Tipe</th>
                  <th>No. Rekening</th>
                  <th className="text-right">Saldo Awal</th>
                  <th className="text-right">Saldo Saat Ini</th>
                  <th>Status</th>
                  <th className="w-24 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {managedAccounts.map((a) => (
                  <tr key={a.id}>
                    <td className="font-medium text-slate-900 dark:text-white">{a.name}</td>
                    <td className="capitalize">{TYPE_LABEL[a.type] || a.type}</td>
                    <td className="font-mono text-xs text-slate-600 dark:text-slate-400">{a.account_number || "—"}</td>
                    <td className="text-right font-mono text-xs">{formatIDR(a.initial_balance)}</td>
                    <td className="text-right font-mono text-xs font-semibold">{formatIDR(a.balance)}</td>
                    <td>
                      {a.is_active ? <Badge variant="success">Aktif</Badge> : <Badge variant="neutral">Nonaktif</Badge>}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ActionButton variant="ghost-brand" size="icon" onClick={() => openEditAccount(a)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </ActionButton>
                        {a.is_active && (
                          <ActionButton variant="ghost-danger" size="icon" onClick={() => setDeactivateId(a.id)} title="Nonaktifkan">
                            <Trash2 className="h-4 w-4" />
                          </ActionButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Modal Editor Account */}
      <Modal open={!!accountEditor} title={accountEditor?.id ? "Edit Rekening Kas" : "Tambah Rekening Kas Baru"} onClose={() => setAccountEditor(null)}>
        {accountEditor && (
          <form className="space-y-4" onSubmit={saveAccount}>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Rekening</label>
              <input
                className="input-base mt-1.5"
                value={accountEditor.name}
                onChange={(e) => setAccountEditor((a) => ({ ...a, name: e.target.value }))}
                placeholder="misal: Kas Utama, BCA 123..."
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipe Rekening</label>
              <select
                className="input-base mt-1.5"
                value={accountEditor.type}
                onChange={(e) => setAccountEditor((a) => ({ ...a, type: e.target.value }))}
              >
                <option value="kas">Kas (Tunai)</option>
                <option value="bank">Bank (Transfer)</option>
                <option value="ewallet">E-Wallet (QRIS / GoPay / OVO)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">No. Rekening / Akun (Opsional)</label>
              <input
                className="input-base mt-1.5 font-mono"
                value={accountEditor.account_number}
                onChange={(e) => setAccountEditor((a) => ({ ...a, account_number: e.target.value }))}
                placeholder="misal: 1234567890"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Saldo Awal (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                className="input-base mt-1.5 font-mono"
                value={formatThousandsIdInput(accountEditor.initial_balance)}
                onChange={(e) => setAccountEditor((a) => ({ ...a, initial_balance: e.target.value.replace(/\D/g, "") }))}
              />
            </div>
            {accountEditor.id && (
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  className="accent-brand-600"
                  checked={accountEditor.is_active}
                  onChange={(e) => setAccountEditor((a) => ({ ...a, is_active: e.target.checked }))}
                />
                Rekening Aktif
              </label>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <ActionButton type="button" variant="secondary" onClick={() => setAccountEditor(null)}>
                Batal
              </ActionButton>
              <ActionButton type="submit" variant="primary">
                Simpan Rekening
              </ActionButton>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteFlowId}
        title="Hapus Mutasi Kas?"
        message="Mutasi ini akan dihapus dan saldo kas terkait akan disesuaikan."
        danger
        confirmText="Hapus"
        onClose={() => setDeleteFlowId(null)}
        onConfirm={confirmDeleteFlow}
      />

      <ConfirmDialog
        open={!!deactivateId}
        title="Nonaktifkan Rekening?"
        message="Rekening ini tidak akan muncul di opsi pencatatan mutasi kas."
        danger
        confirmText="Nonaktifkan"
        onClose={() => setDeactivateId(null)}
        onConfirm={confirmDeactivateAccount}
      />
    </PageStack>
  );
}
