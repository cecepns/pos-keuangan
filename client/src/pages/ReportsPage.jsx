import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PAGE_SIZE } from "../constants/pagination";
import { formatIDR, formatReportDateCell } from "../utils/format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { PAGE_TABLE, PageStackLoose, REPORT_TABLE_SCROLL, REPORT_TABLE_SCROLL_TALL } from "../components/TableCard";

export default function ReportsPage() {
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

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
    loadSales().catch(() => toast.error("Gagal memuat penjualan"));
  }, [loadSales]);

  useEffect(() => {
    loadBest().catch(() => {});
  }, [loadBest]);

  useEffect(() => {
    loadMargin().catch(() => {});
  }, [loadMargin]);

  useEffect(() => {
    api
      .get("/api/reports/profit-loss", { params: { from, to } })
      .then(({ data }) => setPl(data))
      .catch(() => setPl(null));
  }, [from, to]);

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
    toast.success("PDF diunduh");
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
    toast.success("Excel diunduh");
  }

  const salesPages = Math.max(1, Math.ceil(salesTotal / PAGE_SIZE));
  const bestPages = Math.max(1, Math.ceil(bestTotal / PAGE_SIZE));
  const marginPages = Math.max(1, Math.ceil(marginTotal / PAGE_SIZE));

  return (
    <PageStackLoose>
      <div>
        <h1 className="text-2xl font-bold">Laporan & analisis</h1>
        <p className="text-sm text-slate-500">Filter tanggal, halaman 10 baris, ekspor mengambil semua halaman</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label className="text-xs text-slate-500">Dari</label>
          <input type="date" className="mt-1 block rounded-xl border px-3 py-2 dark:bg-slate-950" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Sampai</label>
          <input type="date" className="mt-1 block rounded-xl border px-3 py-2 dark:bg-slate-950" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button type="button" onClick={() => exportPdf()} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white">
          Export PDF
        </button>
        <button type="button" onClick={() => exportExcel()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
          Export Excel
        </button>
        <button type="button" onClick={() => window.print()} className="rounded-xl border px-4 py-2 text-sm">
          Print halaman
        </button>
      </div>

      {pl && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900 print:break-inside-avoid">
          <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-white">Laporan laba rugi</h2>
          <p className="mb-4 text-xs text-slate-500">
            Periode{" "}
            {pl.from === pl.to
              ? formatReportDateCell(pl.from)
              : `${formatReportDateCell(pl.from)} s/d ${formatReportDateCell(pl.to)}`}{" "}
            — penjualan dari tanggal transaksi POS; pengeluaran dari tanggal aliran kas.
          </p>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
              <p className="text-xs text-slate-500">Pendapatan (grand total)</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">{formatIDR(pl.summary.revenue)}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
              <p className="text-xs text-slate-500">HPP / modal penjualan</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">{formatIDR(pl.summary.hpp)}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
              <p className="text-xs text-slate-500">Pajak penjualan</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">{formatIDR(pl.summary.tax_amount)}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
              <p className="text-xs text-slate-500">Biaya operasional</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">{formatIDR(pl.summary.operational_expense)}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-brand-50/90 px-4 py-3 dark:border-brand-900/40 dark:bg-brand-950/30">
              <p className="text-xs text-slate-500 dark:text-slate-400">Laba bersih (est.)</p>
              <p className="mt-1 text-sm font-bold tabular-nums text-brand-800 dark:text-brand-200">{formatIDR(pl.summary.net_profit)}</p>
            </div>
          </div>
          <div className="grid min-w-0 gap-6 lg:grid-cols-2">
            <div className="min-w-0">
              <h3 className="mb-2 font-semibold">Ringkasan</h3>
              <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <li>Laba kotor (total_profit trx): {formatIDR(pl.summary.gross_profit)}</li>
                <li>Pendapatan net (setelah pajak): {formatIDR(pl.summary.revenue_after_tax)}</li>
                {pl.summary.pct_gross != null && (
                  <li>Laba kotor vs pendapatan net: {(pl.summary.pct_gross).toFixed(1)}%</li>
                )}
                {pl.summary.pct_net != null && (
                  <li>Laba bersih vs pendapatan net: {(pl.summary.pct_net).toFixed(1)}%</li>
                )}
              </ul>
            </div>
            <div className="min-w-0">
              <h3 className="mb-2 font-semibold">Pengeluaran per kategori</h3>
              <p className="mb-2 text-xs text-slate-500">
                Total nominal per tipe: {formatIDR(pl.summary?.expense_by_category_total ?? 0)} · Grand total biaya operasional periode:{" "}
                {formatIDR(pl.summary?.operational_expense ?? 0)}
              </p>
              <div className={REPORT_TABLE_SCROLL}>
                <table className={PAGE_TABLE}>
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left">Tipe</th>
                      <th className="py-2 text-right">Nominal</th>
                      <th className="py-2 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pl.expense_breakdown || []).map((r, i) => (
                      <tr key={i} className="border-b border-slate-50 dark:border-slate-800">
                        <td className="py-2">{r.expense_type}</td>
                        <td className="py-2 text-right tabular-nums">{formatIDR(r.amount)}</td>
                        <td className="py-2 text-right tabular-nums">{r.pct.toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 font-semibold dark:border-slate-600">
                      <td className="py-2">Jumlah per kategori</td>
                      <td className="py-2 text-right tabular-nums">{formatIDR(pl.summary?.expense_by_category_total ?? 0)}</td>
                      <td className="py-2 text-right">100%</td>
                    </tr>
                    <tr className="font-bold text-brand-800 dark:text-brand-200">
                      <td className="py-2">Grand total pengeluaran (periode)</td>
                      <td className="py-2 text-right tabular-nums" colSpan={2}>
                        {formatIDR(pl.summary?.operational_expense ?? 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid min-w-0 gap-6 lg:grid-cols-2 print:block">
        <div className="min-w-0 rounded-2xl border bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 font-semibold">Penjualan harian</h3>
          <div className={REPORT_TABLE_SCROLL}>
            <table className={PAGE_TABLE}>
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Tanggal</th>
                  <th className="py-2 text-right">Omzet</th>
                  <th className="py-2 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((r) => (
                  <tr key={r.d} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="py-2 whitespace-nowrap">{formatReportDateCell(r.d)}</td>
                    <td className="py-2 text-right">{formatIDR(r.omzet)}</td>
                    <td className="py-2 text-right">{formatIDR(r.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>
              Hal {salesPage}/{salesPages}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={salesPage <= 1} className="rounded border px-2 py-0.5" onClick={() => setSalesPage((p) => p - 1)}>
                Prev
              </button>
              <button type="button" disabled={salesPage >= salesPages} className="rounded border px-2 py-0.5" onClick={() => setSalesPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 font-semibold">Best seller</h3>
          <input
            type="search"
            className="mb-2 w-full rounded-xl border px-3 py-2 text-sm dark:bg-slate-950"
            placeholder="Cari produk..."
            value={bestQin}
            onChange={(e) => setBestQin(e.target.value)}
          />
          <div className={REPORT_TABLE_SCROLL}>
          <table className={PAGE_TABLE}>
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left">Produk</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Omzet</th>
              </tr>
            </thead>
            <tbody>
              {best.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2 text-right">{r.qty}</td>
                  <td className="py-2 text-right">{formatIDR(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>
              Hal {bestPage}/{bestPages}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={bestPage <= 1} className="rounded border px-2 py-0.5" onClick={() => setBestPage((p) => p - 1)}>
                Prev
              </button>
              <button type="button" disabled={bestPage >= bestPages} className="rounded border px-2 py-0.5" onClick={() => setBestPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="min-w-0 lg:col-span-2 rounded-2xl border bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 font-semibold">Margin per produk (90 hari)</h3>
          <input
            type="search"
            className="mb-2 max-w-md rounded-xl border px-3 py-2 text-sm dark:bg-slate-950"
            placeholder="Cari produk..."
            value={marginQin}
            onChange={(e) => setMarginQin(e.target.value)}
          />
          <div className={REPORT_TABLE_SCROLL_TALL}>
            <table className={PAGE_TABLE}>
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Produk</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Omzet</th>
                  <th className="py-2 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {margin.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="py-2">{r.name}</td>
                    <td className="py-2 text-right">{r.qty}</td>
                    <td className="py-2 text-right">{formatIDR(r.revenue)}</td>
                    <td className="py-2 text-right text-emerald-600">{formatIDR(r.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>
              Hal {marginPage}/{marginPages}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={marginPage <= 1} className="rounded border px-2 py-0.5" onClick={() => setMarginPage((p) => p - 1)}>
                Prev
              </button>
              <button type="button" disabled={marginPage >= marginPages} className="rounded border px-2 py-0.5" onClick={() => setMarginPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageStackLoose>
  );
}
