import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FolderOpen,
  FolderTree,
  Printer,
  ClipboardList,
  SlidersHorizontal,
  AlertTriangle,
  Banknote,
  Users,
  Truck,
  Landmark,
  Receipt,
  Wallet,
  BarChart3,
  Shield,
  Settings,
  Menu,
  LogOut,
  Moon,
  Sun,
  Leaf,
  X,
  ChevronDown,
} from "lucide-react";
import api from "../api/client";
import { useAuthStore, roleLabel } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import toast from "react-hot-toast";
import clsx from "clsx";

/**
 * Menu terstruktur (Main Menu -> Sub Menu Collapse)
 */
const navStructure = [
  {
    type: "item",
    to: "/app/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "kasir", "owner"],
    perm: "dashboard",
  },
  {
    type: "item",
    to: "/app/pos",
    label: "POS Kasir",
    icon: ShoppingCart,
    roles: ["admin", "kasir", "owner"],
    perm: "pos",
  },
  {
    type: "group",
    id: "inventaris",
    label: "Stok & Barang",
    icon: Package,
    children: [
      {
        to: "/app/products",
        label: "Data Barang",
        icon: Package,
        roles: ["admin", "owner"],
        perm: "products",
      },
      {
        to: "/app/categories",
        label: "Kategori Barang",
        icon: FolderOpen,
        roles: ["admin", "owner"],
        perm: "categories",
      },
      {
        to: "/app/barcode-labels",
        label: "Cetak Barcode",
        icon: Printer,
        roles: ["admin", "owner"],
        perm: "barcode_labels",
      },
      {
        to: "/app/stock-summary",
        label: "Data Stok",
        icon: ClipboardList,
        roles: ["admin", "owner"],
        perm: "stock_summary",
      },
      {
        to: "/app/stock-adjust",
        label: "Penyesuaian Stok",
        icon: SlidersHorizontal,
        roles: ["admin", "owner"],
        perm: "stock_adjust",
      },
      {
        to: "/app/low-stock",
        label: "Stok Menipis",
        icon: AlertTriangle,
        roles: ["admin", "owner"],
        perm: "low_stock",
      },
    ],
  },
  {
    type: "group",
    id: "kontak",
    label: "Pelanggan & Supplier",
    icon: Users,
    children: [
      {
        to: "/app/customers",
        label: "Pelanggan",
        icon: Users,
        roles: ["admin", "kasir", "owner"],
        perm: "customers",
      },
      {
        to: "/app/suppliers",
        label: "Supplier",
        icon: Truck,
        roles: ["admin", "owner"],
        perm: "suppliers",
      },
      {
        to: "/app/supplier-payables",
        label: "Hutang Supplier",
        icon: Landmark,
        roles: ["admin", "owner"],
        perm: "suppliers",
      },
    ],
  },
  {
    type: "group",
    id: "keuangan",
    label: "Keuangan & Kas",
    icon: Wallet,
    children: [
      {
        to: "/app/transactions",
        label: "Transaksi Sales",
        icon: Receipt,
        roles: ["admin", "kasir", "owner"],
        perm: "transactions",
      },
      {
        to: "/app/expenses",
        label: "Pengeluaran",
        icon: Banknote,
        roles: ["admin", "owner"],
        perm: "expenses",
      },
      {
        to: "/app/expense-categories",
        label: "Kat. Pengeluaran",
        icon: FolderTree,
        roles: ["admin", "owner"],
        perm: "expense_categories",
      },
      {
        to: "/app/cash-flow",
        label: "Cash Flow & Kas",
        icon: Wallet,
        roles: ["admin", "owner"],
        perm: "cashflow",
      },
    ],
  },
  {
    type: "item",
    to: "/app/reports",
    label: "Laporan",
    icon: BarChart3,
    roles: ["admin", "owner"],
    perm: "reports",
  },
  {
    type: "group",
    id: "pengaturan",
    label: "Sistem & Akses",
    icon: Settings,
    children: [
      {
        to: "/app/users",
        label: "Pengguna & Akses",
        icon: Shield,
        roles: ["admin"],
        perm: "users",
      },
      {
        to: "/app/settings",
        label: "Pengaturan Toko",
        icon: Settings,
        roles: ["admin"],
        perm: "settings",
      },
    ],
  },
];

