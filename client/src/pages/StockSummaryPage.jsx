import { useCallback, useEffect, useState } from "react";
import api from "../api/client";
import { PAGE_SIZE } from "../constants/pagination";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { SearchInput } from "../components/SearchInput";
import { ClipboardList } from "lucide-react";
import { PAGE_TABLE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";
import { PaginationBar } from "../components/PaginationBar";

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
      <PageHeader
        title="Data Stok Barang"
        subtitle="Ringkasan mutasi stok masuk, keluar, penyesuaian & sisa stok saat ini"
      />

      <SearchInput
        placeholder="Cari SKU / nama / barcode..."
        value={q}
        onChange={(val) => {
          setPage(1);
          setQ(val);
        }}
      />

      <div className={PAGE_TABLE_WRAP}>
        {loading ? (
          <LoadingSpinner label="Memuat data stok..." />
        ) : list.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Tidak Ada Data Stok"
            message={q ? "Tidak ada barang yang cocok dengan kata kunci pencarian." : "Belum ada produk aktif terdaftar."}
          />
        ) : (
          <table className={PAGE_TABLE}>
            <thead>
              <tr>
                <th className="w-28">SKU</th>
                <th>Nama Barang</th>
                <th>Kategori</th>
                <th className="text-right">Stok Masuk</th>
                <th className="text-right">Stok Keluar</th>
                <th className="text-right">Penyesuaian</th>
                <th className="text-right">Sisa Stok</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs font-medium text-slate-600 dark:text-slate-400">{r.sku}</td>
                  <td className="font-medium text-slate-900 dark:text-white">{r.name}</td>
                  <td className="text-slate-600 dark:text-slate-400">{r.categories || "—"}</td>
                  <td className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">+{fmtInt(r.qty_in)}</td>
                  <td className="text-right font-mono text-xs text-rose-600 dark:text-rose-400">-{fmtInt(r.qty_out)}</td>
                  <td className="text-right font-mono text-xs text-amber-600 dark:text-amber-400">{fmtInt(r.qty_adjust)}</td>
                  <td className="text-right font-mono text-sm font-semibold text-slate-900 dark:text-white">{fmtInt(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && list.length > 0 && (
        <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Menampilkan {list.length} dari {total} produk (Hal {page} dari {pages})
          </span>
          <PaginationBar page={page} pages={pages} setPage={setPage} />
        </div>
      )}
    </PageStack>
  );
}
