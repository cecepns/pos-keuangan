import { useEffect } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../api/client";

const defaultValues = {
  store_name: "",
  store_address: "",
  store_phone: "",
  receipt_footer: "",
  thermal_width_mm: "80",
  tax_default: "0",
  whatsapp_sender_note: "",
};

export default function SettingsPage() {
  const form = useForm({ defaultValues });

  useEffect(() => {
    api.get("/api/settings").then(({ data }) => form.reset({ ...defaultValues, ...data }));
  }, [form]);

  async function onSubmit(v) {
    const t = toast.loading("Menyimpan...");
    try {
      await api.put("/api/settings", v);
      toast.success("Pengaturan disimpan", { id: t });
    } catch {
      toast.dismiss(t);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pengaturan</h1>
        <p className="text-sm text-slate-500">Toko, struk termal, dan catatan default</p>
      </div>
      <form className="space-y-4 rounded-2xl border bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900" onSubmit={form.handleSubmit(onSubmit)}>
        <div>
          <label className="text-xs text-slate-500">Nama toko</label>
          <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("store_name")} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Alamat (struk)</label>
          <textarea className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" rows={2} {...form.register("store_address")} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Telepon / WA toko</label>
          <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("store_phone")} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Footer struk</label>
          <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("receipt_footer")} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Lebar kertas termal (mm)</label>
          <input type="number" min={58} max={110} step={1} className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("thermal_width_mm")} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Pajak default (%)</label>
          <input className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" {...form.register("tax_default")} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Catatan WhatsApp</label>
          <textarea className="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" rows={3} {...form.register("whatsapp_sender_note")} />
        </div>
        <button type="submit" className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white">
          Simpan
        </button>
      </form>
    </div>
  );
}
