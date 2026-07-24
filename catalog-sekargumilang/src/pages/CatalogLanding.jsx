import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, ShoppingBag, Phone, Instagram, Youtube, Facebook, ChevronLeft, ChevronRight, X, MessageCircle, ShoppingCart, Trash2, Flower2, Gift, Sprout, Leaf, Package, LayoutGrid, Tag, Layers, MapPin, Share2 } from "lucide-react";
import { request } from "../utils/request";
import { API_ENDPOINTS } from "../utils/endpoints";
import { formatIDR } from "../utils/format";
import { resolveCatalogImageUrl, getProductImages, normalizeWaPhone } from "../utils/catalogHelpers";
import { useCatalogCart } from "../hooks/useCatalogCart";
import toast from "react-hot-toast";

export default function CatalogLanding() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [social, setSocial] = useState({ ig: "", tiktok: "", fb: "", youtube: "", wa: [] });
  const [loading, setLoading] = useState(true);

  const waContacts = Array.isArray(social.wa) && social.wa.length > 0
    ? social.wa
    : [{ name: "Admin Utama", phone: "6281234567890" }];

  // Filtering states
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryIdParam = searchParams.get("category");
  const subcategoryIdParam = searchParams.get("subcategory");

  const selectedCategory = categories.find(c => String(c.id) === categoryIdParam) || null;
  const selectedSubcategory = selectedCategory?.subcategories?.find(s => String(s.id) === subcategoryIdParam) || null;

  // Helper: set category (always clears subcategory)
  const selectCategory = (cat) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (cat) {
        next.set("category", String(cat.id));
      } else {
        next.delete("category");
      }
      next.delete("subcategory");
      return next;
    });
    setPage(1);
  };

  // Helper: set subcategory only
  const selectSubcategory = (sub) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (sub) {
        next.set("subcategory", String(sub.id));
      } else {
        next.delete("subcategory");
      }
      return next;
    });
    setPage(1);
  };

  // Share current category/subcategory link
  const handleShareCategory = () => {
    const url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => toast.success("Link kategori berhasil disalin! 🔗"))
        .catch(() => toast.error("Gagal menyalin link"));
    } else {
      // Fallback for unsupported browsers
      const textarea = document.createElement("textarea");
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.success("Link kategori berhasil disalin! 🔗");
    }
  };
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Cart states
  const [cartOpen, setCartOpen] = useState(false);
  const [showCartContactPicker, setShowCartContactPicker] = useState(false);
  const { cart, cartCount, updateCartQuantity, removeFromCart, clearCart } = useCatalogCart();

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400); // Wait 400ms
    return () => clearTimeout(handler);
  }, [search]);

  // Prevent background scroll when cart is open
  useEffect(() => {
    if (cartOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.height = "100vh";
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.height = "100vh";
    } else {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
    };
  }, [cartOpen]);

  // Load categories and social settings
  useEffect(() => {
    async function initData() {
      try {
        const catRes = await request.get(API_ENDPOINTS.CATALOG.CATEGORIES);
        if (catRes.success) setCategories(catRes.data);

        const socialRes = await request.get(API_ENDPOINTS.CATALOG.SOCIAL);
        if (socialRes.success) setSocial(socialRes.data);
      } catch (err) {
        console.error("Gagal memuat kategori/sosmed:", err);
      }
    }
    initData();
  }, []);

  // Load products based on search & filters
  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      try {
        let url = `${API_ENDPOINTS.CATALOG.PRODUCTS}?page=${page}&limit=12`;
        if (debouncedSearch) url += `&q=${encodeURIComponent(debouncedSearch)}`;
        if (selectedSubcategory) {
          url += `&subcategory_id=${selectedSubcategory.id}`;
        } else if (selectedCategory) {
          url += `&category_id=${selectedCategory.id}`;
        }

        const res = await request.get(url);
        if (res.success) {
          setProducts(res.data);
          setTotalPages(res.pagination.totalPages);
        }
      } catch (err) {
        console.error("Gagal memuat produk:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [page, debouncedSearch, selectedCategory, selectedSubcategory]);

  const getCategoryIcon = (categoryName) => {
    const name = String(categoryName || "").toLowerCase();
    if (name.includes("anggrek") || name.includes("orchid") || name.includes("bunga") || name.includes("flower")) {
      return <Flower2 className="w-4 h-4" />;
    }
    if (name.includes("hampers") || name.includes("kado") || name.includes("gift") || name.includes("paket")) {
      return <Gift className="w-4 h-4" />;
    }
    if (name.includes("seed") || name.includes("benih") || name.includes("sprout") || name.includes("tunas") || name.includes("bibit") || name.includes("magang") || name.includes("pelatihan")) {
      return <Sprout className="w-4 h-4" />;
    }
    if (name.includes("media") || name.includes("pupuk") || name.includes("pot") || name.includes("tanam") || name.includes("tanaman")) {
      return <Layers className="w-4 h-4" />;
    }
    if (name.includes("alat") || name.includes("tool") || name.includes("sarana") || name.includes("bahan") || name.includes("plant")) {
      return <Package className="w-4 h-4" />;
    }
    return <Leaf className="w-4 h-4" />;
  };

  const getTiktokUrl = (handle) => {
    if (!handle) return "#";
    const clean = handle.replace("@", "");
    return `https://www.tiktok.com/@${clean}`;
  };

  const getIgUrl = (handle) => {
    if (!handle) return "#";
    const clean = handle.replace("@", "");
    return `https://www.instagram.com/${clean}`;
  };

  const handleCheckout = (contact) => {
    if (cart.length === 0) {
      toast.error("Keranjang belanja kosong");
      return;
    }

    let itemsText = "";
    let total = 0;

    cart.forEach((item, index) => {
      const subtotal = Number(item.product.sell_price) * item.quantity;
      total += subtotal;
      itemsText += `${index + 1}. *${item.product.name}* (${item.quantity}x) - ${formatIDR(item.product.sell_price)}\n`;
    });

    const text = `Halo *Sekar Gumilang Orchid*, saya ingin memesan produk berikut:\n\n${itemsText}\n*Total Pembayaran: ${formatIDR(total)}*\n\nMohon informasi ketersediaan dan total ongkir. Terima kasih.`;

    const phone = normalizeWaPhone(contact.phone);
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-emerald-50/20 text-slate-800 flex flex-col font-sans">
      {/* Top Header / Hero Section */}
      <header className="relative bg-emerald-950 text-white overflow-hidden py-16 px-4 md:px-8 shadow-xl">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#4ade80_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-emerald-800/20 blur-3xl"></div>
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-emerald-600/10 blur-3xl"></div>

        <div className="relative max-w-6xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-emerald-900/60 border border-emerald-500/30 px-4 py-2 rounded-full text-emerald-400 text-sm font-semibold tracking-wider uppercase">
            🌸 Sekar Gumilang Orchid
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-100 via-emerald-300 to-emerald-200">
            KATALOG ONLINE KEBUN ANGGREK SEKAR GUMILANG ORCHID
          </h1>
          <p className="text-sm md:text-lg font-medium text-emerald-200/90 max-w-3xl mx-auto border-y border-emerald-800/50 py-3">
            Hampers | Plant Only | Pelatihan | Magang | Ketenger Baturraden
          </p>
        </div>
      </header>

      {/* Main Catalog Workspace */}
      <main className="max-w-6xl w-full mx-auto px-4 md:px-8 py-10 flex-grow grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* Sidebar Filter - Desktop */}
        <aside className="space-y-6 lg:col-span-1 hidden lg:block">
          <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-soft">
            <h2 className="text-md font-bold text-emerald-900 mb-4 pb-2 border-b border-slate-100">Kategori</h2>

            <div className="space-y-2">
              <button
                onClick={() => selectCategory(null)}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl text-sm font-semibold transition-all ${!selectedCategory ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25" : "hover:bg-slate-50 text-slate-600 hover:text-emerald-700"
                  }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Semua Produk</span>
              </button>

              {categories.map((cat) => {
                const isSelected = selectedCategory?.id === cat.id;
                return (
                  <div key={cat.id} className="space-y-1">
                    <button
                      onClick={() => selectCategory(cat)}
                      className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl text-sm font-semibold transition-all ${isSelected ? "bg-emerald-100 text-emerald-800" : "hover:bg-slate-50 text-slate-600 hover:text-emerald-700"
                        }`}
                    >
                      {getCategoryIcon(cat.name)}
                      <span>{cat.name}</span>
                    </button>

                    {isSelected && cat.subcategories && cat.subcategories.length > 0 && (
                      <div className="pl-4 space-y-1 py-1 border-l-2 border-emerald-200/50 ml-3">
                        {cat.subcategories.map((sub) => {
                          const isSubSelected = selectedSubcategory?.id === sub.id;
                          return (
                            <button
                              key={sub.id}
                              onClick={() => selectSubcategory(sub)}
                              className={`w-full flex items-center gap-1.5 text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isSubSelected ? "bg-emerald-700 text-white shadow-sm" : "hover:bg-slate-50 text-slate-500 hover:text-emerald-800"
                                }`}
                            >
                              <Tag className="w-3 h-3 opacity-60" />
                              <span>{sub.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Catalog Main Content */}
        <section className="lg:col-span-3 space-y-6">

          {/* Top Search bar / Filter Mobile */}
          <div className="bg-white p-4 md:p-5 rounded-2xl border border-emerald-100 shadow-soft space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-3.5 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari anggrek impian Anda..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 hover:bg-slate-100/70 focus:bg-white rounded-xl text-sm font-medium border border-slate-100 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all outline-none"
              />
            </div>

            {/* Mobile Category Horizontal Scroll */}
            <div className="flex lg:hidden gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => selectCategory(null)}
                className={`whitespace-nowrap flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${!selectedCategory ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Semua</span>
              </button>
              {categories.map((cat) => {
                const isSelected = selectedCategory?.id === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => selectCategory(cat)}
                    className={`whitespace-nowrap flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isSelected ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-slate-100 text-slate-600"
                      }`}
                  >
                    {getCategoryIcon(cat.name)}
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Mobile Subcategory options if Category selected */}
            {selectedCategory && selectedCategory.subcategories && selectedCategory.subcategories.length > 0 && (
              <div className="flex lg:hidden gap-1.5 overflow-x-auto pb-1 ml-1 pl-2 border-l border-emerald-100">
                <button
                  onClick={() => selectSubcategory(null)}
                  className={`whitespace-nowrap flex items-center gap-1 px-3 py-1.5 rounded-lg text-2xs font-semibold transition-all ${!selectedSubcategory ? "bg-emerald-700 text-white" : "bg-slate-50 text-slate-500 border border-slate-100"
                    }`}
                >
                  <Tag className="w-2.5 h-2.5 opacity-60" />
                  <span>Semua {selectedCategory.name}</span>
                </button>
                {selectedCategory.subcategories.map((sub) => {
                  const isSubSelected = selectedSubcategory?.id === sub.id;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => selectSubcategory(sub)}
                      className={`whitespace-nowrap flex items-center gap-1 px-3 py-1.5 rounded-lg text-2xs font-semibold transition-all ${isSubSelected ? "bg-emerald-700 text-white" : "bg-slate-50 text-slate-500 border border-slate-100"
                        }`}
                    >
                      <Tag className="w-2.5 h-2.5 opacity-60" />
                      <span>{sub.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Filter tags (breadcrumb style) */}
            {(selectedCategory || selectedSubcategory || debouncedSearch) && (
              <div className="flex flex-wrap gap-2 items-center text-xs font-semibold text-slate-500 pt-2 border-t border-slate-50 w-full">
                <span>Filter aktif:</span>
                {debouncedSearch && (
                  <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full flex items-center gap-1">
                    Cari: "{debouncedSearch}"
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setSearch("")} />
                  </span>
                )}
                {selectedCategory && (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                    Kategori: {selectedCategory.name}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => selectCategory(null)} />
                  </span>
                )}
                {selectedSubcategory && (
                  <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full flex items-center gap-1">
                    Sub: {selectedSubcategory.name}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => selectSubcategory(null)} />
                  </span>
                )}

                {(selectedCategory || selectedSubcategory) && (
                  <button
                    onClick={handleShareCategory}
                    className="sm:ml-auto flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1 rounded-full text-2xs transition-all shadow-sm cursor-pointer"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>Bagikan Kategori</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Grid Products List */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {[...Array(6)].map((_, idx) => (
                <div key={idx} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 animate-pulse">
                  <div className="aspect-square bg-slate-200 rounded-xl w-full"></div>
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-emerald-100 shadow-soft">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-700 mb-1">Produk Tidak Ditemukan</h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">Kami tidak dapat menemukan produk yang sesuai dengan pencarian atau filter Anda saat ini.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {products.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => navigate(`/product/${prod.id}`)}
                    className="group bg-white rounded-2xl border border-emerald-100/50 shadow-sm hover:shadow-soft hover:border-emerald-200/80 cursor-pointer overflow-hidden transition-all duration-300 flex flex-col h-full"
                  >
                    {/* Image Area */}
                    <div className="relative aspect-square bg-slate-50 w-full overflow-hidden">
                      <img
                        src={resolveCatalogImageUrl(prod.image_path)}
                        alt={prod.name}
                        loading="lazy"
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                      />

                      {/* Count of multiple images badge */}
                      {(() => {
                        const uniqueImgs = getProductImages(prod);
                        return uniqueImgs.length > 1 && (
                          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-lg text-white text-3xs font-semibold">
                            1/{uniqueImgs.length}
                          </div>
                        );
                      })()}

                      {/* Out of Stock Label */}
                      {prod.stock <= 0 && (
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center text-white text-xs font-bold uppercase tracking-wider">
                          Habis
                        </div>
                      )}
                    </div>

                    {/* Body Area */}
                    <div className="p-4 flex flex-col flex-grow justify-between">
                      <div className="space-y-1">
                        <h3 className="text-xs md:text-sm font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-emerald-700 transition-colors">
                          {prod.name}
                        </h3>
                        {prod.description && (
                          <p className="text-2xs text-slate-400 line-clamp-1 leading-relaxed">
                            {prod.description}
                          </p>
                        )}
                      </div>

                      {/* Price Section */}
                      <div className="mt-3 space-y-1">
                        <div className="flex flex-wrap items-baseline gap-1.5">
                          <span className="text-xs md:text-md font-extrabold text-emerald-800">
                            {formatIDR(prod.sell_price)}
                          </span>
                          {prod.crossed_price && Number(prod.crossed_price) > 0 && (
                            <span className="text-3xs md:text-2xs text-slate-400 line-through">
                              {formatIDR(prod.crossed_price)}
                            </span>
                          )}
                        </div>

                        {/* Stock availability banner */}
                        {prod.stock > 0 ? (
                          <div className="text-4xs font-bold text-emerald-600 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Stok: {prod.stock}
                          </div>
                        ) : (
                          <div className="text-4xs font-bold text-rose-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Habis
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-6">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="p-2 border border-slate-100 bg-white hover:bg-slate-50 disabled:opacity-50 rounded-xl transition-all"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <span className="text-xs font-bold text-slate-600 px-3">
                    Hal {page} dari {totalPages}
                  </span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="p-2 border border-slate-100 bg-white hover:bg-slate-50 disabled:opacity-50 rounded-xl transition-all"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              )}
            </>
          )}

        </section>
      </main>

      {/* Location Section */}
      <section className="max-w-6xl w-full mx-auto px-4 md:px-8 py-4 mt-4">
        <div className="bg-white rounded-3xl border border-emerald-100 shadow-soft p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
            <div className="space-y-1">
              <h2 className="text-md md:text-lg font-bold text-emerald-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Lokasi Kebun Kami</span>
              </h2>
              <p className="text-slate-500 text-xs md:text-sm">
                Dusun II Ketenger, Ketenger, Kec. Baturraden, Kabupaten Banyumas, Jawa Tengah 53151
              </p>
            </div>
            <a
              href="https://maps.app.goo.gl/D96o4qMYUdoNLCeNA"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs md:text-sm px-5 py-3 rounded-xl shadow-md shadow-emerald-600/15 transition-all cursor-pointer whitespace-nowrap"
            >
              Buka di Google Maps
            </a>
          </div>

          <div className="w-full h-80 md:h-[400px] rounded-2xl overflow-hidden border border-emerald-100/50 shadow-inner">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3956.822238421867!2d109.2197779!3d-7.3737382!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e6ff5107803e775%3A0xfb44e41c2a893f85!2sKebun%20Anggrek%20Sekar%20Gumilang!5e0!3m2!1sid!2sid!4v1717770000000"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Peta Lokasi Sekar Gumilang Orchid"
              className="w-full h-full grayscale-[15%] contrast-[110%] hover:grayscale-0 transition-all duration-500"
            ></iframe>
          </div>
        </div>
      </section>

      {/* Store Footer */}
      <footer className="bg-emerald-950 text-emerald-200 py-12 px-6 mt-16 border-t border-emerald-900">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">

          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-white font-bold text-lg">Kebun Anggrek Sekar Gumilang</h3>
            <p className="text-xs text-emerald-300 max-w-sm">
              Menyediakan berbagai macam hampers, plant only, pelatihan budidaya, serta program magang. Berlokasi di Ketenger, Baturraden.
            </p>
          </div>

          {/* Social Links */}
          <div className="flex flex-col items-center md:items-end gap-3">
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Ikuti Media Sosial Kami</span>
            <div className="flex items-center gap-3">
              {social.ig && (
                <a
                  href={getIgUrl(social.ig)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 bg-emerald-900/40 hover:bg-emerald-800 text-white rounded-xl transition-all"
                  title="Instagram"
                >
                  <Instagram className="w-5 h-5" />
                </a>
              )}
              {social.tiktok && (
                <a
                  href={getTiktokUrl(social.tiktok)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 bg-emerald-900/40 hover:bg-emerald-800 text-white rounded-xl transition-all flex items-center justify-center w-10 h-10"
                  title="Tiktok"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.63 4.19 1.11 1.25 2.65 2.03 4.26 2.24v3.83c-1.66-.08-3.29-.69-4.63-1.7a8.682 8.682 0 0 1-1.21-1.15v6.52c.04 2.19-.64 4.4-2.02 6.07-1.52 1.9-3.92 3.03-6.33 2.99-2.5-.03-4.94-1.34-6.22-3.52-1.38-2.29-1.55-5.26-.41-7.69 1.05-2.28 3.29-3.92 5.78-4.17.02 1.29-.01 2.58-.02 3.87-1.12.11-2.22.68-2.85 1.62-.72 1.01-.81 2.39-.28 3.49.52.99 1.53 1.68 2.65 1.76 1.48.16 2.97-.84 3.28-2.3.08-.41.07-.84.07-1.26V0l.02.02Z" />
                  </svg>
                </a>
              )}
              {social.fb && (
                <a
                  href={`https://www.facebook.com/${encodeURIComponent(social.fb)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 bg-emerald-900/40 hover:bg-emerald-800 text-white rounded-xl transition-all"
                  title="Facebook"
                >
                  <Facebook className="w-5 h-5" />
                </a>
              )}
              {social.youtube && (
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(social.youtube)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 bg-emerald-900/40 hover:bg-emerald-800 text-white rounded-xl transition-all"
                  title="Youtube"
                >
                  <Youtube className="w-5 h-5" />
                </a>
              )}
            </div>

            {/* WhatsApp Admin List in Footer */}
            {waContacts.length > 0 && (
              <div className="flex flex-col items-center md:items-end gap-1.5 mt-3 pt-3 border-t border-emerald-900/40 w-full">
                <span className="text-3xs font-extrabold text-emerald-400 uppercase tracking-wider">Kontak WA Admin:</span>
                <div className="flex flex-wrap gap-2 justify-center md:justify-end">
                  {waContacts.map((contact, idx) => {
                    let phone = String(contact.phone).replace(/\D/g, "");
                    if (phone.startsWith("0")) phone = "62" + phone.slice(1);
                    return (
                      <a
                        key={idx}
                        href={`https://wa.me/${phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-800/80 text-emerald-100 hover:text-white text-3xs font-bold rounded-lg transition-all border border-emerald-800/40"
                      >
                        <MessageCircle className="w-3 h-3 text-emerald-400" />
                        <span>{contact.name}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>

        <div className="max-w-6xl mx-auto border-t border-emerald-900/60 mt-8 pt-6 text-center text-3xs text-emerald-400">
          © {new Date().getFullYear()} Sekar Gumilang Orchid. All Rights Reserved.
        </div>
      </footer>

      {/* Floating Shopping Cart Trigger Button */}
      <button
        onClick={() => {
          setCartOpen(true);
          setShowCartContactPicker(false);
        }}
        className="fixed bottom-6 right-6 z-40 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
      >
        <ShoppingCart className="w-6 h-6" />
        {cartCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-3xs font-extrabold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
            {cartCount}
          </span>
        )}
      </button>

      {/* Cart Sidebar Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={() => setCartOpen(false)}></div>

          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-250">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-emerald-950 text-white">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                <h3 className="text-md font-extrabold uppercase tracking-wider">Keranjang Belanja</h3>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="p-1.5 hover:bg-emerald-900 rounded-full transition-all text-emerald-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-grow overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-20 text-slate-400 space-y-3">
                  <ShoppingBag className="w-12 h-12 mx-auto text-slate-200" />
                  <p className="text-sm font-semibold">Keranjang Anda masih kosong</p>
                  <button
                    onClick={() => setCartOpen(false)}
                    className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                  >
                    Mulai Belanja 🌸
                  </button>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="flex gap-4 p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                    {/* Item Image */}
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-slate-100 flex-shrink-0">
                      <img
                        src={resolveCatalogImageUrl(item.product.image_path)}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Item Info */}
                    <div className="flex-grow flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-1 leading-snug">
                          {item.product.name}
                        </h4>
                        <span className="text-2xs font-extrabold text-emerald-800">
                          {formatIDR(item.product.sell_price)}
                        </span>
                      </div>

                      {/* Quantity Selector */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              updateCartQuantity(item.product.id, item.quantity - 1);
                            }}
                            className="px-2 py-1 text-xs font-bold hover:bg-slate-50 text-slate-500 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="px-3 py-1 text-2xs font-bold text-slate-700 bg-slate-50/50">
                            {item.quantity}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              updateCartQuantity(item.product.id, item.quantity + 1);
                            }}
                            className="px-2 py-1 text-xs font-bold hover:bg-slate-50 text-slate-500 cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            removeFromCart(item.product.id);
                          }}
                          className="text-3xs font-extrabold text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && (
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-4">
                <div className="flex justify-between items-center text-sm font-bold text-slate-700">
                  <span>Total ({cart.reduce((sum, i) => sum + i.quantity, 0)} Barang):</span>
                  <span className="text-emerald-800 font-extrabold text-md">
                    {formatIDR(
                      cart.reduce((sum, item) => sum + item.product.sell_price * item.quantity, 0)
                    )}
                  </span>
                </div>

                {!showCartContactPicker ? (
                  <button
                    onClick={() => {
                      if (waContacts.length === 1) {
                        handleCheckout(waContacts[0]);
                      } else {
                        setShowCartContactPicker(true);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-3.5 rounded-xl shadow-lg shadow-emerald-600/10 transition-all cursor-pointer"
                  >
                    <MessageCircle className="w-4.5 h-4.5" />
                    Pesan Semua via WhatsApp
                  </button>
                ) : (
                  <div className="bg-white border border-emerald-100 rounded-xl p-4 space-y-3 animate-in slide-in-from-bottom duration-150 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-2xs font-bold text-slate-600">Pilih Admin WhatsApp:</span>
                      <X className="w-4 h-4 text-slate-450 hover:text-slate-655 cursor-pointer" onClick={() => setShowCartContactPicker(false)} />
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {waContacts.map((contact, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            handleCheckout(contact);
                            setShowCartContactPicker(false);
                          }}
                          className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-150 hover:border-emerald-355 text-left rounded-xl transition-all cursor-pointer shadow-2xs group"
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

                <button
                  onClick={clearCart}
                  className="w-full text-center text-3xs font-extrabold text-slate-400 hover:text-slate-650 transition-colors py-1 cursor-pointer"
                >
                  Kosongkan Keranjang Belanja
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
