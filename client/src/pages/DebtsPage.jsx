import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PAGE_SIZE } from "../constants/pagination";
import { formatDateID, formatIDR } from "../utils/format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Modal } from "../components/Modal";
import { PAGE_TABLE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";

export default function DebtsPage() {
  const [tab, setTab] = useState("piutang");
  const [recv, setRecv] = useState([]);
  const [recvTotal, setRecvTotal] = useState(0);
  const [recvPage, setRecvPage] = useState(1);
  const [recvQin, setRecvQin] = useState("");
  const recvDq = useDebouncedValue(recvQin, 350);

  const [pay, setPay] = useState([]);
  const [payTotal, setPayTotal] = useState(0);
  const [payPage, setPayPage] = useState(1);
  const [payQin, setPayQin] = useState("");
  const payDq = useDebouncedValue(payQin, 350);

  const [accounts, setAccounts] = useState([]);
  const [payRecv, setPayRecv] = useState(null);
  const [payPay, setPayPay] = useState(null);
  const formNewPayable = useForm({ defaultValues: { supplier_id: "", amount: 0, due_date: "", notes: "" } });
  const formPay = useForm({ defaultValues: { amount: 0, cash_account_id: "" } });

  const loadRecv = useCallback(async () => {
    const { data } = await api.get("/api/receivables", { params: { q: recvDq, page: recvPage, limit: PAGE_SIZE } });
    setRecv(data.data || []);
    setRecvTotal(Number(data.total ?? 0));
  }, [recvDq, recvPage]);

  const loadPay = useCallback(async () => {
    const { data } = await api.get("/api/payables", { params: { q: payDq, page: payPage, limit: PAGE_SIZE } });
    setPay(data.data || []);
    setPayTotal(Number(data.total ?? 0));
  }, [payDq, payPage]);

  useEffect(() => {
    setRecvPage(1);
  }, [recvDq]);

  useEffect(() => {
    setPayPage(1);
  }, [payDq]);

  useEffect(() => {
    (async () => {
      const acc = await fetchAllPages("/api/cash-accounts");
      setAccounts(acc);
    })();
  }, []);

  useEffect(() => {
    if (tab === "piutang") loadRecv().catch(() => {});
  }, [tab, loadRecv]);

  useEffect(() => {
    if (tab === "hutang") loadPay().catch(() => {});
  }, [tab, loadPay]);

  async function submitPayRecv(v) {
    const t = toast.loading("Memproses...");
    try {
      await api.post(`/api/receivables/${payRecv}/pay`, v);
      toast.success("Pelunasan tercatat", { id: t });
      setPayRecv(null);
      loadRecv();
    } catch {
      toast.dismiss(t);
    }
  }

  async function submitPayPay(v) {
    const t = toast.loading("Memproses...");
    try {
      await api.post(`/api/payables/${payPay}/pay`, v);
      toast.success("Pembayaran tercatat", { id: t });
      setPayPay(null);
      loadPay();
    } catch {
      toast.dismiss(t);
    }
  }

  async function createPayable(v) {
    const t = toast.loading("Menyimpan...");
    try {
      await api.post("/api/payables", v);
      toast.success("Hutang dicatat", { id: t });
      loadPay();
    } catch {
      toast.dismiss(t);
    }
  }

  const recvPages = Math.max(1, Math.ceil(recvTotal / PAGE_SIZE));
  const payPages = Math.max(1, Math.ceil(payTotal / PAGE_SIZE));

  return (
    <PageStack>
      <div>
        <h1 className="text-2xl font-bold">Hutang & Piutang</h1>
        <p className="text-sm text-slate-500">Monitor jatuh tempo & cicilan</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === "piutang" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}
          onClick={() => setTab("piutang")}
        >
          Piutang
        </button>
        <button
          type="button"
          className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === "hutang" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}
          onClick={() => setTab("hutang")}
        >
          Hutang supplier
        </button>
      </div>

      {tab === "piutang" && (
        <>
          <input
            type="search"
            className="max-w-md rounded-2xl border px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
            placeholder="Cari pelanggan..."
            value={recvQin}
            onChange={(e) => setRecvQin(e.target.value)}
          />
          <div className={PAGE_TABLE_WRAP}>
            <table className={PAGE_TABLE}>
              <thead className="bg-slate-50 dark:bg-slate-800/80">
                <tr>
                  <th className="px-4 py-3 text-left">Pelanggan</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Sisa</th>
                  <th className="px-4 py-3 text-left">Jatuh tempo</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {recv.map((x) => (
                  <tr key={x.id}>
                    <td className="px-4 py-3">{x.customer_name}</td>
                    <td className="px-4 py-3 text-right">{formatIDR(x.amount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-600">{formatIDR(x.balance)}</td>
                    <td className="px-4 py-3">{x.due_date ? formatDateID(x.due_date) : "—"}</td>
                    <td className="px-4 py-3 capitalize">{x.status}</td>
                    <td className="px-4 py-3 text-right">
                      {Number(x.balance) > 0 && (
                        <button type="button" className="text-xs font-semibold text-brand-600" onClick={() => setPayRecv(x.id)}>
                          Bayar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between text-sm text-slate-500">
            <span>
              Hal {recvPage}/{recvPages}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={recvPage <= 1} className="rounded-xl border px-3 py-1" onClick={() => setRecvPage((p) => p - 1)}>
                Prev
              </button>
              <button type="button" disabled={recvPage >= recvPages} className="rounded-xl border px-3 py-1" onClick={() => setRecvPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {tab === "hutang" && (
        <>
          <input
            type="search"
            className="max-w-md rounded-2xl border px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
            placeholder="Cari supplier..."
            value={payQin}
            onChange={(e) => setPayQin(e.target.value)}
          />
          <form
            className="flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-slate-200 p-4 dark:border-slate-700"
            onSubmit={formNewPayable.handleSubmit(createPayable)}
          >
            <div>
              <label className="text-xs text-slate-500">Supplier ID</label>
              <input type="number" className="mt-1 rounded-xl border px-3 py-2 dark:bg-slate-950" {...formNewPayable.register("supplier_id")} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Jumlah</label>
              <input type="number" className="mt-1 rounded-xl border px-3 py-2 dark:bg-slate-950" {...formNewPayable.register("amount")} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Jatuh tempo</label>
              <input type="date" className="mt-1 rounded-xl border px-3 py-2 dark:bg-slate-950" {...formNewPayable.register("due_date")} />
            </div>
            <button type="submit" className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-white">
              Catat hutang
            </button>
          </form>

          <div className={PAGE_TABLE_WRAP}>
            <table className={PAGE_TABLE}>
              <thead className="bg-slate-50 dark:bg-slate-800/80">
                <tr>
                  <th className="px-4 py-3 text-left">Supplier</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Sisa</th>
                  <th className="px-4 py-3 text-left">Jatuh tempo</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {pay.map((x) => (
                  <tr key={x.id}>
                    <td className="px-4 py-3">{x.supplier_name}</td>
                    <td className="px-4 py-3 text-right">{formatIDR(x.amount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">{formatIDR(x.balance)}</td>
                    <td className="px-4 py-3">{x.due_date ? formatDateID(x.due_date) : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {Number(x.balance) > 0 && (
                        <button type="button" className="text-xs font-semibold text-brand-600" onClick={() => setPayPay(x.id)}>
                          Bayar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between text-sm text-slate-500">
            <span>
              Hal {payPage}/{payPages}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={payPage <= 1} className="rounded-xl border px-3 py-1" onClick={() => setPayPage((p) => p - 1)}>
                Prev
              </button>
              <button type="button" disabled={payPage >= payPages} className="rounded-xl border px-3 py-1" onClick={() => setPayPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        </>
      )}

      <Modal open={!!payRecv} title="Pelunasan piutang" onClose={() => setPayRecv(null)}>
        <form className="space-y-3" onSubmit={formPay.handleSubmit(submitPayRecv)}>
          <div>
            <label className="text-xs text-slate-500">Jumlah</label>
            <input type="number" className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...formPay.register("amount")} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Masuk ke kas</label>
            <select className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...formPay.register("cash_account_id")}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="w-full rounded-xl bg-brand-600 py-2 font-semibold text-white">
            Simpan
          </button>
        </form>
      </Modal>

      <Modal open={!!payPay} title="Bayar hutang" onClose={() => setPayPay(null)}>
        <form className="space-y-3" onSubmit={formPay.handleSubmit(submitPayPay)}>
          <div>
            <label className="text-xs text-slate-500">Jumlah</label>
            <input type="number" className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...formPay.register("amount")} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Dari kas</label>
            <select className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...formPay.register("cash_account_id")}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="w-full rounded-xl bg-brand-600 py-2 font-semibold text-white">
            Simpan
          </button>
        </form>
      </Modal>
    </PageStack>
  );
}
