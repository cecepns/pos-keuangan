import axios from "axios";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/authStore";
import { API_BASE_URL } from "../utils/apiBase";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

function isAuthLoginRequest(config) {
  const u = config?.url || "";
  return u.includes("/api/auth/login");
}

api.interceptors.request.use((config) => {
  if (config.url && typeof config.url === "string" && config.url.startsWith("/")) {
    config.url = config.url.slice(1);
  }
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const msg = err.response?.data?.error || err.message || "Terjadi kesalahan";
    const cfg = err.config || {};

    // Jangan anggap salah password saat login sebagai "sesi habis"
    if (status === 401 && isAuthLoginRequest(cfg)) {
      if (!cfg.skipToast) toast.error(msg);
      return Promise.reject(err);
    }

    if (status === 401) {
      useAuthStore.getState().logout();
      const silent = cfg.skipSessionExpiredToast === true;
      if (!cfg.skipToast && !silent) toast.error("Sesi berakhir, silakan login lagi");
      return Promise.reject(err);
    }

    if (!cfg.skipToast) toast.error(msg);
    return Promise.reject(err);
  }
);

export default api;
