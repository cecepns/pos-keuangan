import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Search,
  Trash2,
  Save,
  Pause,
  Printer,
  MessageCircle,
  ScanBarcode,
  Plus,
  Minus,
  Tags,
} from "lucide-react";
import JsBarcode from "jsbarcode";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PAGE_SIZE } from "../constants/pagination";
import { formatIDR, formatThousandsIdInput } from "../utils/format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Modal } from "../components/Modal";
import { PageStack } from "../components/TableCard";
import { buildThermalReceiptHtml, buildReceiptWhatsAppText, normalizeWhatsAppPhone } from "../utils/receipt";
import { parseOptionalFloat, parseOptionalInt } from "../utils/numericInput";
import { uploadSrc } from "../utils/uploadUrl";

const PRODUCT_PAGE_SIZE = 48;
const POS_DRAFT_KEY = "pos-keuangan-draft-v1";

export default function PosPage() {
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 300);
  const [customerSearch, setCustomerSearch] = useState("");
  const custQ = useDebouncedValue(customerSearch, 350);
  const [products, setProducts] = useState([]);
  const [productPage, setProductPage] = useState(1);
  const [productTotal, setProductTotal] = useState(0);
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [discountTotal, setDiscountTotal] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [notes, setNotes] = useState("");
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receiptCfg, setReceiptCfg] = useState({
    store_name: "",
    store_address: "",
    store_phone: "",
    receipt_footer: "",
    thermal_width_mm: "80",
  });
  const [payOpen, setPayOpen] = useState(false);
  const [cashAmtStr, setCashAmtStr] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [transferAmtStr, setTransferAmtStr] = useState("");
  const [transferAcc, setTransferAcc] = useState("");
  const [qrisAmtStr, setQrisAmtStr] = useState("");
  const [qrisAcc, setQrisAcc] = useState("");
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [barcodeProdId, setBarcodeProdId] = useState("");
  /** String agar bisa dikosongkan saat diketik */
  const [barcodeCopies, setBarcodeCopies] = useState("1");
  /** { [product_id]: { qty?, sell?, disc? } } */
  const [lineDraft, setLineDraft] = useState({});
  const [discountDraft, setDiscountDraft] = useState(null);
  const [taxDraft, setTaxDraft] = useState(null);
  const barcodeRef = useRef(null);
  const payModalOpenedRef = useRef(false);
  const draftResumeIdRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [receiptWaPhone, setReceiptWaPhone] = useState("");

  const fetchProductPage = useCallback(
    async (pageNum, append) => {
      const { data } = await api.get("/api/products", {
        params: { q: dq, limit: PRODUCT_PAGE_SIZE, page: pageNum, active: 1 },
      });
      const rows = data.data || [];
      const tot = Number(data.total ?? rows.length);
      setProductTotal(tot);
      if (append) setProducts((prev) => [...prev, ...rows]);
      else setProducts(rows);
    },
    [dq]
  );

  useEffect(() => {
    setProductPage(1);
    fetchProductPage(1, false).catch(() => {});
  }, [dq, fetchProductPage]);

  function loadMoreProducts() {
    const next = productPage + 1;
    const maxPage = Math.max(1, Math.ceil(productTotal / PRODUCT_PAGE_SIZE));
    if (next > maxPage) return;
    setProductPage(next);
    fetchProductPage(next, true).catch(() => {});
  }

  useEffect(() => {
    api
      .get("/api/settings")
      .then(({ data }) => {
        setReceiptCfg({
          store_name: data.store_name || "Toko",
          store_address: data.store_address || "",
          store_phone: data.store_phone || "",
          receipt_footer: data.receipt_footer || data.whatsapp_sender_note || "",
          thermal_width_mm: String(data.thermal_width_mm || "80"),
        });
        const tx = Number(data.tax_default || 0);
        if (!Number.isNaN(tx)) setTaxPercent(tx);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const ca = await fetchAllPages("/api/cash-accounts").catch(() => []);
        setCashAccounts(ca);
        if (ca.length) setCashAccountId(String(ca[0].id));
      } catch {
        /* */
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/api/customers", {
          params: { q: custQ, page: 1, limit: PAGE_SIZE },
        });
        setCustomers(data.data || []);
      } catch {
        setCustomers([]);
      }
    })();
  }, [custQ]);

  useEffect(() => {
    if (!customerId) return;
    const c = customers.find((x) => String(x.id) === String(customerId));
    if (c?.whatsapp) setReceiptWaPhone(String(c.whatsapp).replace(/\D/g, ""));
  }, [customerId, customers]);

  function addToCart(p) {
    const avail = availableOnGrid(p);
    if (avail <= 0) {
      toast.error("Stok tidak tersedia untuk keranjang");
      return;
    }
    const st = Number(p.stock);
    const ex = cart.find((c) => c.product_id === p.id);
    if (ex) {
      const cap = Math.max(
        0,
        liveStock(p.id, ex.stock) - ((reservedByProduct[p.id] || 0) - ex.qty)
      );
      if (ex.qty + 1 > cap) {
        toast.error("Stok tidak cukup");
        return;
      }
      setCart(cart.map((c) => (c.product_id === p.id ? { ...c, qty: c.qty + 1 } : c)));
    } else {
      setCart([
        ...cart,
        {
          product_id: p.id,
          name: p.name,
          barcode: p.barcode,
          stock: st,
          purchase_price: Number(p.purchase_price),
          sell_price: Number(p.sell_price),
          qty: 1,
          discount_amount: 0,
        },
      ]);
    }
    toast.success(`${p.name} ditambahkan`);
  }

  function updateLine(id, patch) {
    setCart(
      cart.map((c) => {
        if (c.product_id !== id) return c;
        let next = { ...c, ...patch };
        if (patch.qty != null) {
          const cap = lineQtyCap(c);
          let n = typeof patch.qty === "number" ? patch.qty : Number(patch.qty);
          if (!Number.isFinite(n)) n = c.qty;
          const mq = Math.max(1, Math.min(Math.trunc(n), cap));
          next.qty = mq;
        }
        if (patch.discount_amount != null) {
          const gross = next.sell_price * next.qty;
          next.discount_amount = Math.min(Math.max(0, Number(patch.discount_amount)), gross);
        }
        return next;
      })
    );
  }

  function removeLine(id) {
    setLineDraft((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });
    setCart(cart.filter((c) => c.product_id !== id));
  }

  function lineQtyCap(c) {
    const srv = liveStock(c.product_id, c.stock);
    const otherRes = (reservedByProduct[c.product_id] || 0) - c.qty;
    return Math.max(1, Math.max(0, srv - otherRes));
  }

  const subtotal = useMemo(
    () => cart.reduce((s, c) => s + c.sell_price * c.qty - (c.discount_amount || 0), 0),
    [cart]
  );
  const taxAmount = useMemo(() => (subtotal - discountTotal) * (taxPercent / 100), [subtotal, discountTotal, taxPercent]);
  const grandTotal = useMemo(() => subtotal - discountTotal + taxAmount, [subtotal, discountTotal, taxAmount]);

  useEffect(() => {
    if (payOpen && !payModalOpenedRef.current) {
      payModalOpenedRef.current = true;
      setCashAmtStr("");
      setTransferAmtStr("");
      setQrisAmtStr("");
    }
    if (!payOpen) payModalOpenedRef.current = false;
  }, [payOpen]);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("resume")) return;
      const raw = localStorage.getItem(POS_DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.v !== 1 || !Array.isArray(d.cart)) return;
      if (d.cart.length) setCart(d.cart);
      if (d.customerId != null) setCustomerId(String(d.customerId));
      if (typeof d.discountTotal === "number") setDiscountTotal(d.discountTotal);
      if (typeof d.taxPercent === "number") setTaxPercent(d.taxPercent);
      if (typeof d.notes === "string") setNotes(d.notes);
      if (typeof d.saleDate === "string") setSaleDate(d.saleDate);
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        POS_DRAFT_KEY,
        JSON.stringify({
          v: 1,
          cart,
          customerId,
          discountTotal,
          taxPercent,
          notes,
          saleDate,
        })
      );
    } catch {
      /* */
    }
  }, [cart, customerId, discountTotal, taxPercent, notes, saleDate]);

  const resumeId = searchParams.get("resume");
  useEffect(() => {
    if (!resumeId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/api/transactions/${resumeId}`, { skipToast: true });
        if (cancelled || !data || !["draft", "hold"].includes(String(data.status))) {
          setSearchParams({}, { replace: true });
          return;
        }
        const lines = await Promise.all(
          (data.items || []).map(async (it) => {
            try {
              const { data: pr } = await api.get(`/api/products/${it.product_id}`, { skipToast: true });
              return {
                product_id: it.product_id,
                name: it.product_name,
                barcode: it.barcode || pr.barcode,
                stock: Number(pr.stock),
                purchase_price: Number(it.purchase_price ?? pr.purchase_price),
                sell_price: Number(it.sell_price),
                qty: Number(it.qty),
                discount_amount: Number(it.discount_amount || 0),
              };
            } catch {
              return {
                product_id: it.product_id,
                name: it.product_name,
                barcode: it.barcode,
                stock: Math.max(Number(it.qty), 1),
                purchase_price: Number(it.purchase_price),
                sell_price: Number(it.sell_price),
                qty: Number(it.qty),
                discount_amount: Number(it.discount_amount || 0),
              };
            }
          })
        );
        if (cancelled) return;
        setCart(lines);
        draftResumeIdRef.current = Number(resumeId);
        if (data.customer_id) setCustomerId(String(data.customer_id));
        setNotes(data.notes || "");
        setDiscountTotal(Number(data.discount_total || 0));
        setTaxPercent(Number(data.tax_percent || 0));
        if (data.sale_date) setSaleDate(String(data.sale_date).slice(0, 10));
        setSearchParams({}, { replace: true });
        toast.success("Draft/hold dimuat — silakan bayar");
        queueMicrotask(() => setPayOpen(true));
      } catch {
        setSearchParams({}, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resumeId, setSearchParams]);

  const marginTotal = useMemo(
    () =>
      cart.reduce((s, c) => {
        const line = c.sell_price * c.qty - (c.discount_amount || 0);
        const cost = c.purchase_price * c.qty;
        return s + (line - cost);
      }, 0),
    [cart]
  );

  const reservedByProduct = useMemo(() => {
    const m = {};
    for (const c of cart) {
      m[c.product_id] = (m[c.product_id] || 0) + c.qty;
    }
    return m;
  }, [cart]);

  function liveStock(pid, fallbackStock) {
    const pr = products.find((x) => x.id === pid);
    return pr != null ? Number(pr.stock) : Number(fallbackStock);
  }

  function availableOnGrid(p) {
    const st = Number(p.stock);
    const res = reservedByProduct[p.id] || 0;
    return Math.max(0, st - res);
  }

  const cashAmt = Number(String(cashAmtStr).replace(/\D/g, "")) || 0;
  const transferAmt = Number(String(transferAmtStr).replace(/\D/g, "")) || 0;
  const qrisAmt = Number(String(qrisAmtStr).replace(/\D/g, "")) || 0;
  const nonDebtPaid = cashAmt + transferAmt + qrisAmt;
  const hutangGap = Math.max(0, Math.round((grandTotal - nonDebtPaid) * 100) / 100);
  const paidSumDraft = nonDebtPaid + hutangGap;
  const kembalianDraft = Math.max(0, paidSumDraft - grandTotal);

  function buildPayments() {
    const pays = [];
    if (cashAmt > 0 && cashAccountId)
      pays.push({ method: "cash", amount: cashAmt, cash_account_id: Number(cashAccountId) });
    if (transferAmt > 0 && transferAcc) pays.push({ method: "transfer", amount: transferAmt, cash_account_id: Number(transferAcc) });
    if (qrisAmt > 0 && qrisAcc) pays.push({ method: "qris", amount: qrisAmt, cash_account_id: Number(qrisAcc) });
    if (hutangGap > 0.02) pays.push({ method: "hutang", amount: hutangGap });
    return pays;
  }

  function receiptPaymentsFromDraft() {
    const p = [];
    if (cashAmt > 0) p.push({ method: "cash", amount: cashAmt });
    if (transferAmt > 0) p.push({ method: "transfer", amount: transferAmt });
    if (qrisAmt > 0) p.push({ method: "qris", amount: qrisAmt });
    if (hutangGap > 0.02) p.push({ method: "piutang", amount: hutangGap });
    return p;
  }

  async function submitSale(status = "completed") {
    const pays = status === "completed" ? buildPayments() : [];
    if (status === "completed") {
      if (cashAmt > 0 && !cashAccountId) {
        toast.error("Pilih akun kas untuk pembayaran tunai");
        return;
      }
      if (transferAmt > 0 && !transferAcc) {
        toast.error("Pilih rekening untuk transfer");
        return;
      }
      if (qrisAmt > 0 && !qrisAcc) {
        toast.error("Pilih akun untuk QRIS");
        return;
      }
      const sum = pays.reduce((s, x) => s + Number(x.amount || 0), 0);
      if (grandTotal > 0.01 && sum + 0.02 < grandTotal) {
        toast.error("Total pembayaran kurang dari grand total");
        return;
      }
      if (hutangGap > 0.02 && !customerId) {
        toast.error("Pilih pelanggan agar sisa (grand total − tunai/transfer/QRIS) bisa dicatat sebagai piutang");
        return;
      }
    }
    const payload = {
      customer_id: customerId ? Number(customerId) : null,
      discount_total: discountTotal,
      tax_percent: taxPercent,
      notes,
      sale_date: saleDate,
      status,
      items: cart.map((c) => ({
        product_id: c.product_id,
        qty: c.qty,
        sell_price: c.sell_price,
        discount_amount: c.discount_amount || 0,
      })),
      payments: pays,
    };
    const t = toast.loading(status === "completed" ? "Menyimpan..." : "Menyimpan draft...");
    try {
      const { data } = await api.post("/api/transactions", payload);
      const baseMsg = data.invoice_no || "Tersimpan";
      const hasReceivable = status === "completed" && hutangGap > 0.02;
      toast.success(hasReceivable ? `${baseMsg} · belum lunas (ada piutang)` : baseMsg, { id: t });
      if (draftResumeIdRef.current) {
        const rid = draftResumeIdRef.current;
        draftResumeIdRef.current = null;
        api.delete(`/api/transactions/${rid}`, { skipToast: true }).catch(() => {});
      }
      try {
        localStorage.removeItem(POS_DRAFT_KEY);
      } catch {
        /* */
      }
      setCart([]);
      setLineDraft({});
      setDiscountTotal(0);
      setNotes("");
      setPayOpen(false);
      setTransferAmtStr("");
      setQrisAmtStr("");
      setCashAmtStr("");
      fetchProductPage(1, false).catch(() => {});
      setProductPage(1);
      if (status === "draft" || status === "hold") {
        setCustomerId("");
        setSaleDate(new Date().toISOString().slice(0, 10));
      }
    } catch {
      toast.dismiss(t);
    }
  }

  function openPrintReceipt() {
    const pays = receiptPaymentsFromDraft();
    const paidSum = pays.reduce((s, p) => s + p.amount, 0);
    const changeAmt = Math.max(0, paidSum - grandTotal);
    const w = window.open("", "_blank", "width=380,height=720");
    if (!w) return toast.error("Popup diblokir");
    const html = buildThermalReceiptHtml({
      storeName: receiptCfg.store_name,
      storeAddress: receiptCfg.store_address,
      storePhone: receiptCfg.store_phone,
      footer: receiptCfg.receipt_footer,
      widthMm: Number(receiptCfg.thermal_width_mm) || 80,
      invoiceNo: "Preview keranjang",
      dateStr: saleDate || new Date().toLocaleDateString("id-ID"),
      lines: cart,
      subtotal,
      discountTotal,
      taxPercent,
      taxAmount,
      grandTotal,
      paidSum,
      changeAmount: changeAmt,
      payments: pays,
    });
    w.document.write(html);
    w.document.close();
  }

  function waNotaToNumber(phoneDigits) {
    const wa = normalizeWhatsAppPhone(phoneDigits);
    if (!wa) {
      toast.error("Isi nomor WhatsApp tujuan");
      return;
    }
    const pays = receiptPaymentsFromDraft();
    const paidSum = pays.reduce((s, p) => s + p.amount, 0);
    const changeAmt = Math.max(0, paidSum - grandTotal);
    const text = encodeURIComponent(
      buildReceiptWhatsAppText({
        storeName: receiptCfg.store_name,
        invoiceNo: "Keranjang",
        dateStr: saleDate,
        lines: cart,
        subtotal,
        discountTotal,
        taxPercent,
        taxAmount,
        grandTotal,
        payments: pays,
        changeAmount: changeAmt,
      })
    );
    window.open(`https://wa.me/${wa}?text=${text}`, "_blank");
  }

  async function handleBarcode(e) {
    if (e.key !== "Enter") return;
    const code = e.target.value.trim();
    if (!code) return;
    let found = products.find((p) => p.barcode === code);
    if (!found) {
      try {
        const { data } = await api.get("/api/products", { params: { q: code, limit: PAGE_SIZE, active: 1 } });
        found = (data.data || []).find((p) => p.barcode === code) || data.data?.[0];
      } catch {
        /* */
      }
    }
    if (found) addToCart(found);
    else toast.error("Produk tidak ditemukan");
    e.target.value = "";
  }

  function printBarcodeLabels() {
    const p = products.find((x) => String(x.id) === String(barcodeProdId));
    if (!p) return toast.error("Pilih produk");
    const code = p.barcode || p.sku;
    if (!code) return toast.error("Produk tanpa barcode/SKU");
    const n = Math.min(50, Math.max(1, parseOptionalInt(barcodeCopies, 1, { min: 1, max: 50 })));
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return toast.error("Popup diblokir");
    const labels = [];
    for (let i = 0; i < n; i++) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      JsBarcode(svg, String(code), {
        format: "CODE128",
        width: 2.4,
        height: 72,
        displayValue: true,
        fontSize: 14,
        textMargin: 4,
        margin: 12,
      });
      const bottom = String(p.barcode || p.sku || code).replace(/</g, "&lt;");
      labels.push(
        `<div class="lb" style="page-break-after:always;text-align:center;padding:8px;font-family:sans-serif;font-size:11px;display:flex;flex-direction:column;align-items:center;gap:2px;">
          <div style="font-weight:600;line-height:1.15;margin:0;max-width:100%;">${String(p.name).replace(/</g, "&lt;")}</div>
          <div style="line-height:0">${svg.outerHTML}</div>
          <div style="margin:0;font-family:monospace;font-size:10px;line-height:1.15;">${bottom}</div>
        </div>`
      );
    }
    w.document.write(
      `<!DOCTYPE html><html><head><title>Barcode</title><style>body{margin:0} @media print{.lb{page-break-after:always}}</style></head><body>${labels.join("")}<script>window.onload=function(){window.print();}<\/script></body></html>`
    );
    w.document.close();
  }

  const hasMoreProducts = products.length < productTotal;
  const maxProductPage = Math.max(1, Math.ceil(productTotal / PRODUCT_PAGE_SIZE));

  return (
    <PageStack>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Point of Sale</h1>
          <p className="text-sm text-slate-500">Stok tersisa ikut keranjang · bayar boleh lebih (kembalian)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setBarcodeOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-700"
          >
            <Tags className="h-4 w-4" /> Cetak barcode
          </button>
          <button
            type="button"
            onClick={() => submitSale("draft")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-700"
          >
            <Save className="h-4 w-4" /> Draft
          </button>
          <button
            type="button"
            onClick={() => submitSale("hold")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-700"
          >
            <Pause className="h-4 w-4" /> Hold
          </button>
          <button
            type="button"
            onClick={openPrintReceipt}
            disabled={!cart.length}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            <Printer className="h-4 w-4" /> Struk
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-3 xl:col-span-2">
          <div className="sticky top-0 z-10 space-y-3 rounded-b-2xl bg-slate-50/95 pb-2 pt-1 backdrop-blur dark:bg-slate-950/95">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 dark:border-slate-700 dark:bg-slate-900"
              placeholder="Cari nama, SKU, barcode..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
            <ScanBarcode className="h-5 w-5 shrink-0 text-brand-600" />
            <input
              ref={barcodeRef}
              className="min-w-0 flex-1 bg-transparent outline-none"
              placeholder="Scan barcode (Enter)"
              onKeyDown={handleBarcode}
            />
          </div>
          </div>
          <div className="max-h-[min(420px,50vh)] overflow-y-auto rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="grid gap-2 p-2 sm:grid-cols-2">
              {products.map((p) => {
                const left = availableOnGrid(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={left <= 0}
                    onClick={() => addToCart(p)}
                    className="flex w-full gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-soft transition hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="min-w-0 flex-1 flex flex-col">
                      <span className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">{p.name}</span>
                      <span className="text-xs text-slate-500">{p.sku}</span>
                      <span className="mt-1 text-brand-700 dark:text-brand-300">{formatIDR(p.sell_price)}</span>
                      <span className={`text-xs ${left <= 0 ? "text-red-500" : "text-slate-400"}`}>
                        Tersisa: {left}
                        {(reservedByProduct[p.id] || 0) > 0 ? (
                          <span className="text-slate-500"> / gudang {p.stock}</span>
                        ) : null}
                      </span>
                    </div>
                    {p.image_path ? (
                      <img
                        src={uploadSrc(p.image_path)}
                        alt=""
                        className="h-20 w-20 shrink-0 self-start rounded-xl border border-slate-200 object-cover dark:border-slate-600"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          {hasMoreProducts && (
            <button
              type="button"
              onClick={loadMoreProducts}
              className="w-full rounded-xl border border-dashed border-slate-300 py-2 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-400"
            >
              Muat lagi produk ({products.length}/{productTotal}
              {maxProductPage > 1 ? ` · hal ${productPage}/${maxProductPage}` : ""})
            </button>
          )}
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Keranjang</h2>
          <div className="mb-3 space-y-2">
            <label className="text-xs text-slate-500">Tanggal penjualan</label>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
            />
          </div>
          <div className="mb-3 space-y-2">
            <label className="text-xs text-slate-500">Pelanggan</label>
            <input
              type="search"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder="Nama / WhatsApp..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className={`rounded-lg px-2 py-1 text-xs ${!customerId ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}
                onClick={() => setCustomerId("")}
              >
                Umum
              </button>
              {customers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`rounded-lg px-2 py-1 text-xs ${String(customerId) === String(c.id) ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}
                  onClick={() => setCustomerId(String(c.id))}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[min(480px,58vh)] space-y-3 overflow-auto">
            {cart.length === 0 && <p className="text-sm text-slate-500">Belum ada item</p>}
            {cart.map((c) => {
              const gross = c.sell_price * c.qty;
              const disc = Number(c.discount_amount || 0);
              const net = gross - disc;
              const ld = lineDraft[c.product_id] || {};
              const qtyShow = ld.qty !== undefined ? ld.qty : String(c.qty);
              const sellShow = ld.sell !== undefined ? ld.sell : String(c.sell_price);
              const discShow = ld.disc !== undefined ? ld.disc : String(Number(c.discount_amount || 0));
              const capQty = lineQtyCap(c);
              return (
                <div key={c.product_id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                  <div className="flex justify-between gap-2">
                    <span className="text-base font-semibold leading-snug text-slate-900 dark:text-white">{c.name}</span>
                    <button type="button" onClick={() => removeLine(c.product_id)} className="text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {disc > 0 ? (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      <span className="line-through">{formatIDR(gross)}</span>{" "}
                      <span className="text-base font-bold text-brand-700 dark:text-brand-300">{formatIDR(net)}</span>{" "}
                      <span className="text-xs">(diskon {formatIDR(disc)})</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">Subtotal baris {formatIDR(net)}</p>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <label className="font-medium text-slate-700 dark:text-slate-300">
                      Qty (maks{" "}
                      {capQty})
                      <div className="mt-1 flex items-center gap-2">
                        <button type="button" className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" onClick={() => updateLine(c.product_id, { qty: Math.max(1, c.qty - 1) })}>
                          <Minus className="h-4 w-4" />
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="min-h-[44px] w-full rounded-lg border px-2 text-base dark:border-slate-600 dark:bg-slate-950"
                          value={qtyShow}
                          onChange={(e) =>
                            setLineDraft((m) => ({
                              ...m,
                              [c.product_id]: { ...(m[c.product_id] || {}), qty: e.target.value.replace(/\D/g, "").slice(0, 9) },
                            }))
                          }
                          onBlur={() => {
                            const rawQty = lineDraft[c.product_id]?.qty;
                            setLineDraft((m) => {
                              const inner = { ...(m[c.product_id] || {}) };
                              delete inner.qty;
                              const next = { ...m };
                              if (Object.keys(inner).length === 0) delete next[c.product_id];
                              else next[c.product_id] = inner;
                              return next;
                            });
                            updateLine(c.product_id, {
                              qty: parseOptionalInt(rawQty, c.qty, { min: 1, max: capQty }),
                            });
                          }}
                        />
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-600 dark:bg-slate-900"
                          onClick={() => updateLine(c.product_id, { qty: c.qty + 1 })}
                          disabled={c.qty >= capQty}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </label>
                    <label className="font-medium text-slate-700 dark:text-slate-300">
                      Harga jual
                      <input
                        type="text"
                        inputMode="decimal"
                        className="mt-1 min-h-[44px] w-full rounded-lg border px-2 py-2 text-base dark:border-slate-600 dark:bg-slate-950"
                        value={sellShow}
                        onChange={(e) =>
                          setLineDraft((m) => ({
                            ...m,
                            [c.product_id]: { ...(m[c.product_id] || {}), sell: e.target.value.replace(/[^\d]/g, "").slice(0, 14) },
                          }))
                        }
                        onBlur={() => {
                          const rawSell = lineDraft[c.product_id]?.sell;
                          setLineDraft((m) => {
                            const inner = { ...(m[c.product_id] || {}) };
                            delete inner.sell;
                            const next = { ...m };
                            if (Object.keys(inner).length === 0) delete next[c.product_id];
                            else next[c.product_id] = inner;
                            return next;
                          });
                          const pv = parseOptionalFloat(rawSell ?? String(c.sell_price), c.sell_price, { min: 0 });
                          updateLine(c.product_id, { sell_price: pv });
                        }}
                      />
                    </label>
                    <label className="col-span-2 font-medium text-slate-700 dark:text-slate-300">
                      Diskon baris (rupiah)
                      <input
                        type="text"
                        inputMode="decimal"
                        className="mt-1 min-h-[44px] w-full rounded-lg border px-2 py-2 text-base dark:border-slate-600 dark:bg-slate-950"
                        value={discShow}
                        onChange={(e) =>
                          setLineDraft((m) => ({
                            ...m,
                            [c.product_id]: { ...(m[c.product_id] || {}), disc: e.target.value.replace(/[^\d]/g, "").slice(0, 14) },
                          }))
                        }
                        onBlur={() => {
                          const rawDisc = lineDraft[c.product_id]?.disc;
                          const g = c.sell_price * c.qty;
                          setLineDraft((m) => {
                            const inner = { ...(m[c.product_id] || {}) };
                            delete inner.disc;
                            const next = { ...m };
                            if (Object.keys(inner).length === 0) delete next[c.product_id];
                            else next[c.product_id] = inner;
                            return next;
                          });
                          const dv = parseOptionalFloat(rawDisc ?? String(disc), disc, { min: 0, max: g });
                          updateLine(c.product_id, { discount_amount: dv });
                        }}
                      />
                    </label>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Margin: {formatIDR(net - c.purchase_price * c.qty)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatIDR(subtotal)}</span>
            </div>
            <label className="flex justify-between gap-2 text-sm">
              Diskon total
              <input
                type="text"
                inputMode="numeric"
                className="w-32 rounded border px-2 py-1 text-right tabular-nums dark:border-slate-600 dark:bg-slate-950"
                value={
                  discountDraft !== null
                    ? formatThousandsIdInput(discountDraft)
                    : formatThousandsIdInput(String(Math.round(Number(discountTotal))))
                }
                onChange={(e) => setDiscountDraft(e.target.value.replace(/\D/g, "").slice(0, 14))}
                onBlur={() => {
                  if (discountDraft === null) return;
                  setDiscountTotal(parseOptionalFloat(discountDraft, discountTotal, { min: 0, max: subtotal }));
                  setDiscountDraft(null);
                }}
              />
            </label>
            <label className="flex justify-between gap-2 text-sm">
              Pajak %
              <input
                type="text"
                inputMode="decimal"
                className="w-28 rounded border px-2 py-1 dark:border-slate-600 dark:bg-slate-950"
                value={taxDraft !== null ? taxDraft : String(taxPercent)}
                onChange={(e) => setTaxDraft(e.target.value.replace(/[^\d.]/g, "").slice(0, 8))}
                onBlur={() => {
                  if (taxDraft === null) return;
                  setTaxPercent(parseOptionalFloat(taxDraft, taxPercent, { min: 0, max: 100 }));
                  setTaxDraft(null);
                }}
              />
            </label>
            <div className="flex justify-between text-sm">
              <span>Pajak</span>
              <span>{formatIDR(taxAmount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-brand-700 dark:text-brand-300">
              <span>Grand Total</span>
              <span>{formatIDR(grandTotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Margin (est.)</span>
              <span>{formatIDR(marginTotal)}</span>
            </div>
            <textarea
              className="w-full rounded-xl border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Catatan transaksi"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">Kirim struk online (WhatsApp)</p>
              <label className="mt-2 block text-xs text-slate-600 dark:text-slate-400">Nomor WA tujuan (otomatis dari pelanggan jika ada)</label>
              <input
                type="tel"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2.5 text-base dark:border-emerald-800 dark:bg-slate-950"
                placeholder="62812… atau 0812…"
                value={receiptWaPhone}
                onChange={(e) => setReceiptWaPhone(e.target.value.replace(/[^\d]/g, ""))}
              />
              <button
                type="button"
                disabled={!cart.length}
                onClick={() => waNotaToNumber(receiptWaPhone)}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <MessageCircle className="h-4 w-4" /> Kirim teks struk ke WA
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPayOpen(true)}
              disabled={!cart.length}
              className="w-full rounded-2xl bg-brand-600 py-3 text-base font-semibold text-white shadow-soft disabled:opacity-50"
            >
              Bayar
            </button>
          </div>
        </div>
      </div>

      <Modal open={payOpen} title="Pembayaran" onClose={() => setPayOpen(false)} wide>
        <div className="mb-4 rounded-xl bg-brand-50 p-3 text-sm dark:bg-brand-950/30">
          <div className="flex justify-between font-semibold">
            <span>Grand total</span>
            <span>{formatIDR(grandTotal)}</span>
          </div>
          <div className="mt-1 flex justify-between text-slate-600 dark:text-slate-400">
            <span>Tunai + transfer + QRIS</span>
            <span>{formatIDR(nonDebtPaid)}</span>
          </div>
          {hutangGap > 0.02 && (
            <div className="mt-1 flex justify-between text-slate-600 dark:text-slate-400">
              <span>Piutang (sisa otomatis)</span>
              <span>{formatIDR(hutangGap)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between font-semibold text-slate-800 dark:text-slate-200">
            <span>Total alokasi</span>
            <span>{formatIDR(paidSumDraft)}</span>
          </div>
          <div className="mt-2 flex justify-between text-lg font-bold text-brand-800 dark:text-brand-300">
            <span>Kembalian</span>
            <span>{formatIDR(kembalianDraft)}</span>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
            <p className="text-sm font-medium">Cash</p>
            <select
              className="w-full rounded-lg border px-2 py-2 dark:border-slate-600 dark:bg-slate-950"
              value={cashAccountId}
              onChange={(e) => setCashAccountId(e.target.value)}
            >
              {cashAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              className="w-full rounded-lg border px-2 py-2 dark:border-slate-600 dark:bg-slate-950"
              placeholder="Jumlah cash (boleh lebih)"
              value={formatThousandsIdInput(cashAmtStr)}
              onChange={(e) => setCashAmtStr(e.target.value.replace(/\D/g, "").slice(0, 14))}
            />
          </div>
          <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
            <p className="text-sm font-medium">Transfer</p>
            <select className="w-full rounded-lg border px-2 py-2 dark:border-slate-950" value={transferAcc} onChange={(e) => setTransferAcc(e.target.value)}>
              <option value="">Rekening</option>
              {cashAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              className="w-full rounded-lg border px-2 py-2 dark:bg-slate-950"
              placeholder="Jumlah"
              value={formatThousandsIdInput(transferAmtStr)}
              onChange={(e) => setTransferAmtStr(e.target.value.replace(/\D/g, "").slice(0, 14))}
            />
          </div>
          <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
            <p className="text-sm font-medium">QRIS</p>
            <select className="w-full rounded-lg border px-2 py-2 dark:bg-slate-950" value={qrisAcc} onChange={(e) => setQrisAcc(e.target.value)}>
              <option value="">Akun</option>
              {cashAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              className="w-full rounded-lg border px-2 py-2 dark:bg-slate-950"
              placeholder="Jumlah"
              value={formatThousandsIdInput(qrisAmtStr)}
              onChange={(e) => setQrisAmtStr(e.target.value.replace(/\D/g, "").slice(0, 14))}
            />
          </div>
          <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800 md:col-span-2">
            <p className="text-sm font-medium">Piutang (sisa ke grand total)</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Nominal di atas belum menutup total? Sisanya otomatis jadi piutang — pilih pelanggan dulu.
            </p>
            {hutangGap > 0.02 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                Sisa piutang: {formatIDR(hutangGap)}
                {!customerId && (
                  <span className="mt-1 block text-xs font-normal text-red-600 dark:text-red-400">
                    Pilih pelanggan di keranjang agar transaksi bisa diselesaikan.
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Tidak ada sisa piutang (atau grand total sudah tertutup).</p>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium dark:border-slate-600"
            onClick={() => setCashAmtStr(String(Math.max(0, Math.round(grandTotal))))}
          >
            Isi tunai = total
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium dark:border-slate-600"
            onClick={() => {
              setCashAmtStr("");
              setTransferAmtStr(String(Math.max(0, Math.round(grandTotal))));
              if (!transferAcc && cashAccounts[0]) setTransferAcc(String(cashAccounts[0].id));
            }}
          >
            Transfer saja = total
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium dark:border-slate-600"
            onClick={() => {
              setCashAmtStr("");
              setTransferAmtStr("");
              setQrisAmtStr(String(Math.max(0, Math.round(grandTotal))));
              if (!qrisAcc && cashAccounts[0]) setQrisAcc(String(cashAccounts[0].id));
            }}
          >
            QRIS saja = total
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium dark:border-slate-600"
            onClick={() => {
              setCashAmtStr("");
              setTransferAmtStr("");
              setQrisAmtStr("");
            }}
          >
            Piutang saja (kosongkan tunai/transfer/QRIS)
          </button>
          <button
            type="button"
            className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs dark:border-slate-600"
            onClick={() => {
              setCashAmtStr("");
              setTransferAmtStr("");
              setQrisAmtStr("");
            }}
          >
            Kosongkan nominal
          </button>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-xl border px-4 py-2" onClick={() => setPayOpen(false)}>
            Batal
          </button>
          <button type="button" className="rounded-xl bg-brand-600 px-6 py-2 font-semibold text-white" onClick={() => submitSale("completed")}>
            Selesaikan
          </button>
        </div>
      </Modal>

      <Modal open={barcodeOpen} title="Cetak barcode produk" onClose={() => setBarcodeOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500">Produk di daftar saat ini</label>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={barcodeProdId}
              onChange={(e) => setBarcodeProdId(e.target.value)}
            >
              <option value="">— Pilih —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) stok {p.stock}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Jumlah cetak (label)</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={3}
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder="1"
              value={barcodeCopies}
              onChange={(e) => setBarcodeCopies(e.target.value.replace(/\D/g, "").slice(0, 3))}
              onBlur={() => {
                const n = Number.parseInt(String(barcodeCopies).trim(), 10);
                if (!Number.isFinite(n) || n < 1) setBarcodeCopies("1");
              }}
            />
          </div>
          <button type="button" onClick={printBarcodeLabels} className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white">
            Print / Pengaturan printer
          </button>
          <p className="text-xs text-slate-500">Di dialog print pilih printer termal atau simpan PDF. Nama produk tercetak di atas barcode.</p>
        </div>
      </Modal>
    </PageStack>
  );
}
