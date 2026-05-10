import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-slate-500">Halaman tidak ditemukan</p>
      <Link to="/app/dashboard" className="rounded-xl bg-brand-600 px-5 py-2 text-white">
        Ke dashboard
      </Link>
    </div>
  );
}
