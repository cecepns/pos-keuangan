import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, ShoppingCart, Trash2, Undo2 } from "lucide-react";
import api from "../api/client";
import { PAGE_SIZE } from "../constants/pagination";
import { formatDateID, formatDateTimeID, formatIDR } from "../utils/format";
import { buildThermalReceiptHtml } from "../utils/receipt";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TableSkeleton } from "../components/Skeleton";
import { PAGE_TABLE_WIDE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";
import { Modal } from "../components/Modal";

const PAY_LABEL = { cash: "Tunai", transfer: "Transfer", qris: "QRIS", hutang: "Piutang" };

function receiptDateStr(tx) {
  if (!tx) return "";
  if (tx.sale_date) {
    const t = new Date(tx.created_at);
    const time = t.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    return `${formatDateID(tx.sale_date)} · ${time}`;
  }
  return formatDateTimeID(tx.created_at);
}

export default function TransactionsPage() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 350);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [refundId, setRefundId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteDraftId, setDeleteDraftId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = { q: dq, page, limit: PAGE_SIZE };
      if (from) params.from = from;
      if (to) params.to = to;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get("/api/transactions", { params });
      setList(data.data || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [dq, page, from, to, statusFilter]);

  async function deleteDraftHold() {
    if (!deleteDraftId) return;
    const t = toast.loading("Menghapus...");
    try {
      await api.delete(`/api/transactions/${deleteDraftId}`);
      toast.success("Dihapus", { id: t });
      setDeleteDraftId(null);
      load();
    } catch {
      toast.dismiss(t);
    }
  }

  function displayTxDate(x) {
    if (x.sale_date) return formatDateID(x.sale_date);
    return formatDateTimeID(x.created_at);
  }

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    api
      .get(`/api/transactions/${detailId}`)
      .then(({ data }) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Gagal memuat detail");
          setDetailId(null);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailId]);

  async function printReceipt() {
    if (!detail) return;
    const t = toast.loading("Menyiapkan struk...");
    try {
      const { data: s } = await api.get("/api/settings");
      const widthMm = Math.min(110, Math.max(58, Number(s.thermal_width_mm) || 80));
      const lines = (detail.items || []).map((it) => ({
        name: it.product_name,
        sell_price: it.sell_price,
        qty: it.qty,
        discount_amount: it.discount_amount,
      }));
      const payments = (detail.payments || []).map((p) => ({
        method: PAY_LABEL[p.method] || p.method,
        amount: p.amount,
      }));
      const html = buildThermalReceiptHtml({
        storeName: s.store_name || "Toko",
        storeAddress: s.store_address || "",
        storePhone: s.store_phone || "",
        footer: s.receipt_footer || "",
        widthMm,
        invoiceNo: detail.invoice_no,
        dateStr: receiptDateStr(detail),
        lines,
        subtotal: Number(detail.subtotal),
        discountTotal: Number(detail.discount_total),
        taxPercent: Number(detail.tax_percent),
        taxAmount: Number(detail.tax_amount),
        grandTotal: Number(detail.grand_total),
        paidSum: Number(detail.paid_amount),
        changeAmount: Number(detail.change_amount),
        payments,
      });
      const w = window.open("", "_blank");
      if (!w) {
        toast.error("Popup diblokir — izinkan untuk cetak", { id: t });
        return;
      }
      w.document.write(html);
      w.document.close();
      toast.success("Struk dibuka di tab baru", { id: t });
    } catch {
      toast.dismiss(t);
    }
  }

  async function doRefund() {
    const t = toast.loading("Refund...");
    try {
      await api.post(`/api/transactions/${refundId}/refund`);
      toast.success("Refund berhasil — stok dikembalikan", { id: t });
      setRefundId(null);
      load();
    } catch {
      toast.dismiss(t);
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageStack>
      <div>
        <h1 className="text-2xl font-bold">Transaksi</h1>
        <p className="text-sm text-slate-500">Riwayat, detail transaksi, dan refund</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <input
          className="max-w-md rounded-2xl border px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
          placeholder="Cari invoice..."
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <label className="text-xs text-slate-500">Dari tanggal</label>
            <input
              type="date"
              className="mt-1 block rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Sampai</label>
            <input
              type="date"
              className="mt-1 block rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
            />
          </div>
          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-sm"
            onClick={() => {
              setFrom("");
              setTo("");
              setPage(1);
            }}
          >
            Reset tanggal
          </button>
          <div>
            <label className="text-xs text-slate-500">Status</label>
            <select
              className="mt-1 block rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
            >
              <option value="">Semua</option>
              <option value="completed">Selesai</option>
              <option value="draft">Draft</option>
              <option value="hold">Hold</option>
              <option value="refunded">Refund</option>
            </select>
          </div>
        </div>
      </div>

      <div className={PAGE_TABLE_WRAP}>
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={6} cols={6} />
          </div>
        ) : (
          <table className={PAGE_TABLE_WIDE}>
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-4 py-3 text-left">Invoice</th>
                <th className="px-4 py-3 text-left">Tgl transaksi</th>
                <th className="px-4 py-3 text-left">Pelanggan</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {list.map((x) => (
                <tr key={x.id}>
                  <td className="px-4 py-3 font-mono text-xs">{x.invoice_no}</td>
                  <td className="px-4 py-3">{displayTxDate(x)}</td>
                  <td className="px-4 py-3">{x.customer_name || "—"}</td>
                  <td className="px-4 py-3 text-right">{formatIDR(x.grand_total)}</td>
                  <td className="px-4 py-3 capitalize">{x.status}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30"
                        title="Detail"
                        aria-label="Detail transaksi"
                        onClick={() => setDetailId(x.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {x.status === "completed" && (
                        <button
                          type="button"
                          className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          title="Refund"
                          aria-label="Refund transaksi"
                          onClick={() => setRefundId(x.id)}
                        >
                          <Undo2 className="h-4 w-4" />
                        </button>
                      )}
                      {(x.status === "draft" || x.status === "hold") && (
                        <>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            title="Lanjut di POS"
                            aria-label="Lanjut di POS"
                            onClick={() => navigate(`/app/pos?resume=${x.id}`)}
                          >
                            <ShoppingCart className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="Hapus draft"
                            aria-label="Hapus draft atau hold"
                            onClick={() => setDeleteDraftId(x.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-between text-sm">
        <span>
          Hal {page}/{pages}
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} className="rounded-xl border px-3 py-1" onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          <button type="button" disabled={page >= pages} className="rounded-xl border px-3 py-1" onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>

      <Modal open={!!detailId} title={detail ? `Transaksi ${detail.invoice_no}` : "Detail transaksi"} onClose={() => setDetailId(null)} wide>
        {detailLoading && <p className="text-sm text-slate-500">Memuat…</p>}
        {!detailLoading && detail && (
          <div className="space-y-4">
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <p>
                <span className="text-slate-500">Waktu sistem</span>
                <br />
                <span className="font-medium">{formatDateTimeID(detail.created_at)}</span>
              </p>
              {detail.sale_date && (
                <p>
                  <span className="text-slate-500">Tanggal penjualan</span>
                  <br />
                  <span className="font-medium">{formatDateID(detail.sale_date)}</span>
                </p>
              )}
              <p>
                <span className="text-slate-500">Kasir</span>
                <br />
                <span className="font-medium">{detail.cashier_name || "—"}</span>
              </p>
              <p>
                <span className="text-slate-500">Pelanggan</span>
                <br />
                <span className="font-medium">{detail.customer_name || "—"}</span>
              </p>
            </div>
            <div className={PAGE_TABLE_WRAP}>
              <table className={PAGE_TABLE_WIDE}>
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs">Produk</th>
                    <th className="px-3 py-2 text-right text-xs">Harga</th>
                    <th className="px-3 py-2 text-right text-xs">Qty</th>
                    <th className="px-3 py-2 text-right text-xs">Diskon</th>
                    <th className="px-3 py-2 text-right text-xs">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {(detail.items || []).map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 text-sm">{it.product_name}</td>
                      <td className="px-3 py-2 text-right text-sm">{formatIDR(it.sell_price)}</td>
                      <td className="px-3 py-2 text-right text-sm">{it.qty}</td>
                      <td className="px-3 py-2 text-right text-sm">{formatIDR(it.discount_amount)}</td>
                      <td className="px-3 py-2 text-right text-sm font-medium">{formatIDR(it.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex justify-between gap-8">
                  <span className="text-slate-500">Subtotal</span>
                  <span>{formatIDR(detail.subtotal)}</span>
                </div>
                {Number(detail.discount_total) > 0 && (
                  <div className="flex justify-between gap-8">
                    <span className="text-slate-500">Diskon</span>
                    <span>-{formatIDR(detail.discount_total)}</span>
                  </div>
                )}
                {Number(detail.tax_percent) > 0 && (
                  <div className="flex justify-between gap-8">
                    <span className="text-slate-500">Pajak {detail.tax_percent}%</span>
                    <span>{formatIDR(detail.tax_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-8 text-base font-bold">
                  <span>Total</span>
                  <span>{formatIDR(detail.grand_total)}</span>
                </div>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-xs font-semibold uppercase text-slate-500">Pembayaran</p>
                {(detail.payments || []).map((p) => (
                  <div key={p.id} className="flex justify-end gap-4">
                    <span>{PAY_LABEL[p.method] || p.method}</span>
                    <span>{formatIDR(p.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-end gap-4 pt-1 font-medium">
                  <span>Dibayar</span>
                  <span>{formatIDR(detail.paid_amount)}</span>
                </div>
                {Number(detail.change_amount) > 0 && (
                  <div className="flex justify-end gap-4 text-emerald-600">
                    <span>Kembalian</span>
                    <span>{formatIDR(detail.change_amount)}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="rounded-xl border px-4 py-2" onClick={() => setDetailId(null)}>
                Tutup
              </button>
              <button type="button" className="rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white" onClick={printReceipt}>
                Cetak struk
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!refundId}
        title="Refund transaksi?"
        message="Stok produk akan dikembalikan. Yakin?"
        danger
        confirmText="Refund"
        onConfirm={doRefund}
        onClose={() => setRefundId(null)}
      />

      <ConfirmDialog
        open={!!deleteDraftId}
        title="Hapus draft / hold?"
        message="Keranjang tersimpan di server akan dihapus permanen."
        danger
        confirmText="Hapus"
        onConfirm={deleteDraftHold}
        onClose={() => setDeleteDraftId(null)}
      />
    </PageStack>
  );
}
