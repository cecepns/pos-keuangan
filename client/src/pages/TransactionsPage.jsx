import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api/client";
import { PAGE_SIZE } from "../constants/pagination";
import { formatDateTimeID, formatIDR } from "../utils/format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TableSkeleton } from "../components/Skeleton";
import { PAGE_TABLE_WIDE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";

export default function TransactionsPage() {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 350);
  const [loading, setLoading] = useState(true);
  const [refundId, setRefundId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/api/transactions", { params: { q: dq, page, limit: PAGE_SIZE } });
      setList(data.data || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [dq, page]);

  async function doRefund() {
    const t = toast.loading("Refund...");
    try {
      await api.post(`/api/transactions/${refundId}/refund`);
      toast.success("Refund berhasil — stok dikembalikan", { id: t });
      setRefundId(null);
      load();
    } catch {
      toast.dismiss(t);
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageStack>
      <div>
        <h1 className="text-2xl font-bold">Transaksi</h1>
        <p className="text-sm text-slate-500">Riwayat & refund</p>
      </div>

      <input
        className="max-w-md rounded-2xl border px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        placeholder="Cari invoice..."
        value={q}
        onChange={(e) => {
          setPage(1);
          setQ(e.target.value);
        }}
      />

      <div className={PAGE_TABLE_WRAP}>
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={6} cols={5} />
          </div>
        ) : (
          <table className={PAGE_TABLE_WIDE}>
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-4 py-3 text-left">Invoice</th>
                <th className="px-4 py-3 text-left">Waktu</th>
                <th className="px-4 py-3 text-left">Pelanggan</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {list.map((x) => (
                <tr key={x.id}>
                  <td className="px-4 py-3 font-mono text-xs">{x.invoice_no}</td>
                  <td className="px-4 py-3">{formatDateTimeID(x.created_at)}</td>
                  <td className="px-4 py-3">{x.customer_name || "—"}</td>
                  <td className="px-4 py-3 text-right">{formatIDR(x.grand_total)}</td>
                  <td className="px-4 py-3 capitalize">{x.status}</td>
                  <td className="px-4 py-3 text-right">
                    {x.status === "completed" && (
                      <button type="button" className="text-xs font-semibold text-red-600 hover:underline" onClick={() => setRefundId(x.id)}>
                        Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-between text-sm">
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

      <ConfirmDialog
        open={!!refundId}
        title="Refund transaksi?"
        message="Stok produk akan dikembalikan. Yakin?"
        danger
        confirmText="Refund"
        onConfirm={doRefund}
        onClose={() => setRefundId(null)}
      />
    </PageStack>
  );
}
