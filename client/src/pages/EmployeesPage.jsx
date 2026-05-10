import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../api/client";
import { PAGE_SIZE } from "../constants/pagination";
import { formatIDR } from "../utils/format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Modal } from "../components/Modal";
import { PAGE_TABLE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";

export default function EmployeesPage() {
  const [emps, setEmps] = useState([]);
  const [empTotal, setEmpTotal] = useState(0);
  const [empPage, setEmpPage] = useState(1);
  const [empQin, setEmpQin] = useState("");
  const empDq = useDebouncedValue(empQin, 350);

  const [salaries, setSalaries] = useState([]);
  const [salTotal, setSalTotal] = useState(0);
  const [salPage, setSalPage] = useState(1);
  const [salQin, setSalQin] = useState("");
  const salDq = useDebouncedValue(salQin, 350);

  const [open, setOpen] = useState(false);
  const form = useForm({
    defaultValues: { name: "", phone: "", position: "", base_salary: 0, hire_date: "" },
  });
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();

  const loadEmps = useCallback(async () => {
    const { data } = await api.get("/api/employees", { params: { q: empDq, page: empPage, limit: PAGE_SIZE } });
    setEmps(data.data || []);
    setEmpTotal(Number(data.total ?? 0));
  }, [empDq, empPage]);

  const loadSal = useCallback(async () => {
    const { data } = await api.get("/api/salaries", {
      params: { month, year, q: salDq, page: salPage, limit: PAGE_SIZE },
    });
    setSalaries(data.data || []);
    setSalTotal(Number(data.total ?? 0));
  }, [salDq, salPage, month, year]);

  useEffect(() => {
    setEmpPage(1);
  }, [empDq]);

  useEffect(() => {
    setSalPage(1);
  }, [salDq]);

  useEffect(() => {
    loadEmps().catch(() => {});
  }, [loadEmps]);

  useEffect(() => {
    loadSal().catch(() => {});
  }, [loadSal]);

  async function onSubmit(v) {
    const t = toast.loading("Menyimpan...");
    try {
      await api.post("/api/employees", v);
      toast.success("OK", { id: t });
      setOpen(false);
      loadEmps();
    } catch {
      toast.dismiss(t);
    }
  }

  async function genSalary() {
    const t = toast.loading("Menghitung...");
    try {
      await api.post("/api/salaries/generate", { month, year });
      toast.success("Slip gaji dihitung", { id: t });
      loadSal();
    } catch {
      toast.dismiss(t);
    }
  }

  const empPages = Math.max(1, Math.ceil(empTotal / PAGE_SIZE));
  const salPages = Math.max(1, Math.ceil(salTotal / PAGE_SIZE));

  return (
    <PageStack>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Karyawan & gaji</h1>
          <p className="text-sm text-slate-500">Absensi & slip dapat dikembangkan lebih lanjut</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={genSalary} className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
            Hitung gaji bulan ini
          </button>
          <button type="button" onClick={() => setOpen(true)} className="rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
            Tambah karyawan
          </button>
        </div>
      </div>

      <input
        type="search"
        className="max-w-md rounded-2xl border px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        placeholder="Cari karyawan..."
        value={empQin}
        onChange={(e) => setEmpQin(e.target.value)}
      />

      <div className={PAGE_TABLE_WRAP}>
        <table className={PAGE_TABLE}>
          <thead className="bg-slate-50 dark:bg-slate-800/80">
            <tr>
              <th className="px-4 py-3 text-left">Nama</th>
              <th className="px-4 py-3 text-left">Posisi</th>
              <th className="px-4 py-3 text-right">Gaji pokok</th>
            </tr>
          </thead>
          <tbody>
            {emps.map((e) => (
              <tr key={e.id} className="border-t border-slate-50 dark:border-slate-800">
                <td className="px-4 py-3">{e.name}</td>
                <td className="px-4 py-3">{e.position}</td>
                <td className="px-4 py-3 text-right">{formatIDR(e.base_salary)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between text-sm text-slate-500">
        <span>
          Hal {empPage}/{empPages}
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={empPage <= 1} className="rounded-xl border px-3 py-1" onClick={() => setEmpPage((p) => p - 1)}>
            Prev
          </button>
          <button type="button" disabled={empPage >= empPages} className="rounded-xl border px-3 py-1" onClick={() => setEmpPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <h3 className="mb-2 font-semibold">Slip gaji {month}/{year}</h3>
        <input
          type="search"
          className="mb-3 max-w-md rounded-2xl border px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
          placeholder="Cari nama di slip..."
          value={salQin}
          onChange={(e) => setSalQin(e.target.value)}
        />
        <div className={PAGE_TABLE_WRAP}>
          <table className={PAGE_TABLE}>
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-right">Pokok</th>
                <th className="px-4 py-3 text-right">Bonus</th>
                <th className="px-4 py-3 text-right">Potongan</th>
                <th className="px-4 py-3 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {salaries.map((s) => (
                <tr key={s.id} className="border-t border-slate-50 dark:border-slate-800">
                  <td className="px-4 py-3">{s.employee_name}</td>
                  <td className="px-4 py-3 text-right">{formatIDR(s.base_amount)}</td>
                  <td className="px-4 py-3 text-right">{formatIDR(s.bonus_total)}</td>
                  <td className="px-4 py-3 text-right">{formatIDR(s.deduction_total)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatIDR(s.net_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex justify-between text-sm text-slate-500">
          <span>
            Hal {salPage}/{salPages}
          </span>
          <div className="flex gap-2">
            <button type="button" disabled={salPage <= 1} className="rounded-xl border px-3 py-1" onClick={() => setSalPage((p) => p - 1)}>
              Prev
            </button>
            <button type="button" disabled={salPage >= salPages} className="rounded-xl border px-3 py-1" onClick={() => setSalPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>

      <Modal open={open} title="Karyawan baru" onClose={() => setOpen(false)}>
        <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
          <div>
            <label className="text-xs text-slate-500">Nama</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("name", { required: true })} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Telepon</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("phone")} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Posisi</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("position")} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Gaji pokok</label>
            <input type="number" className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("base_salary")} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Mulai kerja</label>
            <input type="date" className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("hire_date")} />
          </div>
          <button type="submit" className="w-full rounded-xl bg-brand-600 py-2 font-semibold text-white">
            Simpan
          </button>
        </form>
      </Modal>
    </PageStack>
  );
}
