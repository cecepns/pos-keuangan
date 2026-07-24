import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { FileText, Download, Printer, BarChart3 } from "lucide-react";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PAGE_SIZE } from "../constants/pagination";
import { formatIDR, formatReportDateCell, toLocalDateStringYMD } from "../utils/format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { PageHeader } from "../components/PageHeader";
import { SearchInput } from "../components/SearchInput";
import { ActionButton } from "../components/ActionButton";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { PAGE_TABLE, PageStackLoose, REPORT_TABLE_SCROLL, REPORT_TABLE_SCROLL_TALL } from "../components/TableCard";
import { PaginationBar } from "../components/PaginationBar";

export default function ReportsPage() {
  const [from, setFrom] = useState(() => {
    const n = new Date();
    return toLocalDateStringYMD(new Date(n.getFullYear(), n.getMonth(), 1));
  });
  const [to, setTo] = useState(() => toLocalDateStringYMD());

  const [sales, setSales] = useState([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesPage, setSalesPage] = useState(1);

  const [bestQin, setBestQin] = useState("");
  const bestDq = useDebouncedValue(bestQin, 350);
  const [best, setBest] = useState([]);
  const [bestTotal, setBestTotal] = useState(0);
  const [bestPage, setBestPage] = useState(1);

  const [marginQin, setMarginQin] = useState("");
  const marginDq = useDebouncedValue(marginQin, 350);
  const [margin, setMargin] = useState([]);
  const [marginTotal, setMarginTotal] = useState(0);
  const [marginPage, setMarginPage] = useState(1);

  const [pl, setPl] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSales = useCallback(async () => {
    const { data } = await api.get("/api/reports/sales", { params: { from, to, page: salesPage, limit: PAGE_SIZE } });
    setSales(data.data || []);
    setSalesTotal(Number(data.total ?? 0));
  }, [from, to, salesPage]);

  const loadBest = useCallback(async () => {
    const { data } = await api.get("/api/reports/best-sellers", {
      params: { from, to, q: bestDq, page: bestPage, limit: PAGE_SIZE },
    });
    setBest(data.data || []);
    setBestTotal(Number(data.total ?? 0));
  }, [from, to, bestDq, bestPage]);

  const loadMargin = useCallback(async () => {
    const { data } = await api.get("/api/reports/margin-by-product", {
      params: { q: marginDq, page: marginPage, limit: PAGE_SIZE },
    });
    setMargin(data.data || []);
    setMarginTotal(Number(data.total ?? 0));
  }, [marginDq, marginPage]);

  useEffect(() => {
    setSalesPage(1);
  }, [from, to]);

  useEffect(() => {
    setBestPage(1);
  }, [from, to, bestDq]);

  useEffect(() => {
    setMarginPage(1);
  }, [marginDq]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadSales(),
      loadBest(),
      loadMargin(),
      api.get("/api/reports/profit-loss", { params: { from, to } }).then(({ data }) => setPl(data)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadSales, loadBest, loadMargin, from, to]);

  async function exportPdf() {
    const allSales = await fetchAllPages("/api/reports/sales", { from, to });
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Laporan Penjualan", 14, 18);
    doc.setFontSize(10);
    doc.text(`Periode: ${from} s/d ${to}`, 14, 26);
    autoTable(doc, {
      startY: 32,
      head: [["Tanggal", "Omzet", "Profit", "Trx"]],
      body: allSales.map((r) => [r.d, formatIDR(r.omzet), formatIDR(r.profit), String(r.trx)]),
    });
    doc.save(`laporan-penjualan-${from}-${to}.pdf`);
    toast.success("PDF berhasil diunduh");
  }

  async function exportExcel() {
    const allSales = await fetchAllPages("/api/reports/sales", { from, to });
    const allBest = await fetchAllPages("/api/reports/best-sellers", { from, to });
    const ws = XLSX.utils.json_to_sheet(
      allSales.map((r) => ({
        Tanggal: r.d,
        Omzet: r.omzet,
        Profit: r.profit,
        Transaksi: r.trx,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Penjualan");
    const ws2 = XLSX.utils.json_to_sheet(allBest);
    XLSX.utils.book_append_sheet(wb, ws2, "BestSeller");
    XLSX.writeFile(wb, `laporan-${from}-${to}.xlsx`);
    toast.success("Excel berhasil diunduh");
  }

  const salesPages = Math.max(1, Math.ceil(salesTotal / PAGE_SIZE));
  const bestPages = Math.max(1, Math.ceil(bestTotal / PAGE_SIZE));
  const marginPages = Math.max(1, Math.ceil(marginTotal / PAGE_SIZE));

  return (
    <PageStackLoose>
      <PageHeader
        title="Laporan & Analisis Penjualan"
        subtitle="Analisis laba rugi, tren penjualan harian, best seller, dan margin per produk"
      >
        <ActionButton onClick={exportPdf} variant="secondary">
          <FileText className="h-4 w-4" /> Export PDF
        </ActionButton>
        <ActionButton onClick={exportExcel} variant="secondary">
          <Download className="h-4 w-4" /> Export Excel
        </ActionButton>
        <ActionButton onClick={() => window.print()} variant="primary">
          <Printer className="h-4 w-4" /> Print Halaman
        </ActionButton>
      </PageHeader>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="text-xs font-medium text-slate-500">Dari Tanggal</label>
          <input type="date" className="input-base mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Sampai Tanggal</label>
          <input type="date" className="input-base mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Memuat laporan..." />
      ) : (
        <>
          {pl && (
            <div className="card p-5 print:break-inside-avoid">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Laporan Laba Rugi</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Periode{" "}
                {pl.from === pl.to
                  ? formatReportDateCell(pl.from)
                  : `${formatReportDateCell(pl.from)} s/d ${formatReportDateCell(pl.to)}`}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500">Pendapatan (Total)</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-white">{formatIDR(pl.summary.revenue)}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500">HPP / Modal Penjualan</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-white">{formatIDR(pl.summary.hpp)}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500">Pajak Penjualan</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-white">{formatIDR(pl.summary.tax_amount)}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500">Biaya Operasional</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-rose-600 dark:text-rose-400">{formatIDR(pl.summary.operational_expense)}</p>
                </div>
                <div className="rounded-xl border border-brand-200 bg-brand-50/80 p-3.5 dark:border-brand-900/50 dark:bg-brand-950/30">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Est. Laba Bersih</p>
                  <p className="mt-1 font-mono text-sm font-bold text-brand-700 dark:text-brand-300">{formatIDR(pl.summary.net_profit)}</p>
                </div>
              </div>

              <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-2">
                <div className="min-w-0">
                  <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Ringkasan Margin</h3>
                  <div className="space-y-2 rounded-xl border border-slate-100 p-3.5 text-xs text-slate-700 dark:border-slate-800 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span>Laba Kotor (Gross Profit):</span>
                      <strong className="font-mono">{formatIDR(pl.summary.gross_profit)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Pendapatan Net (Setelah Pajak):</span>
                      <strong className="font-mono">{formatIDR(pl.summary.revenue_after_tax)}</strong>
                    </div>
                    {pl.summary.pct_gross != null && (
                      <div className="flex justify-between">
                        <span>Margin Laba Kotor:</span>
                        <strong className="font-mono">{pl.summary.pct_gross.toFixed(1)}%</strong>
                      </div>
                    )}
                    {pl.summary.pct_net != null && (
                      <div className="flex justify-between">
                        <span>Margin Laba Bersih:</span>
                        <strong className="font-mono text-emerald-600 dark:text-emerald-400">{pl.summary.pct_net.toFixed(1)}%</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div className="min-w-0">
                  <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Pengeluaran Per Kategori</h3>
                  <div className={REPORT_TABLE_SCROLL}>
                    <table className={PAGE_TABLE}>
                      <thead>
                        <tr>
                          <th>Tipe Kategori</th>
                          <th className="text-right">Nominal</th>
                          <th className="text-right">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pl.expense_breakdown || []).map((r, i) => (
                          <tr key={i}>
                            <td className="capitalize">{r.expense_type}</td>
                            <td className="text-right font-mono text-xs">{formatIDR(r.amount)}</td>
                            <td className="text-right font-mono text-xs">{r.pct.toFixed(0)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid min-w-0 gap-6 lg:grid-cols-2 print:block">
            {/* Penjualan Harian */}
            <div className="card min-w-0 p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Penjualan Harian</h3>
              <div className={REPORT_TABLE_SCROLL}>
                {sales.length === 0 ? (
                  <EmptyState title="Tidak ada data penjualan" />
                ) : (
                  <table className={PAGE_TABLE}>
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th className="text-right">Omzet</th>
                        <th className="text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((r) => (
                        <tr key={r.d}>
                          <td className="whitespace-nowrap text-xs">{formatReportDateCell(r.d)}</td>
                          <td className="text-right font-mono text-xs font-medium">{formatIDR(r.omzet)}</td>
                          <td className="text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">{formatIDR(r.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {sales.length > 0 && (
                <div className="mt-3 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>Hal {salesPage} dari {salesPages}</span>
                  <PaginationBar page={salesPage} pages={salesPages} setPage={setSalesPage} variant="compact" />
                </div>
              )}
            </div>

            {/* Best Seller */}
            <div className="card min-w-0 p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Best Seller</h3>
              <SearchInput
                placeholder="Cari produk best seller..."
                value={bestQin}
                onChange={(val) => setBestQin(val)}
                className="mb-3 max-w-full"
              />
              <div className={REPORT_TABLE_SCROLL}>
                {best.length === 0 ? (
                  <EmptyState title="Tidak ada data" />
                ) : (
                  <table className={PAGE_TABLE}>
                    <thead>
                      <tr>
                        <th>Nama Produk</th>
                        <th className="text-right">Qty Terjual</th>
                        <th className="text-right">Omzet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {best.map((r) => (
                        <tr key={r.id}>
                          <td className="font-medium text-slate-900 dark:text-white">{r.name}</td>
                          <td className="text-right font-mono text-xs">{r.qty}</td>
                          <td className="text-right font-mono text-xs font-semibold">{formatIDR(r.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {best.length > 0 && (
                <div className="mt-3 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>Hal {bestPage} dari {bestPages}</span>
                  <PaginationBar page={bestPage} pages={bestPages} setPage={setBestPage} variant="compact" />
                </div>
              )}
            </div>

            {/* Margin Per Produk */}
            <div className="card min-w-0 lg:col-span-2 p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Margin Per Produk (90 Hari)</h3>
              <SearchInput
                placeholder="Cari produk..."
                value={marginQin}
                onChange={(val) => setMarginQin(val)}
                className="mb-3 max-w-md"
              />
              <div className={REPORT_TABLE_SCROLL_TALL}>
                {margin.length === 0 ? (
                  <EmptyState title="Tidak ada data margin" />
                ) : (
                  <table className={PAGE_TABLE}>
                    <thead>
                      <tr>
                        <th>Nama Produk</th>
                        <th className="text-right">Qty Terjual</th>
                        <th className="text-right">Omzet Total</th>
                        <th className="text-right">Margin Keuntungan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {margin.map((r) => (
                        <tr key={r.id}>
                          <td className="font-medium text-slate-900 dark:text-white">{r.name}</td>
                          <td className="text-right font-mono text-xs">{r.qty}</td>
                          <td className="text-right font-mono text-xs">{formatIDR(r.revenue)}</td>
                          <td className="text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">{formatIDR(r.margin)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {margin.length > 0 && (
                <div className="mt-3 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>Hal {marginPage} dari {marginPages}</span>
                  <PaginationBar page={marginPage} pages={marginPages} setPage={setMarginPage} variant="compact" />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </PageStackLoose>
  );
}
