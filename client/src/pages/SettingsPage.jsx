import { useEffect } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { ActionButton } from "../components/ActionButton";

const defaultValues = {
  store_name: "",
  store_address: "",
  store_phone: "",
  receipt_footer: "",
  thermal_width_mm: "80",
  tax_default: "0",
  whatsapp_sender_note: "",
  allow_negative_stock: "0",
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
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="Pengaturan"
        subtitle="Toko, struk termal, dan catatan default"
      />

      <form className="card space-y-4 p-6" onSubmit={form.handleSubmit(onSubmit)}>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama toko</label>
          <input className="input-base mt-1.5" {...form.register("store_name")} />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Alamat (struk)</label>
          <textarea className="input-base mt-1.5" rows={2} {...form.register("store_address")} />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Telepon / WA toko</label>
          <input className="input-base mt-1.5" {...form.register("store_phone")} />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Footer struk</label>
          <input className="input-base mt-1.5" {...form.register("receipt_footer")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Lebar kertas termal (mm)</label>
            <input type="number" min={58} max={110} step={1} className="input-base mt-1.5" {...form.register("thermal_width_mm")} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Pajak default (%)</label>
            <input className="input-base mt-1.5" {...form.register("tax_default")} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Catatan WhatsApp</label>
          <textarea className="input-base mt-1.5" rows={3} {...form.register("whatsapp_sender_note")} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800"
              checked={form.watch("allow_negative_stock") === "1"}
              onChange={(e) => form.setValue("allow_negative_stock", e.target.checked ? "1" : "0")}
            />
            <div>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Izinkan Penjualan Stok Minus</span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Izinkan transaksi di POS tetap dapat diproses meskipun stok barang di sistem bernilai 0 atau kurang.
              </p>
            </div>
          </label>
        </div>
        <div className="pt-2">
          <ActionButton type="submit" variant="primary" size="md" className="w-full">
            Simpan Pengaturan
          </ActionButton>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200/80 bg-slate-100/60 p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        <p className="font-semibold text-slate-900 dark:text-white">Cetak & printer thermal (HP / tablet)</p>
        <p className="mt-1">
          Browser tidak bisa memilih printer Bluetooth secara langsung seperti aplikasi native. Di POS gunakan tombol Struk → dialog cetak sistem; pilih
          aplikasi/driver thermal (mis. RawBT, PrintHand, vendor printer) jika printer hanya Bluetooth. USB OTG ke printer termal biasanya paling stabil.
        </p>
      </div>
    </div>
  );
}
