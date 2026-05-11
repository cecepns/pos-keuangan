import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import api from "./api/client";
import { useAuthStore } from "./store/authStore";
import { useThemeStore } from "./store/themeStore";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PermGate } from "./components/PermGate";
import { AppShell } from "./components/AppShell";
import { Skeleton } from "./components/Skeleton";

const Login = lazy(() => import("./pages/Login.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const PosPage = lazy(() => import("./pages/PosPage.jsx"));
const ProductsPage = lazy(() => import("./pages/ProductsPage.jsx"));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage.jsx"));
const BarcodeLabelsPage = lazy(() => import("./pages/BarcodeLabelsPage.jsx"));
const StockSummaryPage = lazy(() => import("./pages/StockSummaryPage.jsx"));
const StockAdjustPage = lazy(() => import("./pages/StockAdjustPage.jsx"));
const LowStockPage = lazy(() => import("./pages/LowStockPage.jsx"));
const OperationalExpensePage = lazy(() => import("./pages/OperationalExpensePage.jsx"));
const CustomersPage = lazy(() => import("./pages/CustomersPage.jsx"));
const SuppliersPage = lazy(() => import("./pages/SuppliersPage.jsx"));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage.jsx"));
const CashFlowPage = lazy(() => import("./pages/CashFlowPage.jsx"));
const ReportsPage = lazy(() => import("./pages/ReportsPage.jsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx"));
const ExpenseCategoriesPage = lazy(() => import("./pages/ExpenseCategoriesPage.jsx"));
const UsersPage = lazy(() => import("./pages/UsersPage.jsx"));
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
            <Route path="dashboard" element={<PermGate perm="dashboard"><Dashboard /></PermGate>} />
            <Route path="pos" element={<PermGate perm="pos"><PosPage /></PermGate>} />
            <Route path="products" element={<PermGate perm="products"><ProductsPage /></PermGate>} />
            <Route path="categories" element={<PermGate perm="categories"><CategoriesPage /></PermGate>} />
            <Route path="barcode-labels" element={<PermGate perm="barcode_labels"><BarcodeLabelsPage /></PermGate>} />
            <Route path="stock-summary" element={<PermGate perm="stock_summary"><StockSummaryPage /></PermGate>} />
            <Route path="stock-adjust" element={<PermGate perm="stock_adjust"><StockAdjustPage /></PermGate>} />
            <Route path="low-stock" element={<PermGate perm="low_stock"><LowStockPage /></PermGate>} />
            <Route path="expenses" element={<PermGate perm="expenses"><OperationalExpensePage /></PermGate>} />
            <Route path="expense-categories" element={<PermGate perm="expense_categories"><ExpenseCategoriesPage /></PermGate>} />
            <Route path="customers" element={<PermGate perm="customers"><CustomersPage /></PermGate>} />
            <Route path="suppliers" element={<PermGate perm="suppliers"><SuppliersPage /></PermGate>} />
            <Route path="transactions" element={<PermGate perm="transactions"><TransactionsPage /></PermGate>} />
            <Route path="cash-flow" element={<PermGate perm="cashflow"><CashFlowPage /></PermGate>} />
            <Route path="reports" element={<PermGate perm="reports"><ReportsPage /></PermGate>} />
            <Route path="users" element={<PermGate perm="users"><UsersPage /></PermGate>} />
            <Route path="settings" element={<PermGate perm="settings"><SettingsPage /></PermGate>} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to={token ? "/app/dashboard" : "/login"} replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
