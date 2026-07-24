import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Banknote, Eye, Trash2, Undo2, Wallet, Receipt } from "lucide-react";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PAGE_SIZE } from "../constants/pagination";
import { formatDateID, formatDateTimeID, formatIDR, formatThousandsIdInput } from "../utils/format";
import { buildThermalReceiptHtml } from "../utils/receipt";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { ActionButton } from "../components/ActionButton";
import { Badge } from "../components/Badge";
import { PAGE_TABLE_WIDE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";
import { PaginationBar } from "../components/PaginationBar";
import { Modal } from "../components/Modal";
import { useAuthStore } from "../store/authStore";

const PAY_LABEL = { cash: "Tunai", transfer: "Transfer", qris: "QRIS", hutang: "Piutang" };
const RECEIVABLE_EPSILON = 0.5;

function hasOutstandingReceivable(tx) {
  return Number(tx?.receivable_balance || 0) > RECEIVABLE_EPSILON;
}

function paymentMethodLabel(payment, tx) {
  if (payment?.method !== "hutang") return PAY_LABEL[payment?.method] || payment?.method;
  return hasOutstandingReceivable(tx) ? "Piutang tercatat" : "Piutang tercatat (sudah lunas)";
}

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
  const roleName = useAuthStore((s) => s.user?.role_name);
  const canAdminDeleteTx = roleName === "admin" || roleName === "owner";
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
  const [deletePerm, setDeletePerm] = useState(null);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [payOpen, setPayOpen] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payCtx, setPayCtx] = useState(null);
  const [payReceivableId, setPayReceivableId] = useState("");
  const [payAmountStr, setPayAmountStr] = useState("");
  const [payCashAccountId, setPayCashAccountId] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const ca = await fetchAllPages("/api/cash-accounts").catch(() => []);
        setCashAccounts(ca);
        if (ca.length) setPayCashAccountId(String(ca[0].id));
      } catch {
        /* */
      }
    })();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = { q: dq, page, limit: PAGE_SIZE };
      if (from) params.from = from;
      if (to) params.to = to;
      if (statusFilter === "owing") params.owing = "1";
      else if (statusFilter) params.status = statusFilter;
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
      toast.success("Berhasil dihapus", { id: t });
      setDeleteDraftId(null);
      load();
    } catch {
      toast.dismiss(t);
    }
  }

  function canPermanentDelete(tx) {
    if (!canAdminDeleteTx) return false;
    if (tx.status === "refunded") return true;
    if (tx.status === "completed" && !hasOutstandingReceivable(tx)) return true;
    return false;
  }

  async function deletePermanent() {
    if (!deletePerm?.id) return;
    const t = toast.loading("Menghapus transaksi…");
    try {
      await api.delete(`/api/transactions/${deletePerm.id}`, { skipToast: true });
      toast.success("Transaksi berhasil dihapus", { id: t });
      if (detailId === deletePerm.id) setDetailId(null);
      setDeletePerm(null);
      load();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err.response?.data?.error || "Gagal menghapus");
      setDeletePerm(null);
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
          toast.error("Gagal memuat detail transaksi");
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
    const t = toast.loading("Proses refund...");
    try {
      await api.post(`/api/transactions/${refundId}/refund`);
      toast.success("Refund berhasil — stok telah dikembalikan", { id: t });
      setRefundId(null);
      load();
    } catch {
      toast.dismiss(t);
    }
  }

  function closePayModal() {
    setPayOpen(false);
    setPayCtx(null);
    setPayReceivableId("");
    setPayAmountStr("");
    setPayLoading(false);
    setPaySubmitting(false);
  }

  async function openPayPiutang(transactionId) {
    setPayOpen(true);
    setPayLoading(true);
    setPayCtx(null);
    setPayReceivableId("");
    setPayAmountStr("");
    try {
      const { data } = await api.get(`/api/transactions/${transactionId}`, { skipToast: true });
      const lines = (data.receivable_lines || []).filter((r) => Number(r.balance) > RECEIVABLE_EPSILON);
      if (!lines.length) {
        toast.error("Tidak ada sisa piutang untuk transaksi ini");
        closePayModal();
        return;
      }
      const first = lines[0];
      setPayCtx({ txId: transactionId, invoiceNo: data.invoice_no, lines });
      setPayReceivableId(String(first.id));
      setPayAmountStr(String(Math.max(0, Math.ceil(Number(first.balance)))));
    } catch {
      toast.error("Gagal memuat data piutang");
      closePayModal();
    } finally {
      setPayLoading(false);
    }
  }

  async function submitPayPiutang() {
    if (!payCtx || !payReceivableId) return;
    const line = payCtx.lines.find((l) => String(l.id) === String(payReceivableId));
    if (!line) return;
    const maxPay = Number(line.balance);
    const paid = Number(String(payAmountStr).replace(/\D/g, "")) || 0;
    if (!Number.isFinite(paid) || paid < 1) {
      toast.error("Masukkan nominal pembayaran (minimal Rp1)");
      return;
    }
    if (paid > maxPay + RECEIVABLE_EPSILON) {
      toast.error(`Maksimal ${formatIDR(maxPay)}`);
      return;
    }
    if (!payCashAccountId) {
      toast.error("Pilih rekening kas");
      return;
    }
    const t = toast.loading("Mencatat pelunasan…");
    setPaySubmitting(true);
    try {
      await api.post(`/api/receivables/${payReceivableId}/pay`, {
        amount: paid,
        cash_account_id: Number(payCashAccountId),
      });
      toast.success("Pelunasan piutang berhasil dicatat", { id: t });
      const tid = payCtx.txId;
      closePayModal();
      load();
      if (detailId && Number(detailId) === Number(tid)) {
        const { data: fresh } = await api.get(`/api/transactions/${tid}`, { skipToast: true });
        setDetail(fresh);
      }
    } catch {
      toast.dismiss(t);
    } finally {
      setPaySubmitting(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageStack>
      <PageHeader
        title="Riwayat Transaksi"
        subtitle={`${total} transaksi tercatat · Pencarian invoice, filter tanggal & pelunasan piutang`}
      />

      <div className="card space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Nomor Invoice</label>
            <input
              className="input-base mt-1"
              placeholder="Cari no. invoice..."
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
            />
          </div>
          <div className="lg:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Dari Tanggal</label>
            <input
              type="date"
              className="input-base mt-1"
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
            />
          </div>
          <div className="lg:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Sampai Tanggal</label>
            <input
              type="date"
              className="input-base mt-1"
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
            />
          </div>
          <div className="flex items-end lg:col-span-2">
            <ActionButton
              variant="secondary"
              size="md"
              className="w-full"
              onClick={() => {
                setFrom("");
                setTo("");
                setPage(1);
              }}
            >
              Reset Filter
            </ActionButton>
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Status</label>
            <select
              className="input-base mt-1"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
            >
              <option value="">Semua Status</option>
              <option value="completed">Selesai</option>
              <option value="owing">Belum Lunas (Piutang)</option>
              <option value="draft">Draft</option>
              <option value="hold">Hold</option>
              <option value="refunded">Refund</option>
            </select>
          </div>
        </div>
      </div>

      <div className={PAGE_TABLE_WRAP}>
        {loading ? (
          <LoadingSpinner label="Memuat riwayat transaksi..." />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Tidak Ada Transaksi"
            message={q || from || to || statusFilter ? "Tidak ada transaksi yang cocok dengan filter." : "Belum ada transaksi Penjualan POS."}
          />
        ) : (
          <table className={PAGE_TABLE_WIDE}>
            <thead>
              <tr>
                <th className="w-36">Invoice</th>
                <th>Tanggal</th>
                <th>Kasir</th>
                <th>Pelanggan</th>
                <th className="text-right">Total Transaksi</th>
                <th>Status</th>
                <th className="w-32 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id}>
                  <td className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">{x.invoice_no}</td>
                  <td className="text-xs text-slate-600 dark:text-slate-400">{displayTxDate(x)}</td>
                  <td className="text-slate-800 dark:text-slate-200">{x.cashier_name || "—"}</td>
                  <td className="text-slate-800 dark:text-slate-200">{x.customer_name || "—"}</td>
                  <td className="text-right font-mono text-xs font-semibold text-slate-900 dark:text-white">{formatIDR(x.grand_total)}</td>
                  <td>
                    {x.status === "completed" && hasOutstandingReceivable(x) ? (
                      <div>
                        <Badge variant="warning">Belum Lunas</Badge>
                        <p className="mt-0.5 font-mono text-[11px] text-amber-700 dark:text-amber-300">Sisa: {formatIDR(x.receivable_balance)}</p>
                      </div>
                    ) : x.status === "completed" ? (
                      <Badge variant="success">Selesai</Badge>
                    ) : x.status === "refunded" ? (
                      <Badge variant="danger">Refund</Badge>
                    ) : (
                      <Badge variant="neutral" className="capitalize">{x.status}</Badge>
                    )}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ActionButton variant="ghost-brand" size="icon" onClick={() => setDetailId(x.id)} title="Detail Transaksi">
                        <Eye className="h-4 w-4" />
                      </ActionButton>

                      {x.status === "completed" && hasOutstandingReceivable(x) && (
                        <ActionButton variant="ghost" size="icon" className="text-amber-600 hover:bg-amber-50 dark:text-amber-400" onClick={() => openPayPiutang(x.id)} title="Pelunasan Piutang">
                          <Wallet className="h-4 w-4" />
                        </ActionButton>
                      )}

                      {x.status === "completed" && (
                        <ActionButton variant="ghost-danger" size="icon" onClick={() => setRefundId(x.id)} title="Refund Transaksi">
                          <Undo2 className="h-4 w-4" />
                        </ActionButton>
                      )}

                      {canPermanentDelete(x) && (
                        <ActionButton variant="ghost-danger" size="icon" onClick={() => setDeletePerm({ id: x.id, invoice_no: x.invoice_no, status: x.status })} title="Hapus Permanen (Admin)">
                          <Trash2 className="h-4 w-4" />
                        </ActionButton>
                      )}

                      {(x.status === "draft" || x.status === "hold") && (
                        <>
                          <ActionButton variant="ghost-brand" size="icon" onClick={() => navigate(`/app/pos?resume=${x.id}`)} title="Lanjut bayar di POS">
                            <Banknote className="h-4 w-4" />
                          </ActionButton>
                          <ActionButton variant="ghost-danger" size="icon" onClick={() => setDeleteDraftId(x.id)} title="Hapus Draft">
                            <Trash2 className="h-4 w-4" />
                          </ActionButton>
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

      {!loading && list.length > 0 && (
        <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Hal {page} dari {pages} ({total} transaksi)
          </span>
          <PaginationBar page={page} pages={pages} setPage={setPage} />
        </div>
      )}

      <Modal open={!!detailId} title={detail ? `Detail Transaksi — ${detail.invoice_no}` : "Detail Transaksi"} onClose={() => setDetailId(null)} wide>
        {detailLoading && <LoadingSpinner label="Memuat rincian transaksi..." />}
        {!detailLoading && detail && (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs dark:border-slate-800 dark:bg-slate-950 md:grid-cols-3">
              <div>
                <span className="text-slate-500">Status Transaksi:</span>
                <p className="mt-0.5 font-semibold capitalize text-slate-800 dark:text-slate-200">{detail.status}</p>
              </div>
              <div>
                <span className="text-slate-500">Status Pembayaran:</span>
                <p className="mt-0.5 font-semibold">
                  {hasOutstandingReceivable(detail) ? (
                    <span className="text-amber-600 dark:text-amber-400">Belum Lunas (Ada Piutang)</span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">Lunas</span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Waktu / Tanggal:</span>
                <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">{formatDateTimeID(detail.created_at)}</p>
              </div>
              <div>
                <span className="text-slate-500">Kasir:</span>
                <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">{detail.cashier_name || "—"}</p>
              </div>
              <div>
                <span className="text-slate-500">Pelanggan:</span>
                <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">{detail.customer_name || "—"}</p>
              </div>
            </div>

            <div className={PAGE_TABLE_WRAP}>
              <table className={PAGE_TABLE_WIDE}>
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th className="text-right">Harga</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Diskon</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.items || []).map((it) => (
                    <tr key={it.id}>
                      <td className="font-medium text-slate-900 dark:text-white">{it.product_name}</td>
                      <td className="text-right font-mono text-xs">{formatIDR(it.sell_price)}</td>
                      <td className="text-right font-mono text-xs">{it.qty}</td>
                      <td className="text-right font-mono text-xs text-rose-600">{formatIDR(it.discount_amount)}</td>
                      <td className="text-right font-mono text-xs font-semibold">{formatIDR(it.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap justify-between gap-4 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
              <div className="space-y-1.5 min-w-[200px]">
                <div className="flex justify-between gap-6">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-mono">{formatIDR(detail.subtotal)}</span>
                </div>
                {Number(detail.discount_total) > 0 && (
                  <div className="flex justify-between gap-6 text-rose-600">
                    <span>Total Diskon</span>
                    <span className="font-mono">-{formatIDR(detail.discount_total)}</span>
                  </div>
                )}
                {Number(detail.tax_percent) > 0 && (
                  <div className="flex justify-between gap-6">
                    <span className="text-slate-500">Pajak ({detail.tax_percent}%)</span>
                    <span className="font-mono">{formatIDR(detail.tax_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-6 pt-1 text-sm font-bold border-t border-slate-200 dark:border-slate-800">
                  <span>Grand Total</span>
                  <span className="font-mono text-brand-600 dark:text-brand-400">{formatIDR(detail.grand_total)}</span>
                </div>
              </div>

              <div className="space-y-1.5 min-w-[220px] text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pembayaran</p>
                {(detail.payments || []).map((p) => (
                  <div key={p.id} className="flex justify-end gap-4 font-mono">
                    <span className="text-slate-500">{paymentMethodLabel(p, detail)}</span>
                    <span>{formatIDR(p.amount)}</span>
                  </div>
                ))}
                {Number(detail.receivable_paid_amount) > RECEIVABLE_EPSILON && (
                  <div className="flex justify-end gap-4 font-mono text-emerald-600 dark:text-emerald-400">
                    <span>Pelunasan Piutang</span>
                    <span>{formatIDR(detail.receivable_paid_amount)}</span>
                  </div>
                )}
                <div className="flex justify-end gap-4 pt-1 font-semibold border-t border-slate-100 dark:border-slate-800">
                  <span>Total Dibayar</span>
                  <span className="font-mono">{formatIDR(detail.paid_amount)}</span>
                </div>
                {hasOutstandingReceivable(detail) && (
                  <div className="flex justify-end gap-4 font-mono font-semibold text-amber-600 dark:text-amber-400">
                    <span>Sisa Piutang</span>
                    <span>{formatIDR(detail.receivable_balance)}</span>
                  </div>
                )}
                {Number(detail.change_amount) > 0 && (
                  <div className="flex justify-end gap-4 font-mono text-emerald-600">
                    <span>Kembalian</span>
                    <span>{formatIDR(detail.change_amount)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {canPermanentDelete(detail) && (
                <ActionButton
                  variant="ghost-danger"
                  onClick={() => setDeletePerm({ id: detail.id, invoice_no: detail.invoice_no, status: detail.status })}
                >
                  Hapus Permanen
                </ActionButton>
              )}
              <ActionButton variant="secondary" onClick={() => setDetailId(null)}>
                Tutup
              </ActionButton>
              {detail.status === "completed" && hasOutstandingReceivable(detail) && (
                <ActionButton variant="secondary" onClick={() => openPayPiutang(detail.id)}>
                  <Wallet className="h-4 w-4" /> Pelunasan Piutang
                </ActionButton>
              )}
              <ActionButton variant="primary" onClick={printReceipt}>
                Cetak Struk
              </ActionButton>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!refundId}
        title="Refund Transaksi?"
        message="Stok produk akan otomatis dikembalikan ke inventaris. Yakin ingin refund?"
        danger
        confirmText="Proses Refund"
        onConfirm={doRefund}
        onClose={() => setRefundId(null)}
      />

      <ConfirmDialog
        open={!!deleteDraftId}
        title="Hapus Draft / Hold?"
        message="Keranjang tersimpan akan dihapus secara permanen."
        danger
        confirmText="Hapus"
        onConfirm={deleteDraftHold}
        onClose={() => setDeleteDraftId(null)}
      />

      <ConfirmDialog
        open={!!deletePerm}
        title="Hapus Transaksi Permanen?"
        message={
          deletePerm
            ? `Invoice ${deletePerm.invoice_no} (${deletePerm.status}) akan dihapus dari database. Stok dan saldo kas akan disesuaikan. Tindakan ini tidak bisa dibatalkan.`
            : ""
        }
        danger
        confirmText="Hapus Permanen"
        onConfirm={deletePermanent}
        onClose={() => setDeletePerm(null)}
      />

      <Modal
        open={payOpen}
        title={payCtx ? `Pelunasan Piutang — ${payCtx.invoiceNo}` : "Pelunasan Piutang"}
        onClose={() => {
          if (!payLoading && !paySubmitting) closePayModal();
        }}
      >
        {payLoading && !payCtx && <LoadingSpinner label="Memuat data piutang…" />}
        {payCtx && (
          <div className="space-y-4">
            {payCtx.lines.length > 1 && (
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Baris Piutang</label>
                <select
                  className="input-base mt-1.5"
                  value={payReceivableId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setPayReceivableId(id);
                    const ln = payCtx.lines.find((l) => String(l.id) === String(id));
                    if (ln) setPayAmountStr(String(Math.max(0, Math.ceil(Number(ln.balance)))));
                  }}
                >
                  {payCtx.lines.map((r) => (
                    <option key={r.id} value={r.id}>
                      #{r.id} — Sisa {formatIDR(r.balance)} ({r.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Jumlah Dibayar (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                className="input-base mt-1.5 font-mono"
                placeholder="0"
                value={formatThousandsIdInput(payAmountStr)}
                onChange={(e) => setPayAmountStr(e.target.value.replace(/\D/g, "").slice(0, 14))}
              />
              {payCtx.lines.length === 1 && (
                <p className="mt-1 text-xs text-slate-500">Maksimal pelunasan: {formatIDR(payCtx.lines[0].balance)}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Masuk ke Rekening Kas</label>
              <select
                className="input-base mt-1.5"
                value={payCashAccountId}
                onChange={(e) => setPayCashAccountId(e.target.value)}
              >
                {cashAccounts.length === 0 && <option value="">— Belum ada akun kas —</option>}
                {cashAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <ActionButton
                variant="secondary"
                onClick={closePayModal}
                disabled={payLoading || paySubmitting}
              >
                Batal
              </ActionButton>
              <ActionButton
                variant="primary"
                onClick={submitPayPiutang}
                disabled={payLoading || paySubmitting || !cashAccounts.length}
              >
                Simpan Pelunasan
              </ActionButton>
            </div>
          </div>
        )}
      </Modal>
    </PageStack>
  );
}
