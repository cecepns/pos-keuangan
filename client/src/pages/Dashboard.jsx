import { useEffect, useState, useRef } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TrendingUp, Wallet, ShoppingBag, AlertTriangle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api/client";
import { formatDateID, formatIDR } from "../utils/format";
import { Skeleton } from "../components/Skeleton";
import { useAuthStore } from "../store/authStore";
import moment from "moment";
import "moment/locale/id";

moment.locale("id");

function formatDashboardChartDate(value) {
  if (value == null || value === "") return "";
  const m = moment(value);
  return m.isValid() ? m.format("D MMM YYYY") : String(value);
}

function StatCard({ title, value, icon: Icon, accent }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className={`rounded-xl p-3 ${accent}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
}

const COLORS = ["#0d9488", "#14b8a6", "#5eead4", "#f97316", "#eab308", "#64748b"];

export default function Dashboard() {
  const role = useAuthStore((s) => s.user?.role_name);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [applied, setApplied] = useState(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    if (!hasLoadedRef.current) setLoading(true);
    else setRefreshing(true);
    (async () => {
      try {
        const params = {};
        if (applied?.from && applied?.to) {
          params.from = applied.from;
          params.to = applied.to;
        }
        const { data: d } = await api.get("/api/dashboard/summary", { params });
        if (alive) {
          setData(d);
          hasLoadedRef.current = true;
        }
      } finally {
        if (alive) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [applied?.from, applied?.to]);

  function applyFilter() {
    if (!draftFrom || !draftTo) {
      toast.error("Isi tanggal mulai dan selesai");
      return;
    }
    if (draftFrom > draftTo) {
      toast.error("Tanggal mulai tidak boleh setelah tanggal selesai");
      return;
    }
    setApplied({ from: draftFrom, to: draftTo });
  }

  function resetFilter() {
    setDraftFrom("");
    setDraftTo("");
    setApplied(null);
  }

  function presetThisMonth() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const first = `${y}-${m}-01`;
    const d = String(now.getDate()).padStart(2, "0");
    const today = `${y}-${m}-${d}`;
    setDraftFrom(first);
    setDraftTo(today);
    setApplied({ from: first, to: today });
  }

  function presetLast7Days() {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const fmt = (dt) =>
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const f = fmt(start);
    const t = fmt(end);
    setDraftFrom(f);
    setDraftTo(t);
    setApplied({ from: f, to: t });
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const filtered = !!(data.filter?.from && data.filter?.to);

  const omzetDelta =
    data.compareMonth.omzetPrev > 0
      ? ((data.compareMonth.omzetNow - data.compareMonth.omzetPrev) / data.compareMonth.omzetPrev) * 100
      : 0;
  const marginDelta =
    data.compareMonth.marginPrev > 0
      ? ((data.compareMonth.marginNow - data.compareMonth.marginPrev) / data.compareMonth.marginPrev) * 100
      : 0;

  const salesData = (data.charts?.sales || []).map((r) => ({
    date: r.d,
    omzet: Number(r.total),
  }));
  const profitData = (data.charts?.profit || []).map((r) => ({
    date: r.d,
    profit: Number(r.total),
  }));

  const pieData = (data.bestSeller || []).slice(0, 6).map((b) => ({
    name: b.name?.slice(0, 18) || "Produk",
    value: Number(b.qty),
  }));

  const showFinance = role !== "kasir";

  return (
    <div className="relative space-y-6">
      {refreshing ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-end p-2">
          <span className="rounded-full bg-slate-900/80 px-3 py-1 text-xs font-medium text-white">Memuat…</span>
        </div>
      ) : null}

      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Ringkasan operasional & performa penjualan
            {filtered ? (
              <>
                {" "}
                · Filter:{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {formatDateID(data.filter.from)} — {formatDateID(data.filter.to)}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:flex-wrap sm:items-end">
          <div>
            <label className="text-xs font-medium text-slate-500">Dari</label>
            <input
              type="date"
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Sampai</label>
            <input
              type="date"
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={applyFilter}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            Terapkan
          </button>
          <button
            type="button"
            onClick={resetFilter}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
          >
            Reset
          </button>
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2 sm:border-0 sm:pt-0 dark:border-slate-800">
            <button type="button" onClick={presetThisMonth} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Bulan ini
            </button>
            <button type="button" onClick={presetLast7Days} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              7 hari terakhir
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={filtered ? "Omzet (periode)" : "Omzet hari ini"}
          value={formatIDR(data.today.omzet)}
          icon={TrendingUp}
          accent="bg-emerald-500"
        />
        <StatCard
          title={filtered ? "Profit (periode)" : "Profit hari ini"}
          value={formatIDR(data.today.profit)}
          icon={Wallet}
          accent="bg-teal-600"
        />
        <StatCard
          title={filtered ? "Transaksi (periode)" : "Transaksi"}
          value={String(data.today.transactions)}
          icon={ShoppingBag}
          accent="bg-cyan-600"
        />
        <StatCard
          title={filtered ? "Produk terjual — periode" : "Produk terjual (qty)"}
          value={String(Math.round(data.today.itemsSold))}
          icon={ShoppingBag}
          accent="bg-brand-700"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {filtered ? "Omzet vs periode sebelumnya" : "Omzet vs bulan lalu"}
            </h3>
            <span
              className={`flex items-center gap-1 text-sm font-medium ${omzetDelta >= 0 ? "text-emerald-600" : "text-red-500"}`}
            >
              {omzetDelta >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {omzetDelta.toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {filtered ? "Periode dipilih" : "Bulan ini"} {formatIDR(data.compareMonth.omzetNow)} ·{" "}
            {filtered ? "Sebelumnya" : "Bulan lalu"} {formatIDR(data.compareMonth.omzetPrev)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {filtered ? "Margin vs periode sebelumnya" : "Margin vs bulan lalu"}
            </h3>
            <span
              className={`flex items-center gap-1 text-sm font-medium ${marginDelta >= 0 ? "text-emerald-600" : "text-red-500"}`}
            >
              {marginDelta >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {marginDelta.toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {filtered ? "Margin periode ini" : "Margin bulan ini"} {formatIDR(data.compareMonth.marginNow)} ·{" "}
            {filtered ? "Sebelumnya" : "Bulan lalu"} {formatIDR(data.compareMonth.marginPrev)}
          </p>
        </div>
      </div>

      {showFinance && data.cashFlow && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500">{filtered ? "Kas masuk (periode)" : "Kas masuk (hari ini)"}</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">{formatIDR(data.cashFlow.in)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500">{filtered ? "Kas keluar (periode)" : "Kas keluar (hari ini)"}</p>
            <p className="mt-1 text-xl font-bold text-red-500">{formatIDR(data.cashFlow.out)}</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">
            {filtered ? "Tren penjualan (per tanggal dalam rentang)" : "Tren penjualan (14 hari)"}
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="gOmzet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={formatDashboardChartDate} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatIDR(v)} labelFormatter={formatDashboardChartDate} />
                <Area type="monotone" dataKey="omzet" stroke="#0d9488" fillOpacity={1} fill="url(#gOmzet)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">
            {filtered ? "Best seller — periode (qty)" : "Best seller — bulan ini (qty)"}
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">
            {filtered ? "Profit per hari (dalam rentang)" : "Profit harian"}
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={formatDashboardChartDate} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatIDR(v)} labelFormatter={formatDashboardChartDate} />
                <Legend />
                <Line type="monotone" dataKey="profit" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Stok menipis
          </h3>
          <div className="max-h-64 space-y-2 overflow-auto">
            {(data.lowStock || []).length === 0 ? (
              <p className="text-sm text-slate-500">Semua stok aman</p>
            ) : (
              (data.lowStock || []).map((p) => (
                <div key={p.id} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-amber-600">
                    {p.stock} / min {p.min_stock}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showFinance && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Volume penjualan (batang)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(data.bestSeller || []).slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="qty" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
