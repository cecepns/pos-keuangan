import { useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import api from "../api/client";
import { fetchAllPages } from "../api/fetchAllPages";
import { PAGE_SIZE } from "../constants/pagination";
import { Modal } from "../components/Modal";
import { PAGE_TABLE, PAGE_TABLE_WRAP, PageStack } from "../components/TableCard";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [roles, setRoles] = useState([]);
  const [allPerms, setAllPerms] = useState([]);
  const [roleTab, setRoleTab] = useState("");
  const [roleCodes, setRoleCodes] = useState([]);
  const [userModal, setUserModal] = useState(null);
  const [uf, setUf] = useState({ name: "", email: "", password: "", role_id: "", store_id: "", is_active: true });

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function loadUsers() {
    const { data } = await api.get("/api/users", { params: { page, limit: PAGE_SIZE } });
    setUsers(data.data || []);
    setTotal(Number(data.total ?? 0));
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
      toast.success("Hak akses diperbarui", { id: t });
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
    const t = toast.loading("Menyimpan...");
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
      toast.success("Disimpan", { id: t });
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pengguna & hak akses</h1>
        <p className="text-sm text-slate-500">Kelola akun login dan izin menu per peran (role)</p>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900 dark:text-white">Daftar pengguna</h2>
          <button type="button" onClick={openCreate} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
            Pengguna baru
          </button>
        </div>
        <div className={PAGE_TABLE_WRAP}>
          <table className={PAGE_TABLE}>
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-3 py-2 text-left">Nama</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Aktif</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2">{u.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{u.email}</td>
                  <td className="px-3 py-2">{u.role_name}</td>
                  <td className="px-3 py-2">{u.is_active ? "Ya" : "Tidak"}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" className="text-brand-600 hover:underline" onClick={() => openEdit(u)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex justify-between text-sm text-slate-500">
          <span>
            Hal {page}/{pages}
          </span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} className="rounded border px-2" onClick={() => setPage((p) => p - 1)}>
              Prev
            </button>
            <button type="button" disabled={page >= pages} className="rounded border px-2" onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Hak akses menu per role</h2>
        <p className="mb-4 text-xs text-slate-500">
          Admin selalu punya izin penuh. Centang menu yang boleh diakses per role (kasir / owner).
        </p>
        <div className="mb-4">
          <label className="text-xs text-slate-500">Pilih role</label>
          <select
            className="mt-1 w-full max-w-md rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
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
          <p className="text-sm text-slate-600 dark:text-slate-400">Role admin memakai izin &quot;Semua akses&quot; dan tidak diubah di sini.</p>
        ) : (
          <>
            <div className="mb-4 grid max-h-72 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {permRows.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-800">
                  <input
                    type="checkbox"
                    checked={roleCodes.includes(p.code)}
                    onChange={(e) => {
                      setRoleCodes((prev) =>
                        e.target.checked ? [...new Set([...prev, p.code])] : prev.filter((c) => c !== p.code)
                      );
                    }}
                  />
                  <span>
                    <span className="font-mono text-xs text-slate-500">{p.code}</span>
                    <br />
                    {p.description}
                  </span>
                </label>
              ))}
            </div>
            <button type="button" onClick={saveRolePerms} className="rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white">
              Simpan hak akses role ini
            </button>
          </>
        )}
      </div>

      <Modal open={!!userModal} title={userModal === "create" ? "Pengguna baru" : "Edit pengguna"} onClose={() => setUserModal(null)}>
        <form className="space-y-3" onSubmit={saveUser}>
          <div>
            <label className="text-xs text-slate-500">Nama</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={uf.name}
              onChange={(e) => setUf((x) => ({ ...x, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Email</label>
            <input
              type="email"
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={uf.email}
              onChange={(e) => setUf((x) => ({ ...x, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">{userModal === "create" ? "Password" : "Password baru (opsional)"}</label>
            <input
              type="password"
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={uf.password}
              onChange={(e) => setUf((x) => ({ ...x, password: e.target.value }))}
              placeholder={userModal === "create" ? "Wajib" : "Kosongkan jika tidak diubah"}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Role</label>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
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
          {userModal === "edit" ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={uf.is_active} onChange={(e) => setUf((x) => ({ ...x, is_active: e.target.checked }))} />
              Akun aktif
            </label>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-xl border px-4 py-2" onClick={() => setUserModal(null)}>
              Batal
            </button>
            <button type="submit" className="rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white">
              Simpan
            </button>
          </div>
        </form>
      </Modal>
    </PageStack>
  );
}
