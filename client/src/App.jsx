import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import api from "./api/client";
import { useAuthStore } from "./store/authStore";
import { useThemeStore } from "./store/themeStore";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppShell } from "./components/AppShell";
import { Skeleton } from "./components/Skeleton";

const Login = lazy(() => import("./pages/Login.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const PosPage = lazy(() => import("./pages/PosPage.jsx"));
const ProductsPage = lazy(() => import("./pages/ProductsPage.jsx"));
const CustomersPage = lazy(() => import("./pages/CustomersPage.jsx"));
const SuppliersPage = lazy(() => import("./pages/SuppliersPage.jsx"));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage.jsx"));
const CashFlowPage = lazy(() => import("./pages/CashFlowPage.jsx"));
const ReportsPage = lazy(() => import("./pages/ReportsPage.jsx"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage.jsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));

function PageLoader() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function App() {
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const updateUser = useAuthStore((s) => s.updateUser);
  const initTheme = useThemeStore((s) => s.init);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  useEffect(() => {
    if (!token) return;
    api
      .get("/api/auth/me", { skipSessionExpiredToast: true })
      .then(({ data }) => updateUser(data))
      .catch(() => logout());
  }, [token, updateUser, logout]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={token ? <Navigate to="/app/dashboard" replace /> : <Login />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="pos" element={<PosPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="cash-flow" element={<CashFlowPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to={token ? "/app/dashboard" : "/login"} replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
