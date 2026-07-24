import React from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Leaf } from "lucide-react";
import { api } from "../utils/api";
import { API_ENDPOINTS } from "../utils/endpoints";
import { useAuthStore } from "../store/authStore";

export default function CatalogAdminLogin() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { register, handleSubmit, formState } = useForm({
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values) {
    const t = toast.loading("Masuk ke Panel Katalog...");
    try {
      const response = await api.post(API_ENDPOINTS.AUTH.LOGIN, values);
      const data = response.data;
      
      // Verify role permissions
      const role = data.user?.role_name;
      if (role !== "admin" && role !== "owner") {
        toast.error("Akses Ditolak: Hanya Admin atau Owner yang dapat mengelola katalog.", { id: t });
        return;
      }
      
      setAuth(data.token, data.user);
      toast.success(`Selamat datang, ${data.user.name}`, { id: t });
      navigate("/catalog-admin/products", { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error || "Kredensial login salah atau masalah jaringan";
      toast.error(msg, { id: t });
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-500 p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
            <Leaf className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Katalog Sekar Gumilang</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Panel Admin & Manajemen</p>
        </div>
        
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 uppercase tracking-wider">Email Admin</label>
            <input
              type="email"
              autoComplete="username"
              placeholder="admin@pos.local"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all font-medium"
              {...register("email", { required: true })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all font-medium"
              {...register("password", { required: true })}
            />
          </div>
          <button
            type="submit"
            disabled={formState.isSubmitting}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 py-3.5 font-extrabold text-sm text-white shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
          >
            {formState.isSubmitting ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
