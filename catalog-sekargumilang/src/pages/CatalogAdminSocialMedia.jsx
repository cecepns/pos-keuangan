import React, { useState, useEffect } from "react";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../utils/api";
import { API_ENDPOINTS } from "../utils/endpoints";

export default function CatalogAdminSocialMedia() {
  const [ig, setIg] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [fb, setFb] = useState("");
  const [youtube, setYoutube] = useState("");
  const [waContacts, setWaContacts] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load social media settings
  const loadSocialMedia = async () => {
    setLoading(true);
    try {
      const res = await api.get(API_ENDPOINTS.CATALOG.SOCIAL);
      if (res.data?.success) {
        const { data } = res.data;
        setIg(data.ig || "");
        setTiktok(data.tiktok || "");
        setFb(data.fb || "");
        setYoutube(data.youtube || "");
        setWaContacts(Array.isArray(data.wa) ? data.wa : []);
      }
    } catch (err) {
      toast.error("Gagal mengambil data sosial media");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSocialMedia();
  }, []);

  const handleAddContact = () => {
    setWaContacts([...waContacts, { name: "", phone: "" }]);
  };

  const handleRemoveContact = (index) => {
    const next = waContacts.filter((_, idx) => idx !== index);
    setWaContacts(next);
  };

  const handleContactChange = (index, field, value) => {
    const next = [...waContacts];
    next[index][field] = value;
    setWaContacts(next);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    // Validations
    for (let i = 0; i < waContacts.length; i++) {
      const contact = waContacts[i];
      if (!contact.name.trim()) {
        toast.error(`Nama kontak ke-${i + 1} wajib diisi`);
        return;
      }
      if (!contact.phone.trim()) {
        toast.error(`Nomor kontak ke-${i + 1} wajib diisi`);
        return;
      }
      // Phone number formatting validation (only numbers/plus, min 8 digits)
      const cleanPhone = contact.phone.replace(/\D/g, "");
      if (cleanPhone.length < 8) {
        toast.error(`Nomor kontak ke-${i + 1} tidak valid (minimal 8 digit)`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        ig: ig.trim(),
        tiktok: tiktok.trim(),
        fb: fb.trim(),
        youtube: youtube.trim(),
        wa: waContacts.map(c => ({
          name: c.name.trim(),
          phone: c.phone.trim().replace(/\D/g, "") // Keep digits only for safety
        }))
      };

      await api.put(API_ENDPOINTS.ADMIN.SOCIAL, payload);
      toast.success("Sosial media & kontak WA berhasil diperbarui");
      loadSocialMedia();
    } catch (err) {
      toast.error("Gagal memperbarui data sosial media");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <span className="text-xs text-slate-400 font-bold mt-2">Memuat pengaturan...</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm">
      
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Social media links */}
        <div className="space-y-4">
          <h2 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-100">
            Media Sosial Katalog
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Username Instagram</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">@</span>
                <input
                  type="text"
                  placeholder="anggrek_sekargumilang"
                  value={ig}
                  onChange={(e) => setIg(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-50 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Username TikTok</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">@</span>
                <input
                  type="text"
                  placeholder="anggrekmurahpurwokerto"
                  value={tiktok}
                  onChange={(e) => setTiktok(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-50 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Nama Facebook Page</label>
              <input
                type="text"
                placeholder="Anggrek Sekar Gumilang"
                value={fb}
                onChange={(e) => setFb(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-50 transition-all"
              />
            </div>

            <div>
              <label className="block text-2xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Nama Channel YouTube</label>
              <input
                type="text"
                placeholder="Anggrek Sekar Gumilang"
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-50 transition-all"
              />
            </div>
          </div>
        </div>

        {/* WhatsApp Contacts */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">
              Kontak WhatsApp Order (Bisa Banyak)
            </h2>
            <button
              type="button"
              onClick={handleAddContact}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-200 hover:border-emerald-400 text-emerald-700 font-extrabold text-2xs rounded-lg active:scale-95 transition-all cursor-pointer bg-emerald-50/30"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Kontak
            </button>
          </div>

          <div className="space-y-3">
            {waContacts.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                <span className="text-2xs text-slate-400 font-bold">Belum ada kontak WhatsApp. Silakan tambah minimal satu.</span>
              </div>
            ) : (
              waContacts.map((contact, idx) => (
                <div key={idx} className="flex gap-3 items-end bg-slate-50/55 p-3.5 rounded-xl border border-slate-100">
                  <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-3xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">Nama Admin/Kontak</label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Admin Siska"
                        value={contact.name}
                        onChange={(e) => handleContactChange(idx, "name", e.target.value)}
                        className="w-full px-3 py-2 bg-white text-xs font-semibold rounded-lg border border-slate-200 outline-none focus:border-emerald-300 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-3xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">Nomor WA (Contoh: 081234567890)</label>
                      <input
                        type="text"
                        required
                        placeholder="081234567890"
                        value={contact.phone}
                        onChange={(e) => handleContactChange(idx, "phone", e.target.value)}
                        className="w-full px-3 py-2 bg-white text-xs font-semibold rounded-lg border border-slate-200 outline-none focus:border-emerald-300 transition-all"
                      />
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => handleRemoveContact(idx)}
                    className="p-2.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-all flex-shrink-0 cursor-pointer"
                    title="Hapus Kontak"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 active:scale-95 text-white font-extrabold text-xs px-6 py-3 rounded-xl shadow-md shadow-emerald-600/15 cursor-pointer transition-all"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Pengaturan
          </button>
        </div>

      </form>
    </div>
  );
}
