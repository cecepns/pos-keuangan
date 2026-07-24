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
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuthStore } from "../store/authStore";
import { PageHeader } from "../components/PageHeader";
import { ActionButton } from "../components/ActionButton";
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
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${accent}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function DeltaBadge({ delta }) {
  const positive = delta >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
        positive
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
      }`}
    >
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(delta).toFixed(1)}%
    </span>
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
    return <LoadingSpinner label="Memuat dashboard…" />;
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
    <div className="relative space-y-5">
      {refreshing ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-end p-2">
          <span className="rounded-full bg-slate-900/80 px-3 py-1 text-xs font-medium text-white animate-fade-in">Memuat…</span>
        </div>
      ) : null}

      <PageHeader
        title="Dashboard"
        subtitle={
          filtered
            ? `Ringkasan operasional · Filter: ${formatDateID(data.filter.from)} — ${formatDateID(data.filter.to)}`
            : "Ringkasan operasional & performa penjualan"
        }
      />

      {/* Filter */}
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div>
          <label className="text-xs font-medium text-slate-500">Dari</label>
          <input
            type="date"
            className="input-base mt-1"
            value={draftFrom}
            onChange={(e) => setDraftFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Sampai</label>
          <input
            type="date"
            className="input-base mt-1"
            value={draftTo}
            onChange={(e) => setDraftTo(e.target.value)}
          />
        </div>
        <ActionButton variant="primary" size="sm" onClick={applyFilter}>Terapkan</ActionButton>
        <ActionButton variant="secondary" size="sm" onClick={resetFilter}>Reset</ActionButton>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2 sm:border-0 sm:pt-0 dark:border-slate-800">
          <ActionButton variant="ghost" size="xs" onClick={presetThisMonth}>Bulan ini</ActionButton>
          <ActionButton variant="ghost" size="xs" onClick={presetLast7Days}>7 hari terakhir</ActionButton>
        </div>
      </div>

      {/* Stat cards */}
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

      {/* Comparison */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {filtered ? "Omzet vs periode sebelumnya" : "Omzet vs bulan lalu"}
            </h3>
            <DeltaBadge delta={omzetDelta} />
          </div>
          <p className="text-xs text-slate-500">
            {filtered ? "Periode dipilih" : "Bulan ini"} {formatIDR(data.compareMonth.omzetNow)} ·{" "}
            {filtered ? "Sebelumnya" : "Bulan lalu"} {formatIDR(data.compareMonth.omzetPrev)}
          </p>
        </div>
        <div className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {filtered ? "Margin vs periode sebelumnya" : "Margin vs bulan lalu"}
            </h3>
            <DeltaBadge delta={marginDelta} />
          </div>
          <p className="text-xs text-slate-500">
            {filtered ? "Margin periode ini" : "Margin bulan ini"} {formatIDR(data.compareMonth.marginNow)} ·{" "}
            {filtered ? "Sebelumnya" : "Bulan lalu"} {formatIDR(data.compareMonth.marginPrev)}
          </p>
        </div>
      </div>

      {/* Cash flow summary */}
      {showFinance && data.cashFlow && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{filtered ? "Kas masuk (periode)" : "Kas masuk (hari ini)"}</p>
            <p className="mt-1.5 text-lg font-semibold text-emerald-600">{formatIDR(data.cashFlow.in)}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{filtered ? "Kas keluar (periode)" : "Kas keluar (hari ini)"}</p>
            <p className="mt-1.5 text-lg font-semibold text-red-500">{formatIDR(data.cashFlow.out)}</p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2 card p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
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

        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
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

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
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

        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Stok menipis
          </h3>
          <div className="max-h-64 space-y-1.5 overflow-auto">
            {(data.lowStock || []).length === 0 ? (
              <p className="text-sm text-slate-500">Semua stok aman</p>
            ) : (
              (data.lowStock || []).map((p) => (
                <div key={p.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
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
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Volume penjualan (batang)</h3>
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
