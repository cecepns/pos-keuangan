import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Landmark } from "lucide-react";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PAGE_SIZE } from "../constants/pagination";
import { formatDateID, formatIDR } from "../utils/format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Modal } from "../components/Modal";
import { TableSkeleton } from "../components/Skeleton";
import { PAGE_TABLE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";
import { PaginationBar } from "../components/PaginationBar";

const STATUS_LABEL = { open: "Belum lunas", partial: "Sebagian", paid: "Lunas", overdue: "Jatuh tempo" };

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
      toast.error("Tambah supplier dulu di halaman Supplier");
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
    const t = toast.loading("Menyimpan…");
    try {
      await api.post("/api/payables", {
        supplier_id: Number(createForm.supplier_id),
        reference: createForm.reference || null,
        amount,
        due_date: createForm.due_date || null,
        notes: createForm.notes || null,
      });
      toast.success("Hutang tercatat", { id: t });
      setCreateOpen(false);
      loadPayables();
    } catch {
      toast.dismiss(t);
    }
  }

  async function submitPurchase(e) {
    e.preventDefault();
    if (!suppliers.length) {
      toast.error("Tambah supplier dulu");
      return;
    }
    const total = Number(purForm.total);
    if (!purForm.supplier_id || !Number.isFinite(total) || total <= 0) {
      toast.error("Pilih supplier dan isi total pembelian");
      return;
    }
    const t = toast.loading("Menyimpan…");
    try {
      await api.post("/api/supplier-purchases", {
        supplier_id: Number(purForm.supplier_id),
        total,
        purchase_date: purForm.purchase_date,
        notes: purForm.notes || null,
      });
      toast.success("Pembelian tercatat — kolom Total beli di supplier bertambah", { id: t });
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
      toast.error("Melebihi sisa hutang");
      return;
    }
    if (!payAccountId || !accounts.length) {
      toast.error("Buat rekening kas dulu (Pengaturan / Cash flow) lalu pilih rekening");
      return;
    }
    const t = toast.loading("Memproses…");
    try {
      await api.post(`/api/payables/${payRow.id}/pay`, {
        amount: amt,
        cash_account_id: Number(payAccountId),
      });
      toast.success("Pembayaran tercatat", { id: t });
      setPayRow(null);
      loadPayables();
    } catch {
      toast.dismiss(t);
    }
  }

  return (
    <PageStack>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Hutang & pembelian supplier</h1>
          <p className="text-sm text-slate-500">
            Catat utang ke supplier dan pembayarannya. Total beli bisa diisi lewat ringkasan pembelian (bukan pengeluaran operasional).{" "}
            <Link to="/app/suppliers" className="text-brand-600 underline">
              Data supplier
            </Link>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-100 bg-white p-1 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setTab("hutang")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            tab === "hutang" ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Hutang ke supplier
        </button>
        <button
          type="button"
          onClick={() => setTab("beli")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            tab === "beli" ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Catat pembelian (total beli)
        </button>
      </div>

      {tab === "hutang" && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <input
              className="max-w-md rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
              placeholder="Cari supplier, referensi, catatan…"
              value={q}
              onChange={(e) => {
                setPageH(1);
                setQ(e.target.value);
              }}
            />
            <button type="button" onClick={openCreatePayable} className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-5 py-2.5 font-semibold text-white shadow-soft">
              <Landmark className="h-5 w-5" />
              Catat hutang baru
            </button>
          </div>

          <div className={PAGE_TABLE_WRAP}>
            {payLoading ? (
              <div className="p-4">
                <TableSkeleton rows={5} cols={8} />
              </div>
            ) : (
              <table className={PAGE_TABLE}>
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-4 py-3 text-left">Supplier</th>
                    <th className="px-4 py-3 text-left">Referensi</th>
                    <th className="px-4 py-3 text-right">Tagihan</th>
                    <th className="px-4 py-3 text-right">Sudah bayar</th>
                    <th className="px-4 py-3 text-right">Sisa</th>
                    <th className="px-4 py-3 text-left">Jatuh tempo</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {!payList.length && !payLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        Belum ada hutang. Gunakan tombol &quot;Catat hutang baru&quot;.
                      </td>
                    </tr>
                  ) : (
                    payList.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 font-medium">{p.supplier_name}</td>
                        <td className="px-4 py-3 font-mono text-xs">{p.reference || "—"}</td>
                        <td className="px-4 py-3 text-right">{formatIDR(p.amount)}</td>
                        <td className="px-4 py-3 text-right">{formatIDR(p.paid_amount)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">{formatIDR(p.balance)}</td>
                        <td className="px-4 py-3 text-sm">{p.due_date ? formatDateID(p.due_date) : "—"}</td>
                        <td className="px-4 py-3 text-sm">{STATUS_LABEL[p.status] || p.status}</td>
                        <td className="px-4 py-3 text-right">
                          {Number(p.balance) > 0.01 ? (
                            <button type="button" className="text-brand-600 hover:underline" onClick={() => openPayModal(p)}>
                              Bayar
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Hal {pageH} / {pagesH} · {payTotal} faktur
            </span>
            <PaginationBar page={pageH} pages={pagesH} setPage={setPageH} />
          </div>
        </>
      )}

      {tab === "beli" && (
        <>
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Form ringkas (bukan mutasi stok)</h2>
            <p className="mb-4 text-xs text-slate-500">
              Menambah angka <strong>Total beli</strong> di kartu supplier. Untuk stok barang tetap lewat menu Barang / penyesuaian stok.
            </p>
            <form className="grid max-w-2xl gap-3 sm:grid-cols-2" onSubmit={submitPurchase}>
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500">Supplier</label>
                <select
                  className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
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
                <label className="text-xs text-slate-500">Total nominal (Rp)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={purForm.total}
                  onChange={(e) => setPurForm((f) => ({ ...f, total: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Tanggal pembelian</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={purForm.purchase_date}
                  onChange={(e) => setPurForm((f) => ({ ...f, purchase_date: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500">Catatan (opsional)</label>
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={purForm.notes}
                  onChange={(e) => setPurForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="No. faktur, keterangan…"
                />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" className="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white">
                  Simpan ke total beli
                </button>
              </div>
            </form>
          </div>

          <h2 className="font-semibold text-slate-900 dark:text-white">Riwayat pencatatan</h2>
          <div className={PAGE_TABLE_WRAP}>
            {purLoading ? (
              <div className="p-4">
                <TableSkeleton rows={5} cols={4} />
              </div>
            ) : (
              <table className={PAGE_TABLE}>
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-4 py-3 text-left">Tanggal</th>
                    <th className="px-4 py-3 text-left">Supplier</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-left">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {!purList.length ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        Belum ada riwayat. Isi form di atas lalu simpan.
                      </td>
                    </tr>
                  ) : (
                    purList.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3">{formatDateID(r.purchase_date)}</td>
                        <td className="px-4 py-3 font-medium">{r.supplier_name}</td>
                        <td className="px-4 py-3 text-right">{formatIDR(r.total)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{r.notes || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Hal {pageB} / {pagesB} · {purTotal} entri
            </span>
            <PaginationBar page={pageB} pages={pagesB} setPage={setPageB} />
          </div>
        </>
      )}

      <Modal open={createOpen} title="Catat hutang ke supplier" onClose={() => setCreateOpen(false)} wide>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={submitCreatePayable}>
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500">Supplier</label>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
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
            <label className="text-xs text-slate-500">Nominal hutang (Rp)</label>
            <input
              type="number"
              min="1"
              step="1"
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={createForm.amount}
              onChange={(e) => setCreateForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">No. referensi / faktur</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={createForm.reference}
              onChange={(e) => setCreateForm((f) => ({ ...f, reference: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Jatuh tempo (opsional)</label>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={createForm.due_date}
              onChange={(e) => setCreateForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500">Catatan</label>
            <textarea
              rows={2}
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={createForm.notes}
              onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" className="rounded-xl border px-4 py-2" onClick={() => setCreateOpen(false)}>
              Batal
            </button>
            <button type="submit" className="rounded-xl bg-brand-600 px-6 py-2 font-semibold text-white">
              Simpan
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!payRow} title={payRow ? `Bayar hutang — ${payRow.supplier_name}` : "Bayar"} onClose={() => setPayRow(null)}>
        {payRow && (
          <form className="space-y-3" onSubmit={submitPay}>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sisa hutang: <strong className="text-red-600">{formatIDR(payRow.balance)}</strong>
            </p>
            {!accounts.length ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                Belum ada rekening kas aktif. Tambah di halaman Cash flow atau Pengaturan.
              </p>
            ) : null}
            <div>
              <label className="text-xs text-slate-500">Jumlah dibayar (Rp)</label>
              <input
                type="number"
                min="1"
                step="1"
                className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Dari rekening kas</label>
              <select
                className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
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
              <button type="button" className="rounded-xl border px-4 py-2" onClick={() => setPayRow(null)}>
                Batal
              </button>
              <button type="submit" disabled={!accounts.length} className="rounded-xl bg-brand-600 px-6 py-2 font-semibold text-white disabled:opacity-50">
                Proses bayar
              </button>
            </div>
          </form>
        )}
      </Modal>
    </PageStack>
  );
}
