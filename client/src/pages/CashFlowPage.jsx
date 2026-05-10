import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PAGE_SIZE } from "../constants/pagination";
import { formatDateID, formatIDR } from "../utils/format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Modal } from "../components/Modal";
import { PAGE_TABLE_WIDE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";

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
    (async () => {
      const acc = await fetchAllPages("/api/cash-accounts");
      setAccounts(acc);
    })();
  }, []);

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
        await api.post("/api/cash-flows", {
          type: "transfer_out",
          from_account_id: Number(v.from_account_id),
          to_account_id: Number(v.to_account_id),
          amount: amountNum,
          description: v.description,
          flow_date: v.flow_date,
        });
      } else {
        const body = {
          type: v.mode,
          cash_account_id: Number(v.cash_account_id),
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
      const acc = await fetchAllPages("/api/cash-accounts");
      setAccounts(acc);
      loadFlows();
    } catch {
      toast.dismiss(t);
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

      <input
        type="search"
        className="max-w-md rounded-2xl border px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        placeholder="Cari keterangan / akun..."
        value={qInput}
        onChange={(e) => setQInput(e.target.value)}
      />

      <div className="grid min-w-0 gap-3 md:grid-cols-3">
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
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
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
    </PageStack>
  );
}
