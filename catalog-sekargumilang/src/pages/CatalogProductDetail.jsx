import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Share2,
  Copy,
  MessageCircle,
  ShoppingCart,
  Phone,
  X,
  Loader2,
  Tag,
  Package,
} from "lucide-react";
import toast from "react-hot-toast";
import { request } from "../utils/request";
import { API_ENDPOINTS } from "../utils/endpoints";
import { formatIDR } from "../utils/format";
import {
  resolveCatalogImageUrl,
  getProductImages,
  normalizeWaPhone,
  getProductShareUrl,
} from "../utils/catalogHelpers";
import { useCatalogCart } from "../hooks/useCatalogCart";
import ProductImageGallery from "../components/ProductImageGallery";

export default function CatalogProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCatalogCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [social, setSocial] = useState({ wa: [] });
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const waContacts =
    Array.isArray(social.wa) && social.wa.length > 0
      ? social.wa
      : [{ name: "Admin Utama", phone: "6281234567890" }];

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [prodRes, socialRes] = await Promise.all([
          request.get(API_ENDPOINTS.CATALOG.PRODUCT_DETAIL(id)),
          request.get(API_ENDPOINTS.CATALOG.SOCIAL),
        ]);

        if (socialRes.success) setSocial(socialRes.data);

        if (prodRes.success) {
          setProduct(prodRes.data);
          document.title = `${prodRes.data.name} | Sekar Gumilang Orchid`;
        } else {
          setError("Produk tidak ditemukan");
        }
      } catch (err) {
        setError(err.response?.status === 404 ? "Produk tidak ditemukan" : "Gagal memuat produk");
      } finally {
        setLoading(false);
      }
    }

    loadData();
    return () => {
      document.title = "Sekar Gumilang Orchid";
    };
  }, [id]);

  const handleShare = async () => {
    const url = getProductShareUrl(id);
    const title = product?.name || "Produk Katalog";
    const text = `Lihat ${title} di Katalog Sekar Gumilang Orchid`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }

    setShowShareMenu(true);
  };

  const copyShareLink = async () => {
    const url = getProductShareUrl(id);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link produk berhasil disalin");
      setShowShareMenu(false);
    } catch {
      toast.error("Gagal menyalin link");
    }
  };

  const handleWhatsAppOrder = (contact) => {
    if (!product) return;
    const pageUrl = getProductShareUrl(product.id);
    const text = `Halo *Sekar Gumilang Orchid*, saya tertarik dengan produk:\n\n*${product.name}*\nHarga: ${formatIDR(product.sell_price)}\nStok: ${product.stock > 0 ? "Tersedia" : "Habis"}\n\nApakah masih tersedia?\nLink: ${pageUrl}`;
    const phone = normalizeWaPhone(contact.phone);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-emerald-50/20 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-500">Memuat detail produk...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-emerald-50/20 flex flex-col items-center justify-center px-4">
        <Package className="w-14 h-14 text-slate-300 mb-4" />
        <h1 className="text-lg font-bold text-slate-700 mb-2">{error || "Produk tidak ditemukan"}</h1>
        <p className="text-sm text-slate-400 mb-6 text-center max-w-sm">
          Produk mungkin sudah tidak aktif atau link yang Anda buka tidak valid.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Katalog
        </Link>
      </div>
    );
  }

  const images = getProductImages(product);

  return (
    <div className="min-h-screen bg-emerald-50/20 text-slate-800 font-sans">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-emerald-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 text-sm font-bold text-emerald-800 hover:text-emerald-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Kembali ke Katalog</span>
            <span className="sm:hidden">Katalog</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-sm px-4 py-2 rounded-xl border border-emerald-200 transition-all"
          >
            <Share2 className="w-4 h-4" />
            Bagikan
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-6">
        <div className="bg-white rounded-3xl border border-emerald-100 shadow-soft overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Gallery */}
            <div className="p-4 md:p-6 bg-slate-50/50 border-b md:border-b-0 md:border-r border-slate-100">
              <ProductImageGallery
                images={images}
                resolveUrl={resolveCatalogImageUrl}
                alt={product.name}
              />
            </div>

            {/* Info */}
            <div className="p-6 md:p-8 flex flex-col">
              <div className="space-y-4 flex-grow">
                {(product.category_name || product.subcategory_name) && (
                  <div className="flex flex-wrap gap-2">
                    {product.category_name && (
                      <span className="inline-flex items-center gap-1 text-2xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                        <Tag className="w-3 h-3" />
                        {product.category_name}
                      </span>
                    )}
                    {product.subcategory_name && (
                      <span className="inline-flex items-center gap-1 text-2xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                        {product.subcategory_name}
                      </span>
                    )}
                  </div>
                )}

                <h1 className="text-xl md:text-2xl font-black text-slate-800 leading-tight">
                  {product.name}
                </h1>

                {product.sku && (
                  <p className="text-2xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                    SKU: {product.sku}
                  </p>
                )}

                <div className="flex gap-2">
                  {product.stock > 0 ? (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100/60 px-2.5 py-1 rounded-lg">
                      Tersedia: {product.stock} unit
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-lg">
                      Stok Habis
                    </span>
                  )}
                </div>

                <div className="bg-emerald-50/40 border border-emerald-100/30 p-4 rounded-2xl">
                  <span className="text-2xs text-emerald-800/60 font-semibold uppercase tracking-wider">
                    Harga
                  </span>
                  <div className="flex items-baseline gap-2.5 mt-0.5">
                    <span className="text-2xl font-black text-emerald-900">
                      {formatIDR(product.sell_price)}
                    </span>
                    {product.crossed_price && Number(product.crossed_price) > 0 && (
                      <span className="text-sm font-semibold text-slate-400 line-through">
                        {formatIDR(product.crossed_price)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Deskripsi
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                    {product.description || "Tidak ada deskripsi detail untuk produk ini."}
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                  className="w-full flex items-center justify-center gap-2.5 bg-emerald-50/60 border border-emerald-200/50 hover:bg-emerald-100/70 text-emerald-800 disabled:opacity-50 disabled:bg-slate-50 disabled:border-slate-150 disabled:text-slate-400 font-extrabold text-sm py-3.5 rounded-2xl transition-all cursor-pointer"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Tambah ke Keranjang
                </button>

                {!showContactPicker ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (waContacts.length === 1) {
                        handleWhatsAppOrder(waContacts[0]);
                      } else {
                        setShowContactPicker(true);
                      }
                    }}
                    disabled={product.stock <= 0}
                    className="w-full flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 active:scale-98 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-md shadow-emerald-600/15 transition-all cursor-pointer"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Pesan via WhatsApp
                  </button>
                ) : (
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-2xs font-extrabold text-slate-500 uppercase tracking-wider">
                        Pilih Kontak WhatsApp:
                      </span>
                      <button type="button" onClick={() => setShowContactPicker(false)}>
                        <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {waContacts.map((contact, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleWhatsAppOrder(contact)}
                          className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-150 hover:border-emerald-300 text-left rounded-xl transition-all cursor-pointer shadow-2xs group"
                        >
                          <Phone className="w-4 h-4 text-emerald-600 fill-emerald-50 group-hover:scale-105 transition-transform" />
                          <div className="leading-tight">
                            <div className="text-2xs font-extrabold text-slate-700">{contact.name}</div>
                            <div className="text-4xs text-slate-400">{contact.phone}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Share menu fallback */}
      {showShareMenu && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            className="absolute inset-0"
            onClick={() => setShowShareMenu(false)}
            aria-hidden="true"
          />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-slate-800">Bagikan Produk</h3>
              <button type="button" onClick={() => setShowShareMenu(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Salin link di bawah ini untuk membagikan produk ke teman atau pelanggan.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={getProductShareUrl(id)}
                className="flex-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 truncate"
              />
              <button
                type="button"
                onClick={copyShareLink}
                className="shrink-0 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
              >
                <Copy className="w-4 h-4" />
                Salin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
