import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-2xl bg-slate-100 p-5 dark:bg-slate-800">
        <FileQuestion className="h-10 w-10 text-slate-400 dark:text-slate-500" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">404</h1>
        <p className="mt-1 text-sm text-slate-500">Halaman tidak ditemukan</p>
      </div>
      <Link
        to="/app/dashboard"
        className="mt-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
      >
        Ke dashboard
      </Link>
    </div>
  );
}
