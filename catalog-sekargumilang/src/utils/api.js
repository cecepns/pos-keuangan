import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://api-be.sekargumilangorchid.my.id";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    if (config.url && typeof config.url === "string" && config.url.startsWith("/")) {
      config.url = config.url.slice(1);
    }

    const storedAuth = localStorage.getItem("catalog-auth-store");
    if (storedAuth) {
      try {
        const parsed = JSON.parse(storedAuth);
        const token = parsed?.state?.token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (err) {
        // Ignore
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);
