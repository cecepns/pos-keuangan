import React, { useState } from "react";
import { Link, Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import { Menu, X, ShoppingBag, Folder, GitMerge, Share2, LogOut, Globe, Leaf } from "lucide-react";
import { useAuthStore } from "../store/authStore";

export default function CatalogAdminLayout() {
  const { token, user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();

  // Route protection
  if (!token || !user) {
    return <Navigate to="/catalog-admin/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate("/catalog-admin/login", { replace: true });
  };

  const navItems = [
    { label: "Manajemen Produk", path: "/catalog-admin/products", icon: ShoppingBag },
    { label: "Kategori Produk", path: "/catalog-admin/categories", icon: Folder },
    { label: "Subkategori Produk", path: "/catalog-admin/subcategories", icon: GitMerge },
    { label: "Sosial Media & WA", path: "/catalog-admin/social", icon: Share2 },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-emerald-900 text-emerald-100 flex-shrink-0 border-r border-emerald-950/20 shadow-xl">
        {/* Brand Banner */}
        <div className="h-16 flex items-center gap-2.5 px-6 border-b border-emerald-950/30 bg-emerald-950/20">
          <Leaf className="w-6 h-6 text-emerald-400 fill-emerald-400/20" />
          <span className="font-black tracking-tight text-white uppercase text-sm">Panel Catalog</span>
        </div>

        {/* Navigation links */}
        <nav className="flex-grow p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = loc.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-700/35"
                    : "hover:bg-emerald-800/50 text-emerald-200 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer profile & actions */}
        <div className="p-4 border-t border-emerald-950/30 bg-emerald-950/10 space-y-2">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold text-emerald-300 hover:text-white hover:bg-emerald-800/40 transition-all"
          >
            <Globe className="w-4 h-4" />
            Buka Toko / Katalog
          </a>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold text-rose-300 hover:text-white hover:bg-rose-900/30 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Keluar Panel
          </button>
        </div>
      </aside>

      {/* Sidebar - Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex animate-in fade-in duration-200">
          {/* Overlay */}
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)}></div>
          
          {/* Drawer container */}
          <aside className="relative flex flex-col w-64 bg-emerald-900 text-emerald-100 shadow-2xl h-full animate-in slide-in-from-left duration-200">
            <div className="h-16 flex items-center justify-between px-6 border-b border-emerald-950/30">
              <div className="flex items-center gap-2">
                <Leaf className="w-6 h-6 text-emerald-400" />
                <span className="font-bold text-white uppercase text-xs">Sekar Gumilang</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1 text-emerald-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-grow p-4 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = loc.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                      isActive ? "bg-emerald-600 text-white" : "hover:bg-emerald-800/50 text-emerald-200"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-emerald-950/30 bg-emerald-950/10 space-y-2">
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-2 rounded-lg text-xs font-bold text-emerald-300 hover:text-white"
              >
                <Globe className="w-4 h-4" />
                Buka Toko / Katalog
              </a>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-xs font-bold text-rose-300 hover:text-white cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Keluar Panel
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Panel Content Area */}
      <div className="flex-grow flex flex-col min-w-0">
        {/* Header toolbar */}
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-8 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-700 md:hidden hover:bg-slate-50 rounded-xl"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm md:text-md font-bold text-slate-800 hidden sm:block">
              {navItems.find(item => item.path === loc.pathname)?.label || "Dashboard Admin"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right leading-none hidden xs:block">
              <div className="text-xs font-black text-slate-700">{user?.name}</div>
              <span className="text-4xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md mt-0.5 inline-block">
                {user?.role_name || "Admin"}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-extrabold text-sm border border-emerald-200">
              {user?.name ? user.name.charAt(0).toUpperCase() : "A"}
            </div>
          </div>
        </header>

        {/* Workspace router content */}
        <main className="flex-grow overflow-y-auto p-4 md:p-8 bg-slate-50">
          <Outlet />
        </main>
      </div>

    </div>
  );
}
