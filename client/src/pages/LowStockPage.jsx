import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import api from "../api/client";
import { PAGE_SIZE } from "../constants/pagination";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { SearchInput } from "../components/SearchInput";
import { ActionButton } from "../components/ActionButton";
import { Badge } from "../components/Badge";
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
      <PageHeader
        title="Barang Stok Menipis"
        subtitle="Daftar produk dengan jumlah stok di bawah atau sama dengan batas minimum"
      />

      <SearchInput
        placeholder="Cari produk stok menipis..."
        value={q}
        onChange={(val) => {
          setPage(1);
          setQ(val);
        }}
      />

      <div className={PAGE_TABLE_WRAP}>
        {loading ? (
          <LoadingSpinner label="Memuat data stok menipis..." />
        ) : list.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Stok Barang Aman"
            message={q ? "Tidak ada barang menipis yang sesuai dengan pencarian." : "Semua barang memiliki stok di atas batas minimum."}
          />
        ) : (
          <table className={PAGE_TABLE}>
            <thead>
              <tr>
                <th className="w-16 text-center">No</th>
                <th className="w-32">SKU</th>
                <th>Nama Barang</th>
                <th className="text-right">Min. Stok</th>
                <th className="text-right">Stok Saat Ini</th>
                <th className="w-28 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p, i) => (
                <tr key={p.id}>
                  <td className="text-center font-mono text-xs text-slate-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="font-mono text-xs font-medium text-slate-600 dark:text-slate-400">{p.sku}</td>
                  <td className="font-medium text-slate-900 dark:text-white">{p.name}</td>
                  <td className="text-right font-medium text-slate-600 dark:text-slate-400">{p.min_stock}</td>
                  <td className="text-right">
                    <Badge variant="warning" className="font-mono text-xs">
                      {p.stock}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <Link to="/app/products">
                      <ActionButton variant="primary" size="xs">
                        Kelola
                      </ActionButton>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && list.length > 0 && (
        <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Menampilkan {list.length} dari {total} barang (Hal {page} dari {pages})
          </span>
          <PaginationBar page={page} pages={pages} setPage={setPage} />
        </div>
      )}
    </PageStack>
  );
}
