import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

/**
 * Jika user punya daftar permissions dari server, gate izin per menu.
 * Tanpa / kosong permissions: perilaku lama (hanya role di route induk).
 */
export function PermGate({ perm, children }) {
  const user = useAuthStore((s) => s.user);
  const perms = user?.permissions;
  if (!perm) return children;
  if (!perms || perms.length === 0) return children;
  if (perms.includes("all")) return children;
  if (perms.includes(perm)) return children;
  return <Navigate to="/app/dashboard" replace />;
}
