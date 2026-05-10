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
} from "lucide-react";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PAGE_SIZE } from "../constants/pagination";
import { formatIDR } from "../utils/format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Modal } from "../components/Modal";

export default function PosPage() {
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 300);
  const [customerSearch, setCustomerSearch] = useState("");
  const custQ = useDebouncedValue(customerSearch, 350);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [discountTotal, setDiscountTotal] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [notes, setNotes] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [cashAmt, setCashAmt] = useState(0);
  const [cashAccountId, setCashAccountId] = useState("");
  const [transferAmt, setTransferAmt] = useState(0);
  const [transferAcc, setTransferAcc] = useState("");
  const [qrisAmt, setQrisAmt] = useState(0);
  const [qrisAcc, setQrisAcc] = useState("");
  const [debtAmt, setDebtAmt] = useState(0);
  const barcodeRef = useRef(null);

  const fetchProducts = useCallback(async () => {
    const { data } = await api.get("/api/products", { params: { q: dq, limit: PAGE_SIZE, active: 1 } });
    setProducts(data.data || []);
  }, [dq]);

  useEffect(() => {
    fetchProducts().catch(() => {});
  }, [fetchProducts]);

  useEffect(() => {
    (async () => {
      try {
        const ca = await fetchAllPages("/api/cash-accounts").catch(() => []);
        setCashAccounts(ca);
        if (ca.length) setCashAccountId(String(ca[0].id));
      } catch {
        /* kasir tanpa cash API */
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
    const ex = cart.find((c) => c.product_id === p.id);
    if (ex) {
      setCart(cart.map((c) => (c.product_id === p.id ? { ...c, qty: c.qty + 1 } : c)));
    } else {
      setCart([
        ...cart,
        {
          product_id: p.id,
          name: p.name,
          barcode: p.barcode,
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
    setCart(cart.map((c) => (c.product_id === id ? { ...c, ...patch } : c)));
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

  function buildPayments() {
    const pays = [];
    if (cashAmt > 0 && cashAccountId)
      pays.push({ method: "cash", amount: cashAmt, cash_account_id: Number(cashAccountId) });
    if (transferAmt > 0 && transferAcc) pays.push({ method: "transfer", amount: transferAmt, cash_account_id: Number(transferAcc) });
    if (qrisAmt > 0 && qrisAcc) pays.push({ method: "qris", amount: qrisAmt, cash_account_id: Number(qrisAcc) });
    if (debtAmt > 0) pays.push({ method: "hutang", amount: debtAmt });
    return pays;
  }

  async function submitSale(status = "completed") {
    const pays = status === "completed" ? buildPayments() : [];
    if (status === "completed") {
      const sum = pays.reduce((s, p) => s + p.amount, 0);
      if (Math.abs(sum - grandTotal) > 1 && !debtAmt) {
        toast.error("Total pembayaran harus sesuai grand total (multi payment)");
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
      }
    } catch {
      toast.dismiss(t);
    }
  }

  function printReceipt() {
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return toast.error("Popup diblokir");
    w.document.write(`<!DOCTYPE html><html><head><title>Struk</title>
      <style>
        body{font-family:monospace;font-size:12px;padding:8px;max-width:280px;}
        h1{font-size:14px;margin:0 0 8px;} table{width:100%;} td{padding:2px 0;}
      </style></head><body>
      <h1>POS Keuangan</h1>
      <p>${new Date().toLocaleString("id-ID")}</p>
      <table>${cart
        .map(
          (c) =>
            `<tr><td>${c.name}</td><td align="right">${c.qty}x ${formatIDR(c.sell_price)}</td></tr>
             <tr><td colspan="2" align="right">${formatIDR(c.sell_price * c.qty - (c.discount_amount || 0))}</td></tr>`
        )
        .join("")}
      </table>
      <p><strong>Total ${formatIDR(grandTotal)}</strong></p>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    w.document.close();
  }

  function waNota() {
    const text = encodeURIComponent(
      `Nota POS Keuangan\nTotal: ${formatIDR(grandTotal)}\nTerima kasih.`
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
        const { data } = await api.get("/api/products", { params: { q: code, limit: PAGE_SIZE } });
        found = (data.data || []).find((p) => p.barcode === code) || data.data?.[0];
      } catch {
        /* ignore */
      }
    }
    if (found) addToCart(found);
    else toast.error("Produk tidak ditemukan");
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Point of Sale</h1>
          <p className="text-sm text-slate-500">Pencarian realtime & barcode</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          <button type="button" onClick={printReceipt} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm text-white">
            <Printer className="h-4 w-4" /> Struk
          </button>
          <button
            type="button"
            onClick={waNota}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
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
            <ScanBarcode className="h-5 w-5 text-brand-600" />
            <input
              ref={barcodeRef}
              className="flex-1 bg-transparent outline-none"
              placeholder="Scan barcode (Enter)"
              onKeyDown={handleBarcode}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addToCart(p)}
                className="flex flex-col rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-soft transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="font-semibold text-slate-900 dark:text-white">{p.name}</span>
                <span className="text-xs text-slate-500">{p.sku}</span>
                <span className="mt-2 text-brand-700 dark:text-brand-300">{formatIDR(p.sell_price)}</span>
                <span className="text-xs text-slate-400">Stok: {p.stock}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Keranjang</h2>
          <div className="mb-3 space-y-2">
            <label className="text-xs text-slate-500">Pelanggan (cari — debounce)</label>
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
            {cart.map((c) => (
              <div key={c.product_id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                <div className="flex justify-between gap-2">
                  <span className="text-sm font-medium">{c.name}</span>
                  <button type="button" onClick={() => removeLine(c.product_id)} className="text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <label>
                    Qty
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
                      <button type="button" className="rounded bg-white p-1 dark:bg-slate-900" onClick={() => updateLine(c.product_id, { qty: c.qty + 1 })}>
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
                    Diskon baris
                    <input
                      type="number"
                      className="mt-1 w-full rounded border px-2 py-1 dark:border-slate-600 dark:bg-slate-950"
                      value={c.discount_amount}
                      onChange={(e) => updateLine(c.product_id, { discount_amount: Number(e.target.value) })}
                    />
                  </label>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Margin baris:{" "}
                  {formatIDR(c.sell_price * c.qty - (c.discount_amount || 0) - c.purchase_price * c.qty)}
                </div>
              </div>
            ))}
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
              <span>Margin transaksi (est.)</span>
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
              placeholder="Jumlah cash"
              value={cashAmt || ""}
              onChange={(e) => setCashAmt(Number(e.target.value))}
            />
            <p className="text-xs text-slate-500">
              Kembalian: {formatIDR(Math.max(0, cashAmt - grandTotal))}
            </p>
          </div>
          <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
            <p className="text-sm font-medium">Transfer</p>
            <select className="w-full rounded-lg border px-2 py-2 dark:bg-slate-600 dark:bg-slate-950" value={transferAcc} onChange={(e) => setTransferAcc(e.target.value)}>
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
            <p className="text-sm font-medium">Hutang / Piutang</p>
            <input
              type="number"
              className="w-full rounded-lg border px-2 py-2 dark:bg-slate-950"
              placeholder="Jumlah piutang"
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
    </div>
  );
}
