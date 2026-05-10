import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { formatIDR } from "../utils/format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Modal } from "../components/Modal";
import { PageStack } from "../components/TableCard";
import { buildThermalReceiptHtml, buildReceiptWhatsAppText } from "../utils/receipt";

const PRODUCT_PAGE_SIZE = 48;

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
  const [cashAmt, setCashAmt] = useState(0);
  const [cashAccountId, setCashAccountId] = useState("");
  const [transferAmt, setTransferAmt] = useState(0);
  const [transferAcc, setTransferAcc] = useState("");
  const [qrisAmt, setQrisAmt] = useState(0);
  const [qrisAcc, setQrisAcc] = useState("");
  const [debtAmt, setDebtAmt] = useState(0);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [barcodeProdId, setBarcodeProdId] = useState("");
  const [barcodeCopies, setBarcodeCopies] = useState(1);
  const barcodeRef = useRef(null);

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
          const srv = liveStock(c.product_id, c.stock);
          const otherRes = (reservedByProduct[c.product_id] || 0) - c.qty;
          const cap = Math.max(1, Math.max(0, srv - otherRes));
          const mq = Math.max(1, Math.min(Number(patch.qty) || 1, cap));
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
    setCart(cart.filter((c) => c.product_id !== id));
  }

  const subtotal = useMemo(
    () => cart.reduce((s, c) => s + c.sell_price * c.qty - (c.discount_amount || 0), 0),
    [cart]
  );
  const taxAmount = useMemo(() => (subtotal - discountTotal) * (taxPercent / 100), [subtotal, discountTotal, taxPercent]);
  const grandTotal = useMemo(() => subtotal - discountTotal + taxAmount, [subtotal, discountTotal, taxAmount]);

  useEffect(() => {
    if (payOpen && grandTotal > 0) setCashAmt(grandTotal);
  }, [payOpen, grandTotal]);

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

  const paidSumDraft = cashAmt + transferAmt + qrisAmt + debtAmt;
  const kembalianDraft = Math.max(0, paidSumDraft - grandTotal);

  function buildPayments() {
    const pays = [];
    if (cashAmt > 0 && cashAccountId)
      pays.push({ method: "cash", amount: cashAmt, cash_account_id: Number(cashAccountId) });
    if (transferAmt > 0 && transferAcc) pays.push({ method: "transfer", amount: transferAmt, cash_account_id: Number(transferAcc) });
    if (qrisAmt > 0 && qrisAcc) pays.push({ method: "qris", amount: qrisAmt, cash_account_id: Number(qrisAcc) });
    if (debtAmt > 0) pays.push({ method: "hutang", amount: debtAmt });
    return pays;
  }

  function receiptPaymentsFromDraft() {
    const p = [];
    if (cashAmt > 0) p.push({ method: "cash", amount: cashAmt });
    if (transferAmt > 0) p.push({ method: "transfer", amount: transferAmt });
    if (qrisAmt > 0) p.push({ method: "qris", amount: qrisAmt });
    if (debtAmt > 0) p.push({ method: "piutang", amount: debtAmt });
    return p;
  }

  async function submitSale(status = "completed") {
    const pays = status === "completed" ? buildPayments() : [];
    if (status === "completed") {
      const sum = pays.reduce((s, x) => s + Number(x.amount || 0), 0);
      if (grandTotal > 0.01 && sum + 0.02 < grandTotal) {
        toast.error("Total pembayaran kurang dari grand total");
        return;
      }
      if (debtAmt > 0 && !customerId) {
        toast.error("Pilih pelanggan untuk piutang");
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
      toast.success(data.invoice_no || "Tersimpan", { id: t });
      if (status === "completed") {
        setCart([]);
        setDiscountTotal(0);
        setNotes("");
        setPayOpen(false);
        setDebtAmt(0);
        setTransferAmt(0);
        setQrisAmt(0);
        fetchProductPage(1, false).catch(() => {});
        setProductPage(1);
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

  function waNota() {
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
    window.open(`https://wa.me/?text=${text}`, "_blank");
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
    const n = Math.min(50, Math.max(1, Number(barcodeCopies) || 1));
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return toast.error("Popup diblokir");
    const labels = [];
    for (let i = 0; i < n; i++) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      JsBarcode(svg, String(code), { format: "CODE128", width: 1.6, height: 48, displayValue: false, fontSize: 11 });
      const bottom = String(p.barcode || p.sku || code).replace(/</g, "&lt;");
      labels.push(
        `<div class="lb" style="page-break-after:always;text-align:center;padding:8px;font-family:sans-serif;font-size:11px;">
          <div style="font-weight:600;margin-bottom:4px;">${String(p.name).replace(/</g, "&lt;")}</div>
          ${svg.outerHTML}
          <div style="margin-top:4px;font-family:monospace;font-size:10px;">${bottom}</div>
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
          <button
            type="button"
            onClick={waNota}
            disabled={!cart.length}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-3 xl:col-span-2">
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
                    className="flex flex-col rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-soft transition hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <span className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">{p.name}</span>
                    <span className="text-xs text-slate-500">{p.sku}</span>
                    <span className="mt-1 text-brand-700 dark:text-brand-300">{formatIDR(p.sell_price)}</span>
                    <span className={`text-xs ${left <= 0 ? "text-red-500" : "text-slate-400"}`}>
                      Tersisa: {left}
                      {(reservedByProduct[p.id] || 0) > 0 ? (
                        <span className="text-slate-500"> / gudang {p.stock}</span>
                      ) : null}
                    </span>
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
          <div className="max-h-64 space-y-2 overflow-auto">
            {cart.length === 0 && <p className="text-sm text-slate-500">Belum ada item</p>}
            {cart.map((c) => {
              const gross = c.sell_price * c.qty;
              const disc = Number(c.discount_amount || 0);
              const net = gross - disc;
              return (
                <div key={c.product_id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                  <div className="flex justify-between gap-2">
                    <span className="text-sm font-medium">{c.name}</span>
                    <button type="button" onClick={() => removeLine(c.product_id)} className="text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {disc > 0 ? (
                    <p className="mt-1 text-xs text-slate-500">
                      <span className="line-through">{formatIDR(gross)}</span>{" "}
                      <span className="font-semibold text-brand-700">{formatIDR(net)}</span>{" "}
                      <span>(diskon {formatIDR(disc)})</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">Subtotal baris {formatIDR(net)}</p>
                  )}
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <label>
                      Qty (maks{" "}
                      {Math.max(
                        1,
                        liveStock(c.product_id, c.stock) - ((reservedByProduct[c.product_id] || 0) - c.qty)
                      )}
                      )
                      <div className="flex items-center gap-1">
                        <button type="button" className="rounded bg-white p-1 dark:bg-slate-900" onClick={() => updateLine(c.product_id, { qty: Math.max(1, c.qty - 1) })}>
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          className="w-full rounded border px-1 dark:border-slate-600 dark:bg-slate-950"
                          value={c.qty}
                          onChange={(e) => updateLine(c.product_id, { qty: Number(e.target.value) || 1 })}
                        />
                        <button
                          type="button"
                          className="rounded bg-white p-1 dark:bg-slate-900"
                          onClick={() => updateLine(c.product_id, { qty: c.qty + 1 })}
                          disabled={c.qty >= c.stock}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </label>
                    <label>
                      Harga jual
                      <input
                        type="number"
                        className="mt-1 w-full rounded border px-2 py-1 dark:border-slate-600 dark:bg-slate-950"
                        value={c.sell_price}
                        onChange={(e) => updateLine(c.product_id, { sell_price: Number(e.target.value) })}
                      />
                    </label>
                    <label className="col-span-2">
                      Diskon baris (rupiah)
                      <input
                        type="number"
                        className="mt-1 w-full rounded border px-2 py-1 dark:border-slate-600 dark:bg-slate-950"
                        value={c.discount_amount}
                        onChange={(e) => updateLine(c.product_id, { discount_amount: Number(e.target.value) })}
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
                type="number"
                className="w-28 rounded border px-2 py-1 dark:border-slate-600 dark:bg-slate-950"
                value={discountTotal}
                onChange={(e) => setDiscountTotal(Number(e.target.value))}
              />
            </label>
            <label className="flex justify-between gap-2 text-sm">
              Pajak %
              <input
                type="number"
                className="w-28 rounded border px-2 py-1 dark:border-slate-600 dark:bg-slate-950"
                value={taxPercent}
                onChange={(e) => setTaxPercent(Number(e.target.value))}
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
            <button
              type="button"
              onClick={() => setPayOpen(true)}
              disabled={!cart.length}
              className="w-full rounded-2xl bg-brand-600 py-3 font-semibold text-white shadow-soft disabled:opacity-50"
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
            <span>Jumlah dibayar (total input)</span>
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
              type="number"
              className="w-full rounded-lg border px-2 py-2 dark:border-slate-600 dark:bg-slate-950"
              placeholder="Jumlah cash (boleh lebih)"
              value={cashAmt || ""}
              onChange={(e) => setCashAmt(Number(e.target.value))}
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
              type="number"
              className="w-full rounded-lg border px-2 py-2 dark:bg-slate-950"
              placeholder="Jumlah"
              value={transferAmt || ""}
              onChange={(e) => setTransferAmt(Number(e.target.value))}
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
              type="number"
              className="w-full rounded-lg border px-2 py-2 dark:bg-slate-950"
              placeholder="Jumlah"
              value={qrisAmt || ""}
              onChange={(e) => setQrisAmt(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
            <p className="text-sm font-medium">Piutang (belum dibayar penuh)</p>
            <input
              type="number"
              className="w-full rounded-lg border px-2 py-2 dark:bg-slate-950"
              placeholder="Nominal piutang"
              value={debtAmt || ""}
              onChange={(e) => setDebtAmt(Number(e.target.value))}
            />
          </div>
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
              type="number"
              min={1}
              max={50}
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={barcodeCopies}
              onChange={(e) => setBarcodeCopies(Number(e.target.value) || 1)}
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
