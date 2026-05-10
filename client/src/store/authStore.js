import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      updateUser: (user) => set({ user }),
    }),
    { name: "pos-keu-auth" }
  )
);

export function roleLabel(role) {
  const m = { admin: "Admin", kasir: "Kasir", owner: "Owner" };
  return m[role] || role;
}
