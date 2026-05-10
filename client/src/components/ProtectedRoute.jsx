import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export function ProtectedRoute({ roles }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const loc = useLocation();

  if (!token || !user) return <Navigate to="/login" replace state={{ from: loc }} />;

  if (roles?.length && !roles.includes(user.role_name)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Outlet />;
}
