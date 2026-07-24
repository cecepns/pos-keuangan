import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Landmark, Plus, ExternalLink } from "lucide-react";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PAGE_SIZE } from "../constants/pagination";
import { formatDateID, formatIDR } from "../utils/format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Modal } from "../components/Modal";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { SearchInput } from "../components/SearchInput";
import { ActionButton } from "../components/ActionButton";
import { Badge } from "../components/Badge";
import { PAGE_TABLE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";
import { PaginationBar } from "../components/PaginationBar";

const STATUS_BADGE = {
  open: { label: "Belum Lunas", variant: "danger" },
  partial: { label: "Sebagian", variant: "warning" },
  paid: { label: "Lunas", variant: "success" },
  overdue: { label: "Jatuh Tempo", variant: "danger" },
};

export default function SupplierPayablesPage() {
  const [tab, setTab] = useState("hutang");

  const [payList, setPayList] = useState([]);
  const [payTotal, setPayTotal] = useState(0);
  const [pageH, setPageH] = useState(1);
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 350);
  const [payLoading, setPayLoading] = useState(true);

  const [purList, setPurList] = useState([]);
  const [purTotal, setPurTotal] = useState(0);
  const [pageB, setPageB] = useState(1);
  const [purLoading, setPurLoading] = useState(true);

  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    supplier_id: "",
    reference: "",
    amount: "",
    due_date: "",
    notes: "",
  });

  const [purForm, setPurForm] = useState({
    supplier_id: "",
    total: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const [payRow, setPayRow] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payAccountId, setPayAccountId] = useState("");

  const pagesH = Math.max(1, Math.ceil(payTotal / PAGE_SIZE));
  const pagesB = Math.max(1, Math.ceil(purTotal / PAGE_SIZE));

  const loadPayables = useCallback(async () => {
    setPayLoading(true);
    try {
      const { data } = await api.get("/api/payables", { params: { q: dq, page: pageH, limit: PAGE_SIZE } });
      setPayList(data.data || []);
      setPayTotal(Number(data.total ?? 0));
    } finally {
      setPayLoading(false);
    }
  }, [dq, pageH]);

  const loadPurchases = useCallback(async () => {
    setPurLoading(true);
    try {
      const { data } = await api.get("/api/supplier-purchases", { params: { page: pageB, limit: PAGE_SIZE } });
      setPurList(data.data || []);
      setPurTotal(Number(data.total ?? 0));
    } finally {
      setPurLoading(false);
    }
  }, [pageB]);

  useEffect(() => {
    (async () => {
      try {
        const [s, a] = await Promise.all([fetchAllPages("/api/suppliers"), fetchAllPages("/api/cash-accounts")]);
        setSuppliers(s);
        setAccounts(a);
        if (s.length) {
          setPurForm((f) => (f.supplier_id ? f : { ...f, supplier_id: String(s[0].id) }));
        }
        if (a.length) setPayAccountId(String(a[0].id));
      } catch {
        toast.error("Gagal memuat supplier / kas");
      }
    })();
  }, []);

  useEffect(() => {
    if (tab === "hutang") loadPayables();
  }, [tab, loadPayables]);

  useEffect(() => {
    if (tab === "beli") loadPurchases();
  }, [tab, loadPurchases]);

  useEffect(() => {
    setPageH(1);
  }, [dq]);

  function openCreatePayable() {
    if (!suppliers.length) {
      toast.error("Tambah supplier terlebih dahulu di halaman Supplier");
      return;
    }
    setCreateForm({
      supplier_id: String(suppliers[0].id),
      reference: "",
      amount: "",
      due_date: "",
      notes: "",
    });
    setCreateOpen(true);
  }

  async function submitCreatePayable(e) {
    e.preventDefault();
    const amount = Number(createForm.amount);
    if (!createForm.supplier_id || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Pilih supplier dan isi nominal hutang");
      return;
    }
    const t = toast.loading("Menyimpan hutang…");
    try {
      await api.post("/api/payables", {
        supplier_id: Number(createForm.supplier_id),
        reference: createForm.reference || null,
        amount,
        due_date: createForm.due_date || null,
        notes: createForm.notes || null,
      });
      toast.success("Hutang supplier berhasil dicatat", { id: t });
      setCreateOpen(false);
      loadPayables();
    } catch {
      toast.dismiss(t);
    }
  }

  async function submitPurchase(e) {
    e.preventDefault();
    if (!suppliers.length) {
      toast.error("Tambah supplier terlebih dahulu");
      return;
    }
    const total = Number(purForm.total);
    if (!purForm.supplier_id || !Number.isFinite(total) || total <= 0) {
      toast.error("Pilih supplier dan isi total pembelian");
      return;
    }
    const t = toast.loading("Menyimpan pembelian…");
    try {
      await api.post("/api/supplier-purchases", {
        supplier_id: Number(purForm.supplier_id),
        total,
        purchase_date: purForm.purchase_date,
        notes: purForm.notes || null,
      });
      toast.success("Pembelian berhasil dicatat", { id: t });
      setPurForm((f) => ({ ...f, total: "", notes: "" }));
      loadPurchases();
    } catch {
      toast.dismiss(t);
    }
  }

  function openPayModal(row) {
    setPayRow(row);
    setPayAmount(String(row.balance));
    if (accounts.length) setPayAccountId(String(accounts[0].id));
    else setPayAccountId("");
  }

  async function submitPay(e) {
    e.preventDefault();
    if (!payRow) return;
    const amt = Number(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Jumlah bayar tidak valid");
      return;
    }
    if (amt > Number(payRow.balance) + 0.01) {
      toast.error("Jumlah bayar melebihi sisa hutang");
      return;
    }
    if (!payAccountId || !accounts.length) {
      toast.error("Pilih rekening kas terlebih dahulu");
      return;
    }
    const t = toast.loading("Memproses pembayaran…");
    try {
      await api.post(`/api/payables/${payRow.id}/pay`, {
        amount: amt,
        cash_account_id: Number(payAccountId),
      });
      toast.success("Pembayaran hutang berhasil dicatat", { id: t });
      setPayRow(null);
      loadPayables();
    } catch {
      toast.dismiss(t);
    }
  }

  return (
    <PageStack>
      <PageHeader
        title="Hutang & Pembelian Supplier"
        subtitle="Pencatatan faktur hutang ke supplier serta riwayat pembelian barang"
      >
        <Link to="/app/suppliers">
          <ActionButton variant="secondary">
            Data Supplier <ExternalLink className="h-3.5 w-3.5" />
          </ActionButton>
        </Link>
      </PageHeader>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setTab("hutang")}
          className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-all ${
            tab === "hutang"
              ? "border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Faktur Hutang Supplier
        </button>
        <button
          type="button"
          onClick={() => setTab("beli")}
          className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-all ${
            tab === "beli"
              ? "border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Pencatatan Pembelian
        </button>
      </div>

      {tab === "hutang" && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              placeholder="Cari supplier, no. referensi, catatan…"
              value={q}
              onChange={(val) => {
                setPageH(1);
                setQ(val);
              }}
            />
            <ActionButton onClick={openCreatePayable} variant="primary">
              <Plus className="h-4 w-4" /> Catat Hutang Baru
            </ActionButton>
          </div>

          <div className={PAGE_TABLE_WRAP}>
            {payLoading ? (
              <LoadingSpinner label="Memuat faktur hutang..." />
            ) : payList.length === 0 ? (
              <EmptyState
                icon={Landmark}
                title="Tidak Ada Hutang"
                message={q ? "Tidak ada hutang yang sesuai dengan kata kunci." : "Belum ada faktur hutang supplier yang dicatat."}
              />
            ) : (
              <table className={PAGE_TABLE}>
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>No. Referensi</th>
                    <th className="text-right">Tagihan Total</th>
                    <th className="text-right">Sudah Dibayar</th>
                    <th className="text-right">Sisa Hutang</th>
                    <th>Jatuh Tempo</th>
                    <th>Status</th>
                    <th className="w-20 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {payList.map((p) => {
                    const st = STATUS_BADGE[p.status] || { label: p.status, variant: "neutral" };
                    return (
                      <tr key={p.id}>
                        <td className="font-medium text-slate-900 dark:text-white">{p.supplier_name}</td>
                        <td className="font-mono text-xs text-slate-600 dark:text-slate-400">{p.reference || "—"}</td>
                        <td className="text-right font-mono text-xs text-slate-800 dark:text-slate-200">{formatIDR(p.amount)}</td>
                        <td className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">{formatIDR(p.paid_amount)}</td>
                        <td className="text-right font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">{formatIDR(p.balance)}</td>
                        <td className="text-xs text-slate-600 dark:text-slate-400">{p.due_date ? formatDateID(p.due_date) : "—"}</td>
                        <td>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </td>
                        <td className="text-right">
                          {Number(p.balance) > 0.01 ? (
                            <ActionButton variant="primary" size="xs" onClick={() => openPayModal(p)}>
                              Bayar
                            </ActionButton>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {!payLoading && payList.length > 0 && (
            <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Hal {pageH} dari {pagesH} ({payTotal} faktur)
              </span>
              <PaginationBar page={pageH} pages={pagesH} setPage={setPageH} />
            </div>
          )}
        </>
      )}

      {tab === "beli" && (
        <>
          <div className="card space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Catat Total Pembelian Supplier</h2>
              <p className="mt-1 text-xs text-slate-500">
                Form ini menambahkan angka total pembelian pada supplier untuk keperluan rekap.
              </p>
            </div>
            <form className="grid max-w-2xl gap-4 sm:grid-cols-2" onSubmit={submitPurchase}>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Pilih Supplier</label>
                <select
                  className="input-base mt-1.5"
                  value={purForm.supplier_id}
                  onChange={(e) => setPurForm((f) => ({ ...f, supplier_id: e.target.value }))}
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Total Nominal Pembelian (Rp)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="input-base mt-1.5 font-mono"
                  value={purForm.total}
                  onChange={(e) => setPurForm((f) => ({ ...f, total: e.target.value }))}
                  required
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tanggal Pembelian</label>
                <input
                  type="date"
                  className="input-base mt-1.5"
                  value={purForm.purchase_date}
                  onChange={(e) => setPurForm((f) => ({ ...f, purchase_date: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Catatan / No. Faktur</label>
                <input
                  className="input-base mt-1.5"
                  value={purForm.notes}
                  onChange={(e) => setPurForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Catatan pembelian..."
                />
              </div>
              <div className="sm:col-span-2 pt-1">
                <ActionButton type="submit" variant="primary">
                  Simpan Pembelian
                </ActionButton>
              </div>
            </form>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Riwayat Pencatatan Pembelian</h2>
            <div className={PAGE_TABLE_WRAP}>
              {purLoading ? (
                <LoadingSpinner label="Memuat riwayat pembelian..." />
              ) : purList.length === 0 ? (
                <EmptyState
                  title="Belum Ada Riwayat"
                  message="Gunakan form di atas untuk mencatat pembelian baru dari supplier."
                />
              ) : (
                <table className={PAGE_TABLE}>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Supplier</th>
                      <th className="text-right">Total Nominal</th>
                      <th>Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purList.map((r) => (
                      <tr key={r.id}>
                        <td className="text-xs text-slate-600 dark:text-slate-400">{formatDateID(r.purchase_date)}</td>
                        <td className="font-medium text-slate-900 dark:text-white">{r.supplier_name}</td>
                        <td className="text-right font-mono text-xs font-semibold text-slate-900 dark:text-white">{formatIDR(r.total)}</td>
                        <td className="text-slate-600 dark:text-slate-400">{r.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {!purLoading && purList.length > 0 && (
              <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Hal {pageB} dari {pagesB} ({purTotal} pembelian)
                </span>
                <PaginationBar page={pageB} pages={pagesB} setPage={setPageB} />
              </div>
            )}
          </div>
        </>
      )}

      <Modal open={createOpen} title="Catat Faktur Hutang Supplier Baru" onClose={() => setCreateOpen(false)} wide>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submitCreatePayable}>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Pilih Supplier</label>
            <select
              className="input-base mt-1.5"
              value={createForm.supplier_id}
              onChange={(e) => setCreateForm((f) => ({ ...f, supplier_id: e.target.value }))}
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nominal Tagihan (Rp)</label>
            <input
              type="number"
              min="1"
              step="1"
              className="input-base mt-1.5 font-mono"
              value={createForm.amount}
              onChange={(e) => setCreateForm((f) => ({ ...f, amount: e.target.value }))}
              required
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">No. Referensi / Faktur</label>
            <input
              className="input-base mt-1.5"
              value={createForm.reference}
              onChange={(e) => setCreateForm((f) => ({ ...f, reference: e.target.value }))}
              placeholder="misal: INV-2026/001"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Jatuh Tempo (Opsional)</label>
            <input
              type="date"
              className="input-base mt-1.5"
              value={createForm.due_date}
              onChange={(e) => setCreateForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Catatan</label>
            <textarea
              rows={2}
              className="input-base mt-1.5"
              value={createForm.notes}
              onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Catatan tambahan..."
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <ActionButton type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Batal
            </ActionButton>
            <ActionButton type="submit" variant="primary">
              Simpan Hutang
            </ActionButton>
          </div>
        </form>
      </Modal>

      <Modal open={!!payRow} title={payRow ? `Bayar Hutang — ${payRow.supplier_name}` : "Bayar Hutang"} onClose={() => setPayRow(null)}>
        {payRow && (
          <form className="space-y-4" onSubmit={submitPay}>
            <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900">
              <span className="text-slate-500">Sisa Tagihan Hutang:</span>
              <p className="font-mono text-base font-bold text-rose-600 dark:text-rose-400">{formatIDR(payRow.balance)}</p>
            </div>
            {!accounts.length && (
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Belum ada rekening kas aktif. Buat rekening kas di menu Cash Flow.
              </p>
            )}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Jumlah Pembayaran (Rp)</label>
              <input
                type="number"
                min="1"
                step="1"
                className="input-base mt-1.5 font-mono"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Potong dari Rekening Kas</label>
              <select
                className="input-base mt-1.5"
                value={payAccountId}
                onChange={(e) => setPayAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <ActionButton type="button" variant="secondary" onClick={() => setPayRow(null)}>
                Batal
              </ActionButton>
              <ActionButton type="submit" variant="primary" disabled={!accounts.length}>
                Proses Bayar
              </ActionButton>
            </div>
          </form>
        )}
      </Modal>
    </PageStack>
  );
}
