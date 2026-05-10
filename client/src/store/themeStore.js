import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useThemeStore = create(
  persist(
    (set, get) => ({
      dark: false,
      toggle: () => {
        const next = !get().dark;
        document.documentElement.classList.toggle("dark", next);
        set({ dark: next });
      },
      init: () => {
        const d = get().dark;
        document.documentElement.classList.toggle("dark", d);
      },
    }),
    { name: "pos-keu-theme" }
  )
);