function canAccessNavItem(user, item) {
  if (!user?.role_name) return false;
  const perms = user.permissions || [];
  const hasAll = perms.includes("all");
  if (item.perm && (hasAll || perms.includes(item.perm))) return true;
  if (!item.roles?.includes(user.role_name)) return false;
  if (!perms.length) return true;
  if (hasAll) return true;
  return item.perm ? perms.includes(item.perm) : true;
}

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [storeName, setStoreName] = useState("");
  const dark = useThemeStore((s) => s.dark);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const initTheme = useThemeStore((s) => s.init);

  // State untuk melacak grup menu yang ter-expand
  const [openGroups, setOpenGroups] = useState({});

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  useEffect(() => {
    if (!user) return;
    api
      .get("/api/settings", { skipToast: true })
      .then(({ data }) => {
        const n = String(data?.store_name ?? "").trim();
        setStoreName(n);
      })
      .catch(() => setStoreName(""));
  }, [user]);

  // Otomatis buka group jika halaman aktif ada di dalam group tersebut
  useEffect(() => {
    navStructure.forEach((node) => {
      if (node.type === "group") {
        const hasActiveChild = node.children?.some((child) => location.pathname.startsWith(child.to));
        if (hasActiveChild) {
          setOpenGroups((prev) => ({ ...prev, [node.id]: true }));
        }
      }
    });
  }, [location.pathname]);

  const toggleGroup = (groupId) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  function handleLogout() {
    logout();
    toast.success("Keluar");
    navigate("/login");
  }

  const sidebarTitle = storeName || "POS Keuangan";

  const linkCls = ({ isActive }) =>
    clsx(
      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150",
      isActive
        ? "bg-brand-600 text-white shadow-sm"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
    );

  const subLinkCls = ({ isActive }) =>
    clsx(
      "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150",
      isActive
        ? "bg-brand-50 text-brand-700 font-semibold dark:bg-brand-950/40 dark:text-brand-300"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200",
    );

  return (
    <div className="flex min-h-screen min-w-0 bg-slate-50 dark:bg-slate-950">
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-slate-200/80 bg-white transition-transform duration-200 ease-out dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-100 px-4 dark:border-slate-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Leaf className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="truncate text-sm font-semibold leading-tight text-slate-900 dark:text-white"
              title={sidebarTitle}
            >
              KING POS
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2 scrollbar-thin">
          {navStructure.map((node, idx) => {
            if (node.type === "item") {
              if (!canAccessNavItem(user, node)) return null;
              return (
                <NavLink
                  key={node.to}
                  to={node.to}
                  className={linkCls}
                  onClick={() => setOpen(false)}
                >
                  <node.icon className="h-4 w-4 shrink-0" />
                  {node.label}
                </NavLink>
              );
            }

            if (node.type === "group") {
              const allowedChildren = node.children?.filter((child) => canAccessNavItem(user, child)) || [];
              if (allowedChildren.length === 0) return null;

              const isOpen = !!openGroups[node.id];
              const isGroupActive = allowedChildren.some((child) => location.pathname.startsWith(child.to));

              return (
                <div key={node.id} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(node.id)}
                    className={clsx(
                      "flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150",
                      isGroupActive && !isOpen
                        ? "text-brand-600 font-semibold bg-brand-50/60 dark:bg-brand-950/20 dark:text-brand-400"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <node.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{node.label}</span>
                    </div>
                    <ChevronDown
                      className={clsx("h-3.5 w-3.5 shrink-0 transition-transform duration-200 text-slate-400", isOpen && "rotate-180")}
                    />
                  </button>

                  {isOpen && (
                    <div className="ml-3 pl-2 space-y-0.5 border-l border-slate-200/80 dark:border-slate-800 animate-fade-in">
                      {allowedChildren.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          className={subLinkCls}
                          onClick={() => setOpen(false)}
                        >
                          <child.icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{child.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })}
        </nav>

        <div className="shrink-0 border-t border-slate-100 p-2 dark:border-slate-800">
          <div className="mb-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
            <div className="text-xs font-medium text-slate-900 dark:text-white">
              {user?.name}
            </div>
            <div className="text-[11px] text-slate-500">{roleLabel(user?.role_name)}</div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <LogOut className="h-3.5 w-3.5" />
            Keluar
          </button>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden animate-fade-in"
          aria-label="Tutup menu"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col lg:pl-60">
        <header className="fixed top-0 left-0 right-0 z-20 flex h-14 min-w-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 lg:left-60">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden text-xs text-slate-500 lg:block">
            {new Intl.DateTimeFormat("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date())}
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Toggle dark mode"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </header>
        <main className="mt-14 min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
