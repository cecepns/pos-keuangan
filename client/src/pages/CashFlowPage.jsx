import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Pencil, Plus, UserX } from "lucide-react";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PAGE_SIZE } from "../constants/pagination";
import { formatDateID, formatIDR } from "../utils/format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PAGE_TABLE_WIDE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";

const TYPE_LABEL = { kas: "Kas", bank: "Bank", ewallet: "E-wallet" };

export default function CashFlowPage() {
  const [rows, setRows] = useState([]);
  const [flowTotal, setFlowTotal] = useState(0);
  const [flowPage, setFlowPage] = useState(1);
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
    const acc = await fetchAllPages("/api/cash-accounts");
    setAccounts(acc);
  }, []);

  const refreshManagedAccounts = useCallback(async () => {
    const rows = await fetchAllPages("/api/cash-accounts", { all: 1 });
    setManagedAccounts(rows);
  }, []);

  const loadFlows = useCallback(async () => {
    const { data } = await api.get("/api/cash-flows", {
      params: { q: dq, page: flowPage, limit: PAGE_SIZE },
    });
    setRows(data.data || []);
    setFlowTotal(Number(data.total ?? 0));
  }, [dq, flowPage]);

  useEffect(() => {
    setFlowPage(1);
  }, [dq]);

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

  async function onSubmit(v) {
    const amtDigits = String(v.amount ?? "").replace(/\D/g, "");
    const amountNum = amtDigits === "" ? 0 : Number(amtDigits);
    const t = toast.loading("Menyimpan...");
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
          toast.error("Pilih rekening kas — tambah di menu Kelola rekening kas jika belum ada");
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
      toast.success("Tercatat", { id: t });
      setOpen(false);
      await reloadActiveAccounts();
      loadFlows();
    } catch {
      toast.dismiss(t);
    }
  }

  async function saveAccountEditor() {
    if (!accountEditor?.name?.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }
    const t = toast.loading("Menyimpan...");
    try {
      if (accountEditor.id) {
        await api.put(`/api/cash-accounts/${accountEditor.id}`, {
          name: accountEditor.name.trim(),
          type: accountEditor.type,
          is_active: accountEditor.is_active,
        });
        toast.success("Diperbarui", { id: t });
      } else {
        await api.post("/api/cash-accounts", {
          name: accountEditor.name.trim(),
          type: accountEditor.type,
          balance: 0,
        });
        toast.success("Akun ditambah", { id: t });
      }
      setAccountEditor(null);
      await reloadActiveAccounts();
      await refreshManagedAccounts();
    } catch {
      toast.dismiss(t);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateId) return;
    const t = toast.loading("Memperbarui...");
    try {
      await api.delete(`/api/cash-accounts/${deactivateId}`);
      toast.success("Akun dinonaktifkan", { id: t });
      setDeactivateId(null);
      await reloadActiveAccounts();
      await refreshManagedAccounts();
    } catch {
      toast.dismiss(t);
      setDeactivateId(null);
    }
  }

  const flowPages = Math.max(1, Math.ceil(flowTotal / PAGE_SIZE));

  return (
    <PageStack>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cash flow</h1>
          <p className="text-sm text-slate-500">Pemasukan, pengeluaran, transfer kas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setAccountEditor(null);
              setAccountsManageOpen(true);
            }}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 font-semibold text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            Kelola rekening kas
          </button>
          <button
            type="button"
            onClick={() => {
              form.reset({
                mode: "in",
                cash_account_id: accounts[0]?.id ?? "",
                amount: "",
                description: "",
                flow_date: new Date().toISOString().slice(0, 10),
                from_account_id: accounts[0]?.id ?? "",
                to_account_id: accounts[1]?.id ?? accounts[0]?.id ?? "",
                income_category_id: "",
                expense_category_id: "",
              });
              setOpen(true);
            }}
            className="rounded-2xl bg-brand-600 px-5 py-2.5 font-semibold text-white"
          >
            Catat transaksi
          </button>
        </div>
      </div>

      <input
        type="search"
        className="max-w-md rounded-2xl border px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        placeholder="Cari keterangan / akun..."
        value={qInput}
        onChange={(e) => setQInput(e.target.value)}
      />

      <div className="grid min-w-0 gap-3 md:grid-cols-3">
        {accounts.length === 0 && (
          <div className="md:col-span-3 rounded-2xl border border-dashed border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            Belum ada rekening kas aktif. Buka <strong>Kelola rekening kas</strong> untuk menambah.
          </div>
        )}
        {accounts.map((a) => (
          <div key={a.id} className="min-w-0 rounded-2xl border bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-500">{a.name}</p>
            <p className="text-xl font-bold">{formatIDR(a.balance)}</p>
          </div>
        ))}
      </div>

      <div className={PAGE_TABLE_WRAP}>
        <table className={PAGE_TABLE_WIDE}>
          <thead className="bg-slate-50 dark:bg-slate-800/80">
            <tr>
              <th className="px-4 py-3 text-left">Tanggal</th>
              <th className="px-4 py-3 text-left">Akun</th>
              <th className="px-4 py-3 text-left">Jenis</th>
              <th className="px-4 py-3 text-left">Kategori</th>
              <th className="px-4 py-3 text-right">Jumlah</th>
              <th className="px-4 py-3 text-left">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">{formatDateID(r.flow_date)}</td>
                <td className="px-4 py-3">{r.account_name}</td>
                <td className="px-4 py-3 capitalize">{r.type.replace("_", " ")}</td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                  {r.income_category_name || r.expense_category_name || "—"}
                </td>
                <td className="px-4 py-3 text-right">{formatIDR(r.amount)}</td>
                <td className="px-4 py-3">{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between text-sm text-slate-500">
        <span>
          Hal {flowPage}/{flowPages} · {flowTotal} entri
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={flowPage <= 1} className="rounded-xl border px-3 py-1 disabled:opacity-40" onClick={() => setFlowPage((p) => p - 1)}>
            Prev
          </button>
          <button type="button" disabled={flowPage >= flowPages} className="rounded-xl border px-3 py-1 disabled:opacity-40" onClick={() => setFlowPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>

      <Modal open={accountsManageOpen} title="Kelola rekening kas" onClose={() => setAccountsManageOpen(false)} wide>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Tambah, ubah nama/tipe, atau nonaktifkan akun. Akun yang sudah punya mutasi tidak dihapus dari database — hanya dinonaktifkan sehingga tidak muncul di pilihan transaksi baru.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAccountEditor({ id: null, name: "", type: "kas", is_active: true })}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Tambah akun
          </button>
        </div>

        {accountEditor && (
          <div className="mb-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/80">
            <p className="text-sm font-semibold">{accountEditor.id ? "Edit akun" : "Akun baru"}</p>
            <div>
              <label className="text-xs text-slate-500">Nama</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
                value={accountEditor.name}
                onChange={(e) => setAccountEditor((s) => ({ ...s, name: e.target.value }))}
                placeholder="Mis. Kas utama, BCA operasional"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Tipe</label>
              <select
                className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
                value={accountEditor.type}
                onChange={(e) => setAccountEditor((s) => ({ ...s, type: e.target.value }))}
              >
                <option value="kas">Kas</option>
                <option value="bank">Bank</option>
                <option value="ewallet">E-wallet</option>
              </select>
            </div>
            {accountEditor.id != null && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!accountEditor.is_active}
                  onChange={(e) => setAccountEditor((s) => ({ ...s, is_active: e.target.checked }))}
                />
                Akun aktif (muncul di pilihan POS & cash flow)
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white" onClick={saveAccountEditor}>
                Simpan
              </button>
              <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => setAccountEditor(null)}>
                Batal
              </button>
            </div>
          </div>
        )}

        <div className="max-h-[min(420px,55vh)] overflow-auto rounded-xl border dark:border-slate-700">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2 text-left">Nama</th>
                <th className="px-3 py-2 text-left">Tipe</th>
                <th className="px-3 py-2 text-right">Saldo</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {managedAccounts.map((a) => (
                <tr key={a.id} className={Number(a.is_active) === 0 ? "opacity-60" : ""}>
                  <td className="px-3 py-2 font-medium">{a.name}</td>
                  <td className="px-3 py-2">{TYPE_LABEL[a.type] || a.type}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatIDR(a.balance)}</td>
                  <td className="px-3 py-2">{Number(a.is_active) === 0 ? "Nonaktif" : "Aktif"}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30"
                        title="Edit"
                        onClick={() =>
                          setAccountEditor({
                            id: a.id,
                            name: a.name,
                            type: a.type || "kas",
                            is_active: Number(a.is_active) !== 0,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {Number(a.is_active) !== 0 ? (
                        <button
                          type="button"
                          className="rounded-lg p-2 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                          title="Nonaktifkan"
                          onClick={() => setDeactivateId(a.id)}
                        >
                          <UserX className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal open={open} title="Catat cash flow" onClose={() => setOpen(false)} wide>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500">Mode</label>
            <select className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("mode")}>
              <option value="in">Pemasukan</option>
              <option value="out">Pengeluaran</option>
              <option value="transfer">Transfer antar kas</option>
            </select>
          </div>
          {form.watch("mode") === "transfer" ? (
            <>
              <div>
                <label className="text-xs text-slate-500">Dari</label>
                <select className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("from_account_id")}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Ke</label>
                <select className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("to_account_id")}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="md:col-span-2">
                <label className="text-xs text-slate-500">Rekening kas</label>
                <select className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("cash_account_id")}>
                  {accounts.length === 0 ? (
                    <option value="">— Tambah akun di Kelola rekening kas —</option>
                  ) : (
                    accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              {form.watch("mode") === "in" && (
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500">Kategori pemasukan (opsional)</label>
                  <select className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("income_category_id")}>
                    <option value="">—</option>
                    {incomeCats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {form.watch("mode") === "out" && (
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500">Kategori pengeluaran (opsional)</label>
                  <select className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("expense_category_id")}>
                    <option value="">—</option>
                    {expenseCats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
          <div>
            <label className="text-xs text-slate-500">Jumlah</label>
            <input
              type="text"
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950"
              value={form.watch("amount") ?? ""}
              onChange={(e) =>
                form.setValue("amount", e.target.value.replace(/\D/g, "").slice(0, 14), { shouldDirty: true })
              }
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Tanggal</label>
            <input type="date" className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("flow_date")} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500">Keterangan</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("description")} />
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
        open={!!deactivateId}
        title="Nonaktifkan rekening kas?"
        message="Akun tidak akan muncul di pilihan transaksi baru. Riwayat mutasi tetap tersimpan."
        danger
        confirmText="Nonaktifkan"
        onConfirm={confirmDeactivate}
        onClose={() => setDeactivateId(null)}
      />
    </PageStack>
  );
}
