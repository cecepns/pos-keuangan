import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { PAGE_SIZE } from "../constants/pagination";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { TableSkeleton } from "../components/Skeleton";
import { PAGE_TABLE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";
import { PaginationBar } from "../components/PaginationBar";

export default function LowStockPage() {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 350);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/products", {
        params: { q: dq, page, limit: PAGE_SIZE, low_stock: 1, active: 1 },
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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Barang stok menipis</h1>
        <p className="text-sm text-slate-500">Produk dengan stok ≤ batas minimum</p>
      </div>

      <input
        className="max-w-md rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        placeholder="Cari..."
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
          <table className={PAGE_TABLE}>
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">#</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">SKU</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Barang</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Minimal</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Stok</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Opsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.map((p, i) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-slate-500">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-4 py-3 font-mono text-sm">{p.sku}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.min_stock}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-amber-700 dark:text-amber-400">{p.stock}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/app/products"
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Kelola
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && list.length === 0 && (
        <p className="text-sm text-slate-500">Tidak ada barang di bawah batas stok.</p>
      )}

      <div className="flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Hal {page} / {pages} · {total} entri
        </span>
        <PaginationBar page={page} pages={pages} setPage={setPage} />
      </div>
    </PageStack>
  );
}
