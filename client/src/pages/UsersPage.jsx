import { useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, Shield } from "lucide-react";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PAGE_SIZE } from "../constants/pagination";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { ActionButton } from "../components/ActionButton";
import { Badge } from "../components/Badge";
import { PAGE_TABLE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";
import { PaginationBar } from "../components/PaginationBar";
import { useAuthStore } from "../store/authStore";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [roles, setRoles] = useState([]);
  const [allPerms, setAllPerms] = useState([]);
  const [roleTab, setRoleTab] = useState("");
  const [roleCodes, setRoleCodes] = useState([]);
  const [userModal, setUserModal] = useState(null);
  const [delId, setDelId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uf, setUf] = useState({ name: "", email: "", password: "", role_id: "", store_id: "", is_active: true });
  const currentUserId = useAuthStore((s) => s.user?.id);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function loadUsers() {
    setLoading(true);
    try {
      const { data } = await api.get("/api/users", { params: { page, limit: PAGE_SIZE } });
      setUsers(data.data || []);
      setTotal(Number(data.total ?? 0));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers().catch(() => {});
  }, [page]);

  useEffect(() => {
    (async () => {
      const r = await fetchAllPages("/api/roles");
      setRoles(r);
      const { data } = await api.get("/api/permissions");
      setAllPerms(data.data || []);
    })();
  }, []);

  const roleIdNum = Number(roleTab) || 0;
  useEffect(() => {
    if (!roleIdNum) return;
    api
      .get(`/api/roles/${roleIdNum}/permissions`)
      .then(({ data }) => setRoleCodes((data.data || []).map((x) => x.code)))
      .catch(() => setRoleCodes([]));
  }, [roleIdNum]);

  useEffect(() => {
    if (!roleTab && roles.length) setRoleTab(String(roles[0].id));
  }, [roles, roleTab]);

  async function saveRolePerms() {
    if (!roleIdNum) return;
    const t = toast.loading("Menyimpan hak akses...");
    try {
      await api.put(`/api/roles/${roleIdNum}/permissions`, { codes: roleCodes });
      toast.success("Hak akses role diperbarui", { id: t });
    } catch {
      toast.dismiss(t);
    }
  }

  function openCreate() {
    setUf({ name: "", email: "", password: "", role_id: roles[0] ? String(roles[0].id) : "", store_id: "", is_active: true });
    setUserModal("create");
  }

  function openEdit(u) {
    setUf({
      id: u.id,
      name: u.name,
      email: u.email,
      password: "",
      role_id: String(u.role_id),
      store_id: u.store_id ? String(u.store_id) : "",
      is_active: !!u.is_active,
    });
    setUserModal("edit");
  }

  async function saveUser(e) {
    e.preventDefault();
    const t = toast.loading("Menyimpan pengguna...");
    try {
      if (userModal === "create") {
        if (!uf.password || uf.password.length < 4) {
          toast.error("Password minimal 4 karakter", { id: t });
          return;
        }
        await api.post("/api/users", {
          name: uf.name,
          email: uf.email,
          password: uf.password,
          role_id: Number(uf.role_id),
          store_id: uf.store_id ? Number(uf.store_id) : null,
        });
      } else {
        await api.put(`/api/users/${uf.id}`, {
          name: uf.name,
          email: uf.email,
          role_id: Number(uf.role_id),
          store_id: uf.store_id ? Number(uf.store_id) : null,
          is_active: uf.is_active,
          ...(uf.password ? { password: uf.password } : {}),
        });
      }
      toast.success("Pengguna berhasil disimpan", { id: t });
      setUserModal(null);
      loadUsers();
    } catch {
      toast.dismiss(t);
    }
  }

  const permRows = useMemo(() => allPerms.filter((p) => p.code !== "all"), [allPerms]);
  const isAdminRole = roleIdNum === 1;

  return (
    <PageStack>
      <PageHeader
        title="Pengguna & Hak Akses"
        subtitle="Kelola akun pengguna kasir/admin dan konfigurasi hak akses per peran"
      />

      <div className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Daftar Pengguna</h2>
          <ActionButton onClick={openCreate} variant="primary" size="sm">
            <Plus className="h-4 w-4" /> Pengguna Baru
          </ActionButton>
        </div>

        <div className={PAGE_TABLE_WRAP}>
          {loading ? (
            <LoadingSpinner label="Memuat akun pengguna..." />
          ) : users.length === 0 ? (
            <EmptyState title="Tidak ada pengguna" message="Belum ada pengguna terdaftar." />
          ) : (
            <table className={PAGE_TABLE}>
              <thead>
                <tr>
                  <th>Nama Pengguna</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="w-24 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium text-slate-900 dark:text-white">{u.name}</td>
                    <td className="font-mono text-xs text-slate-600 dark:text-slate-400">{u.email}</td>
                    <td>
                      <Badge variant="info" className="capitalize">
                        {u.role_name}
                      </Badge>
                    </td>
                    <td>
                      {u.is_active ? (
                        <Badge variant="success">Aktif</Badge>
                      ) : (
                        <Badge variant="neutral">Nonaktif</Badge>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ActionButton variant="ghost-brand" size="icon" onClick={() => openEdit(u)} title="Edit">
                          <Edit2 className="h-4 w-4" />
                        </ActionButton>
                        <ActionButton
                          variant="ghost-danger"
                          size="icon"
                          disabled={String(u.id) === String(currentUserId)}
                          onClick={() => setDelId(u.id)}
                          title={String(u.id) === String(currentUserId) ? "Tidak dapat menghapus akun sendiri" : "Hapus"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && users.length > 0 && (
          <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between pt-1">
            <span>
              Hal {page} dari {pages} ({total} akun)
            </span>
            <PaginationBar page={page} pages={pages} setPage={setPage} variant="compact" />
          </div>
        )}
      </div>

      <div className="card space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Hak Akses Menu per Role</h2>
          <p className="mt-1 text-xs text-slate-500">
            Role Admin selalu memiliki izin penuh. Centang menu yang diizinkan untuk role Kasir/Owner.
          </p>
        </div>

        <div className="max-w-md">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Pilih Role</label>
          <select
            className="input-base mt-1.5"
            value={roleTab}
            onChange={(e) => setRoleTab(e.target.value)}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {r.description || ""}
              </option>
            ))}
          </select>
        </div>

        {isAdminRole ? (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <Shield className="mb-1 h-4 w-4 text-brand-600" />
            Role Admin memiliki izin penuh (&quot;Semua Akses&quot;) secara default dan tidak dapat dikurangi.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {permRows.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/80 p-3 text-xs transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-brand-600"
                    checked={roleCodes.includes(p.code)}
                    onChange={(e) => {
                      setRoleCodes((prev) =>
                        e.target.checked ? [...new Set([...prev, p.code])] : prev.filter((c) => c !== p.code)
                      );
                    }}
                  />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{p.description}</span>
                    <span className="ml-1.5 font-mono text-[10px] text-slate-400">({p.code})</span>
                  </div>
                </label>
              ))}
            </div>
            <div>
              <ActionButton onClick={saveRolePerms} variant="primary">
                Simpan Hak Akses Role
              </ActionButton>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!delId}
        title="Hapus Pengguna?"
        message="Akun login akan dihapus permanen. Pengguna yang memiliki riwayat transaksi POS tidak dapat dihapus."
        danger
        confirmText="Hapus"
        onConfirm={async () => {
          if (!delId) return;
          const t = toast.loading("Menghapus...");
          try {
            await api.delete(`/api/users/${delId}`, { skipToast: true });
            toast.success("Pengguna berhasil dihapus", { id: t });
            setDelId(null);
            loadUsers();
          } catch (err) {
            toast.dismiss(t);
            const msg = err.response?.data?.error || "Gagal menghapus pengguna";
            toast.error(msg);
            setDelId(null);
          }
        }}
        onClose={() => setDelId(null)}
      />

      <Modal open={!!userModal} title={userModal === "create" ? "Pengguna Baru" : "Edit Pengguna"} onClose={() => setUserModal(null)}>
        <form className="space-y-4" onSubmit={saveUser}>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Lengkap</label>
            <input
              className="input-base mt-1.5"
              value={uf.name}
              onChange={(e) => setUf((x) => ({ ...x, name: e.target.value }))}
              required
              placeholder="Nama pengguna..."
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Login</label>
            <input
              type="email"
              className="input-base mt-1.5"
              value={uf.email}
              onChange={(e) => setUf((x) => ({ ...x, email: e.target.value }))}
              required
              placeholder="email@toko.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {userModal === "create" ? "Password" : "Password Baru (Opsional)"}
            </label>
            <input
              type="password"
              className="input-base mt-1.5"
              value={uf.password}
              onChange={(e) => setUf((x) => ({ ...x, password: e.target.value }))}
              placeholder={userModal === "create" ? "Minimal 4 karakter" : "Kosongkan jika tidak diubah"}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Role / Peran</label>
            <select
              className="input-base mt-1.5"
              value={uf.role_id}
              onChange={(e) => setUf((x) => ({ ...x, role_id: e.target.value }))}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          {userModal === "edit" && (
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                className="accent-brand-600"
                checked={uf.is_active}
                onChange={(e) => setUf((x) => ({ ...x, is_active: e.target.checked }))}
              />
              Akun Aktif
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <ActionButton type="button" variant="secondary" onClick={() => setUserModal(null)}>
              Batal
            </ActionButton>
            <ActionButton type="submit" variant="primary">
              Simpan Pengguna
            </ActionButton>
          </div>
        </form>
      </Modal>
    </PageStack>
  );
}
