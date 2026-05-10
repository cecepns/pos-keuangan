import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  Receipt,
  Wallet,
  BarChart3,
  UserCog,
  Settings,
  Menu,
  LogOut,
  Moon,
  Sun,
  Leaf,
} from "lucide-react";
import { useAuthStore, roleLabel } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import toast from "react-hot-toast";
import clsx from "clsx";

const nav = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "kasir", "owner"] },
  { to: "/app/pos", label: "POS", icon: ShoppingCart, roles: ["admin", "kasir", "owner"] },
  { to: "/app/products", label: "Produk", icon: Package, roles: ["admin", "owner"] },
  { to: "/app/customers", label: "Pelanggan", icon: Users, roles: ["admin", "kasir", "owner"] },
  { to: "/app/suppliers", label: "Supplier", icon: Truck, roles: ["admin", "owner"] },
  { to: "/app/transactions", label: "Transaksi", icon: Receipt, roles: ["admin", "kasir", "owner"] },
  { to: "/app/cash-flow", label: "Cash Flow", icon: Wallet, roles: ["admin", "owner"] },
  { to: "/app/reports", label: "Laporan", icon: BarChart3, roles: ["admin", "owner"] },
  { to: "/app/employees", label: "Karyawan & Gaji", icon: UserCog, roles: ["admin", "owner"] },
  { to: "/app/settings", label: "Pengaturan", icon: Settings, roles: ["admin"] },
];

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const dark = useThemeStore((s) => s.dark);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const initTheme = useThemeStore((s) => s.init);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  const filtered = nav.filter((n) => n.roles.includes(user?.role_name));

  function handleLogout() {
    logout();
    toast.success("Keluar");
    navigate("/login");
  }

  const linkCls = ({ isActive }) =>
    clsx(
      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
      isActive
        ? "bg-brand-600 text-white shadow-soft"
        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    );

  return (
    <div className="flex min-h-screen min-w-0 bg-slate-50 dark:bg-slate-950">
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-4 dark:border-slate-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Leaf className="h-6 w-6" />
          </div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-white">POS Keuangan</div>
            <div className="text-xs text-slate-500">Retail Tanaman</div>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {filtered.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkCls} onClick={() => setOpen(false)}>
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-100 p-3 dark:border-slate-800">
          <div className="mb-2 rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800">
            <div className="font-medium text-slate-900 dark:text-white">{user?.name}</div>
            <div className="text-slate-500">{roleLabel(user?.role_name)}</div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-label="Tutup menu"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 min-w-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <button
            type="button"
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="hidden text-sm text-slate-500 lg:block">
            {new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
              new Date()
            )}
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Toggle dark mode"
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
