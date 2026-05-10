import { useCallback, useEffect, useState } from "react";
import api from "../api/client";
import { PAGE_SIZE } from "../constants/pagination";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { TableSkeleton } from "../components/Skeleton";
import { PAGE_TABLE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";

function fmtInt(n) {
  return Number(n || 0).toLocaleString("id-ID");
}

export default function StockSummaryPage() {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 350);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/reports/stock-summary", {
        params: { q: dq, page, limit: PAGE_SIZE },
      });
      setList(data.data || []);
      setTotal(Number(data.total ?? 0));
    } finally {
      setLoading(false);
    }
  }, [dq, page]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageStack>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Data stok barang</h1>
        <p className="text-sm text-slate-500">Ringkasan stok masuk, keluar & sisa (dari mutasi + stok saat ini)</p>
      </div>

      <input
        className="max-w-md rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        placeholder="Cari SKU / nama / barcode..."
        value={q}
        onChange={(e) => {
          setPage(1);
          setQ(e.target.value);
        }}
      />

      <div className={PAGE_TABLE_WRAP}>
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={8} cols={6} />
          </div>
        ) : (
          <table className={PAGE_TABLE}>
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">SKU</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Nama</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Kategori</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Stok masuk</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Stok keluar</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Penyesuaian</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Sisa stok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-mono text-sm">{r.sku}</td>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{r.categories || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtInt(r.qty_in)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtInt(r.qty_out)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-700 dark:text-amber-400">{fmtInt(r.qty_adjust)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmtInt(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-between text-sm text-slate-500">
        <span>
          Hal {page}/{pages} · {total} produk aktif
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} className="rounded-xl border px-3 py-1 disabled:opacity-40" onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          <button type="button" disabled={page >= pages} className="rounded-xl border px-3 py-1 disabled:opacity-40" onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>
    </PageStack>
  );
}
