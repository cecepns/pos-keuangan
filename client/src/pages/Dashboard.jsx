import { useEffect, useState } from "react";
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
import api from "../api/client";
import { formatIDR } from "../utils/format";
import { Skeleton } from "../components/Skeleton";
import { useAuthStore } from "../store/authStore";

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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: d } = await api.get("/api/dashboard/summary");
        if (alive) setData(d);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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

  const omzetDelta =
    data.compareMonth.omzetPrev > 0
      ? ((data.compareMonth.omzetNow - data.compareMonth.omzetPrev) / data.compareMonth.omzetPrev) * 100
      : 0;
  const marginDelta =
    data.compareMonth.marginPrev > 0
      ? ((data.compareMonth.marginNow - data.compareMonth.marginPrev) / data.compareMonth.marginPrev) * 100
      : 0;

  const salesData = (data.charts?.sales || []).map((r) => ({
    name: r.d,
    omzet: Number(r.total),
  }));
  const profitData = (data.charts?.profit || []).map((r) => ({
    name: r.d,
    profit: Number(r.total),
  }));

  const pieData = (data.bestSeller || []).slice(0, 6).map((b) => ({
    name: b.name?.slice(0, 18) || "Produk",
    value: Number(b.qty),
  }));

  const showFinance = role !== "kasir";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500">Ringkasan operasional & performa penjualan</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Omzet hari ini" value={formatIDR(data.today.omzet)} icon={TrendingUp} accent="bg-emerald-500" />
        <StatCard title="Profit hari ini" value={formatIDR(data.today.profit)} icon={Wallet} accent="bg-teal-600" />
        <StatCard title="Transaksi" value={String(data.today.transactions)} icon={ShoppingBag} accent="bg-cyan-600" />
        <StatCard title="Produk terjual (qty)" value={String(Math.round(data.today.itemsSold))} icon={ShoppingBag} accent="bg-brand-700" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-white">Omzet vs bulan lalu</h3>
            <span
              className={`flex items-center gap-1 text-sm font-medium ${omzetDelta >= 0 ? "text-emerald-600" : "text-red-500"}`}
            >
              {omzetDelta >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {omzetDelta.toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Bulan ini {formatIDR(data.compareMonth.omzetNow)} · Bulan lalu {formatIDR(data.compareMonth.omzetPrev)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-white">Margin vs bulan lalu</h3>
            <span
              className={`flex items-center gap-1 text-sm font-medium ${marginDelta >= 0 ? "text-emerald-600" : "text-red-500"}`}
            >
              {marginDelta >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {marginDelta.toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Margin bulan ini {formatIDR(data.compareMonth.marginNow)} · Bulan lalu {formatIDR(data.compareMonth.marginPrev)}
          </p>
        </div>
      </div>

      {showFinance && data.cashFlow && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500">Kas masuk (hari ini)</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">{formatIDR(data.cashFlow.in)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500">Kas keluar (hari ini)</p>
            <p className="mt-1 text-xl font-bold text-red-500">{formatIDR(data.cashFlow.out)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500">Piutang / Hutang berjalan</p>
            <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
              P: {formatIDR(data.debt?.piutang || 0)} · H: {formatIDR(data.debt?.hutang || 0)}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Tren penjualan (14 hari)</h3>
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
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatIDR(v)} />
                <Area type="monotone" dataKey="omzet" stroke="#0d9488" fillOpacity={1} fill="url(#gOmzet)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Best seller — bulan ini (qty)</h3>
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
          <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Profit harian</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatIDR(v)} />
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
