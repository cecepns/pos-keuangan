import { useForm } from "react-hook-form";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { Leaf } from "lucide-react";
import api from "../api/client";
import { useAuthStore } from "../store/authStore";

export default function Login() {
  const navigate = useNavigate();
  const loc = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { register, handleSubmit, formState } = useForm({
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values) {
    const t = toast.loading("Masuk...");
    try {
      const { data } = await api.post("/api/auth/login", values);
      setAuth(data.token, data.user);
      toast.success(`Selamat datang, ${data.user.name}`, { id: t });
      navigate(loc.state?.from?.pathname || "/app/dashboard", { replace: true });
    } catch {
      toast.dismiss(t);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-teal-500 p-6">
      <div className="w-full max-w-sm animate-slide-up rounded-2xl bg-white p-7 shadow-xl dark:bg-slate-900">
        <div className="mb-7 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            <Leaf className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">SEKAR GUMILANG ORCHID</h1>
          <p className="text-sm text-slate-500">Masuk untuk melanjutkan</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <input
              type="email"
              autoComplete="username"
              className="input-base"
              {...register("email", { required: true })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              className="input-base"
              {...register("password", { required: true })}
            />
          </div>
          <button
            type="submit"
            disabled={formState.isSubmitting}
            className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 disabled:opacity-60"
          >
            {formState.isSubmitting ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
