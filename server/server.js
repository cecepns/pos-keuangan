/**
 * POS Keuangan - Backend tunggal (Express + MySQL)
 * Jalankan dari folder server: npm install && cp .env.example .env && npm start
 */
// require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const PORT = 8080;
const JWT_SECRET = "dev-insecure-secret-change-me";
const JWT_EXPIRES_IN = "360d";
const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** Hapus file gambar produk di disk (path DB seperti /uploads/namafile.jpg) */
function unlinkProductImageFile(imagePathRel) {
  if (!imagePathRel || typeof imagePathRel !== "string") return;
  const rel = imagePathRel.trim();
  if (!rel.startsWith("/uploads/")) return;
  const base = path.basename(rel);
  if (!base || base.includes("..") || base.includes("/") || base.includes("\\")) return;
  const abs = path.resolve(UPLOAD_DIR, base);
  if (!abs.startsWith(path.resolve(UPLOAD_DIR))) return;
  fs.unlink(abs, () => { });
}

const pool = mysql.createPool({
  host: "localhost",
  user: "sekt3835_sekargumilang",
  password: "sekt3835_sekargumilang",
  database: "sekt3835_sekargumilang",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "20mb" }));


const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `prod_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) return cb(new Error("Hanya gambar"));
    cb(null, true);
  },
});

app.use("/uploads", express.static(UPLOAD_DIR));

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Semua GET daftar tabel: maksimal 10 baris per halaman (override limit dibatasi) */
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

function listPagination(req) {
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const raw = parseInt(String(req.query.limit ?? String(DEFAULT_PAGE_SIZE)), 10);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/** Pagination katalog admin — selalu izinkan hingga 100 baris (tidak terikat cap global lama) */
function catalogListPagination(req) {
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const raw = parseInt(String(req.query.limit ?? String(DEFAULT_PAGE_SIZE)), 10);
  const limit = Math.min(100, Math.max(1, Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function generateInvoiceNo() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV${y}${m}${day}${rnd}`;
}

async function getPermissionsForRole(roleId) {
  const [rows] = await pool.query(
    `SELECT p.code FROM role_permissions rp INNER JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?`,
    [roleId]
  );
  return rows.map((r) => r.code);
}

async function getUserWithRole(userId) {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role_id, u.store_id, r.name AS role_name
     FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? AND u.is_active = 1`,
    [userId]
  );
  const u = rows[0];
  if (!u) return null;
  u.permissions = await getPermissionsForRole(u.role_id);
  return u;
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role_name, role_id: user.role_id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

async function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }
  try {
    const payload = jwt.verify(h.slice(7), JWT_SECRET);
    const u = await getUserWithRole(payload.sub);
    if (!u) {
      req.user = null;
      return next();
    }
    req.user = u;
    next();
  } catch {
    req.user = null;
    next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  next();
}

/** admin: semua | kasir: operasional | owner: laporan & keuangan */
function requireRoles(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const r = req.user.role_name;
    if (allowed.includes("admin") && r === "admin") return next();
    if (allowed.includes(r)) return next();
    return res.status(403).json({ error: "Forbidden" });
  };
}

/** POS & penjualan: admin, kasir, owner (owner boleh akses baca/transaksi lapangan jika diperlukan) */
function kasirOrAdmin(req, res, next) {
  return requireRoles("admin", "kasir", "owner")(req, res, next);
}

function ownerOrAdmin(req, res, next) {
  return requireRoles("admin", "owner")(req, res, next);
}

/** Laporan: admin/owner, atau role lain dengan izin menu `reports` (selaras PermGate + sidebar). */
function reportsOrOwnerAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const r = req.user.role_name;
  if (r === "admin" || r === "owner") return next();
  const perms = req.user.permissions || [];
  if (perms.includes("all") || perms.includes("reports")) return next();
  return res.status(403).json({ error: "Forbidden" });
}

/** Role dengan salah satu izin menu (atau admin/owner). */
function permOrOwnerAdmin(...codes) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const r = req.user.role_name;
    if (r === "admin" || r === "owner") return next();
    const perms = req.user.permissions || [];
    if (perms.includes("all") || codes.some((c) => perms.includes(c))) return next();
    return res.status(403).json({ error: "Forbidden" });
  };
}

/** Cash flow: admin/owner, atau izin menu `cashflow` (selaras PermGate + UsersPage). */
function cashflowOrOwnerAdmin(req, res, next) {
  return permOrOwnerAdmin("cashflow")(req, res, next);
}

/** Pengguna & mapping izin role: admin, atau non-admin dengan izin `users`. */
function adminOrUsersPerm(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.user.role_name === "admin") return next();
  const perms = req.user.permissions || [];
  if (perms.includes("all") || perms.includes("users")) return next();
  return res.status(403).json({ error: "Forbidden" });
}

app.use(authMiddleware);

app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) return res.status(400).json({ error: "Email dan password wajib" });
    const [rows] = await pool.query(
      `SELECT u.*, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ?`,
      [email]
    );
    const user = rows[0];
    if (!user || !user.is_active) return res.status(401).json({ error: "Kredensial salah" });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Kredensial salah" });
    await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [user.id]);
    const token = signToken(user);
    delete user.password_hash;
    user.permissions = await getPermissionsForRole(user.role_id);
    res.json({ token, user });
  })
);

app.get(
  "/api/auth/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const u = await getUserWithRole(req.user.id);
    res.json(u);
  })
);

app.get(
  "/api/users",
  requireAuth,
  adminOrUsersPerm,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    const q = String(req.query.q || "").trim();
    let where = "WHERE 1=1";
    const params = [];
    if (q) {
      where += " AND (u.name LIKE ? OR u.email LIKE ?)";
      const qq = `%${q}%`;
      params.push(qq, qq);
    }
    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS u.id, u.name, u.email, u.role_id, u.store_id, u.is_active, r.name AS role_name
       FROM users u JOIN roles r ON r.id = u.role_id ${where} ORDER BY u.id LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({ data: rows, total, page, limit });
  })
);

app.post(
  "/api/users",
  requireAuth,
  adminOrUsersPerm,
  asyncHandler(async (req, res) => {
    const { name, email, password, role_id, store_id } = req.body;
    if (!name || !email || !password || !role_id) return res.status(400).json({ error: "Data tidak lengkap" });
    if (Number(role_id) === 1 && req.user.role_name !== "admin") {
      return res.status(403).json({ error: "Hanya admin yang boleh menambah pengguna dengan role admin" });
    }
    const hash = await bcrypt.hash(String(password), 10);
    const [r] = await pool.query(`INSERT INTO users (role_id, store_id, name, email, password_hash) VALUES (?,?,?,?,?)`, [
      role_id,
      store_id || null,
      name,
      String(email).toLowerCase(),
      hash,
    ]);
    res.status(201).json({ id: r.insertId });
  })
);

app.put(
  "/api/users/:id",
  requireAuth,
  adminOrUsersPerm,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { name, email, role_id, store_id, is_active, password } = req.body;
    if (!name || !email || !role_id) return res.status(400).json({ error: "Nama, email, dan role wajib" });
    if (Number(role_id) === 1 && req.user.role_name !== "admin") {
      return res.status(403).json({ error: "Hanya admin yang boleh menetapkan role admin" });
    }
    if (req.user.role_name !== "admin") {
      const [[existing]] = await pool.query(`SELECT role_id FROM users WHERE id=?`, [id]);
      if (!existing) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
      if (Number(existing.role_id) === 1) {
        return res.status(403).json({ error: "Hanya admin yang boleh mengubah akun admin" });
      }
    }
    const fields = [`name=?`, `email=?`, `role_id=?`, `store_id=?`, `is_active=?`];
    const vals = [name, String(email).toLowerCase(), role_id, store_id || null, is_active === false ? 0 : 1];
    if (password && String(password).length >= 4) {
      fields.push(`password_hash=?`);
      vals.push(await bcrypt.hash(String(password), 10));
    }
    vals.push(id);
    await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id=?`, vals);
    res.json({ ok: true });
  })
);

app.delete(
  "/api/users/:id",
  requireAuth,
  adminOrUsersPerm,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "ID tidak valid" });
    if (id === req.user.id) return res.status(400).json({ error: "Tidak dapat menghapus akun sendiri" });

    const [[u]] = await pool.query(`SELECT id, role_id FROM users WHERE id=?`, [id]);
    if (!u) return res.status(404).json({ error: "Pengguna tidak ditemukan" });

    if (Number(u.role_id) === 1 && req.user.role_name !== "admin") {
      return res.status(403).json({ error: "Hanya admin yang boleh menghapus akun admin" });
    }

    if (Number(u.role_id) === 1) {
      const [[{ c }]] = await pool.query(`SELECT COUNT(*) AS c FROM users WHERE role_id = 1`);
      if (Number(c) <= 1) return res.status(400).json({ error: "Tidak dapat menghapus admin terakhir" });
    }

    const [[{ tx }]] = await pool.query(`SELECT COUNT(*) AS tx FROM transactions WHERE user_id=?`, [id]);
    if (Number(tx) > 0) {
      return res.status(409).json({
        error: "Pengguna punya riwayat transaksi. Nonaktifkan akun jika tidak perlu login lagi.",
      });
    }

    await pool.query(`DELETE FROM users WHERE id=?`, [id]);
    res.json({ ok: true });
  })
);

app.get(
  "/api/permissions",
  requireAuth,
  adminOrUsersPerm,
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(`SELECT id, code, description FROM permissions ORDER BY code`);
    res.json({ data: rows });
  })
);

app.get(
  "/api/roles/:id/permissions",
  requireAuth,
  adminOrUsersPerm,
  asyncHandler(async (req, res) => {
    const roleId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT p.id, p.code, p.description FROM role_permissions rp
       INNER JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ? ORDER BY p.code`,
      [roleId]
    );
    res.json({ data: rows });
  })
);

app.put(
  "/api/roles/:id/permissions",
  requireAuth,
  adminOrUsersPerm,
  asyncHandler(async (req, res) => {
    const roleId = Number(req.params.id);
    if (roleId === 1 && req.user.role_name !== "admin") {
      return res.status(403).json({ error: "Hanya admin yang boleh mengubah izin role admin" });
    }
    const codes = Array.isArray(req.body.codes) ? req.body.codes.map(String) : [];
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      if (roleId === 1) {
        await conn.query(`DELETE FROM role_permissions WHERE role_id=?`, [roleId]);
        await conn.query(`INSERT INTO role_permissions (role_id, permission_id) SELECT 1, id FROM permissions WHERE code='all'`);
      } else {
        await conn.query(`DELETE FROM role_permissions WHERE role_id=?`, [roleId]);
        for (const code of codes) {
          const [p] = await conn.query(`SELECT id FROM permissions WHERE code=? LIMIT 1`, [code]);
          if (p.length) await conn.query(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?,?)`, [roleId, p[0].id]);
        }
      }
      await conn.commit();
      res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      res.status(400).json({ error: e.message });
    } finally {
      conn.release();
    }
  })
);

app.get(
  "/api/roles",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    const q = String(req.query.q || "").trim();
    let where = "WHERE 1=1";
    const params = [];
    if (q) {
      where += " AND (name LIKE ? OR description LIKE ?)";
      const qq = `%${q}%`;
      params.push(qq, qq);
    }
    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS id, name, description FROM roles ${where} ORDER BY id LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({ data: rows, total, page, limit });
  })
);

/** Rentang tanggal dashboard: ?from=&to= (YYYY-MM-DD), maks 366 hari. */
function dashboardDateRange(query) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  let f = re.test(String(query.from || "")) ? String(query.from).slice(0, 10) : null;
  let t = re.test(String(query.to || "")) ? String(query.to).slice(0, 10) : null;
  if (!f && !t) return null;
  if (f && !t) t = f;
  if (t && !f) f = t;
  if (!f || !t) return null;
  if (f > t) [f, t] = [t, f];
  const dayCount =
    Math.round((new Date(`${t}T12:00:00`).getTime() - new Date(`${f}T12:00:00`).getTime()) / 86400000) + 1;
  if (dayCount > 366) return null;
  return { from: f, to: t, dayCount };
}

function addCalendarDaysIso(iso, deltaDays) {
  const [yy, mm, dd] = iso.split("-").map(Number);
  const d = new Date(yy, mm - 1, dd);
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

app.get(
  "/api/dashboard/summary",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const role = req.user.role_name;
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const d = today.getDate();
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    const range = dashboardDateRange(req.query);
    const dateExpr = "COALESCE(sale_date, DATE(created_at))";

    let todaySales;
    let monthCompare;

    if (range) {
      const prevEnd = addCalendarDaysIso(range.from, -1);
      const prevStart = addCalendarDaysIso(range.from, -range.dayCount);
      const [[ts]] = await pool.query(
        `SELECT COALESCE(SUM(grand_total),0) AS omzet,
                COALESCE(SUM(total_profit),0) AS profit,
                COUNT(*) AS trx_count,
                COALESCE(SUM((SELECT SUM(qty) FROM transaction_items ti WHERE ti.transaction_id = transactions.id)),0) AS items_sold
         FROM transactions WHERE status='completed' AND ${dateExpr} BETWEEN ? AND ?`,
        [range.from, range.to]
      );
      todaySales = ts;

      const [[mc]] = await pool.query(
        `SELECT
          COALESCE(SUM(CASE WHEN ${dateExpr} BETWEEN ? AND ? THEN grand_total END),0) AS omzet_now,
          COALESCE(SUM(CASE WHEN ${dateExpr} BETWEEN ? AND ? THEN grand_total END),0) AS omzet_prev,
          COALESCE(SUM(CASE WHEN ${dateExpr} BETWEEN ? AND ? THEN total_margin END),0) AS margin_now,
          COALESCE(SUM(CASE WHEN ${dateExpr} BETWEEN ? AND ? THEN total_margin END),0) AS margin_prev
         FROM transactions WHERE status='completed'`,
        [range.from, range.to, prevStart, prevEnd, range.from, range.to, prevStart, prevEnd]
      );
      monthCompare = mc;
    } else {
      const [[ts]] = await pool.query(
        `SELECT COALESCE(SUM(grand_total),0) AS omzet,
                COALESCE(SUM(total_profit),0) AS profit,
                COUNT(*) AS trx_count,
                COALESCE(SUM((SELECT SUM(qty) FROM transaction_items ti WHERE ti.transaction_id = transactions.id)),0) AS items_sold
         FROM transactions WHERE status='completed' AND ${dateExpr} = ?`,
        [dateStr]
      );
      todaySales = ts;

      const [[mc]] = await pool.query(
        `SELECT
        COALESCE(SUM(CASE WHEN YEAR(COALESCE(sale_date, created_at))=YEAR(CURDATE()) AND MONTH(COALESCE(sale_date, created_at))=MONTH(CURDATE()) THEN grand_total END),0) AS omzet_now,
        COALESCE(SUM(CASE WHEN YEAR(COALESCE(sale_date, created_at))=YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND MONTH(COALESCE(sale_date, created_at))=MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) THEN grand_total END),0) AS omzet_prev,
        COALESCE(SUM(CASE WHEN YEAR(COALESCE(sale_date, created_at))=YEAR(CURDATE()) AND MONTH(COALESCE(sale_date, created_at))=MONTH(CURDATE()) THEN total_margin END),0) AS margin_now,
        COALESCE(SUM(CASE WHEN YEAR(COALESCE(sale_date, created_at))=YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND MONTH(COALESCE(sale_date, created_at))=MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) THEN total_margin END),0) AS margin_prev
       FROM transactions WHERE status='completed'`
      );
      monthCompare = mc;
    }

    let cashFlow = { in: 0, out: 0 };
    let debtSummary = { piutang: 0, hutang: 0 };
    let lowStock = [];
    let bestSeller = [];

    if (role !== "kasir" || true) {
      const cfParams = range ? [range.from, range.to] : [dateStr];
      const cfWhere = range ? "flow_date BETWEEN ? AND ?" : "flow_date = ?";
      const [[cf]] = await pool.query(
        `SELECT
          COALESCE(SUM(CASE WHEN type IN ('in','transfer_in') THEN amount END),0) AS cin,
          COALESCE(SUM(CASE WHEN type IN ('out','transfer_out') THEN amount END),0) AS cout
         FROM cash_flows WHERE ${cfWhere}`,
        cfParams
      );
      cashFlow = { in: Number(cf.cin), out: Number(cf.cout) };

      const [[recv]] = await pool.query(`SELECT COALESCE(SUM(balance),0) AS b FROM receivables WHERE status IN ('open','partial','overdue')`);
      const [[pay]] = await pool.query(`SELECT COALESCE(SUM(balance),0) AS b FROM payables WHERE status IN ('open','partial','overdue')`);
      debtSummary = { piutang: Number(recv.b), hutang: Number(pay.b) };

      const [ls] = await pool.query(
        `SELECT id, sku, name, stock, min_stock FROM products WHERE is_active=1 AND stock <= min_stock ORDER BY stock ASC LIMIT 10`
      );
      lowStock = ls;

      if (range) {
        const [bs] = await pool.query(
          `SELECT p.id, p.name, SUM(ti.qty) AS qty, SUM(ti.line_total) AS revenue
           FROM transaction_items ti
           JOIN products p ON p.id = ti.product_id
           JOIN transactions t ON t.id = ti.transaction_id
           WHERE t.status='completed'
             AND COALESCE(t.sale_date, DATE(t.created_at)) BETWEEN ? AND ?
           GROUP BY p.id ORDER BY qty DESC LIMIT 8`,
          [range.from, range.to]
        );
        bestSeller = bs;
      } else {
        const [bs] = await pool.query(
          `SELECT p.id, p.name, SUM(ti.qty) AS qty, SUM(ti.line_total) AS revenue
         FROM transaction_items ti
         JOIN products p ON p.id = ti.product_id
         JOIN transactions t ON t.id = ti.transaction_id
         WHERE t.status='completed'
           AND YEAR(COALESCE(t.sale_date, t.created_at)) = YEAR(CURDATE())
           AND MONTH(COALESCE(t.sale_date, t.created_at)) = MONTH(CURDATE())
         GROUP BY p.id ORDER BY qty DESC LIMIT 8`
        );
        bestSeller = bs;
      }
    }

    let salesSeries;
    let profitSeries;
    if (range) {
      const [ss] = await pool.query(
        `SELECT COALESCE(sale_date, DATE(created_at)) AS d, SUM(grand_total) AS total
         FROM transactions WHERE status='completed' AND ${dateExpr} BETWEEN ? AND ?
         GROUP BY COALESCE(sale_date, DATE(created_at)) ORDER BY d`,
        [range.from, range.to]
      );
      salesSeries = ss;
      const [ps] = await pool.query(
        `SELECT COALESCE(sale_date, DATE(created_at)) AS d, SUM(total_profit) AS total
         FROM transactions WHERE status='completed' AND ${dateExpr} BETWEEN ? AND ?
         GROUP BY COALESCE(sale_date, DATE(created_at)) ORDER BY d`,
        [range.from, range.to]
      );
      profitSeries = ps;
    } else {
      const [ss] = await pool.query(
        `SELECT COALESCE(sale_date, DATE(created_at)) AS d, SUM(grand_total) AS total
       FROM transactions WHERE status='completed' AND COALESCE(sale_date, DATE(created_at)) >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
       GROUP BY COALESCE(sale_date, DATE(created_at)) ORDER BY d`
      );
      salesSeries = ss;
      const [ps] = await pool.query(
        `SELECT COALESCE(sale_date, DATE(created_at)) AS d, SUM(total_profit) AS total
       FROM transactions WHERE status='completed' AND COALESCE(sale_date, DATE(created_at)) >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
       GROUP BY COALESCE(sale_date, DATE(created_at)) ORDER BY d`
      );
      profitSeries = ps;
    }

    const kasirSimple = role === "kasir";

    res.json({
      filter: range ? { from: range.from, to: range.to } : null,
      today: {
        omzet: Number(todaySales.omzet),
        profit: Number(todaySales.profit),
        transactions: Number(todaySales.trx_count),
        itemsSold: Number(todaySales.items_sold),
      },
      compareMonth: {
        omzetNow: Number(monthCompare.omzet_now),
        omzetPrev: Number(monthCompare.omzet_prev),
        marginNow: Number(monthCompare.margin_now),
        marginPrev: Number(monthCompare.margin_prev),
      },
      cashFlow: kasirSimple ? undefined : cashFlow,
      debt: kasirSimple ? undefined : debtSummary,
      lowStock: kasirSimple ? [] : lowStock,
      bestSeller: kasirSimple ? bestSeller.slice(0, 5) : bestSeller,
      charts: kasirSimple
        ? { sales: salesSeries, profit: profitSeries }
        : { sales: salesSeries, profit: profitSeries },
    });
  })
);

app.get(
  "/api/categories",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    const q = String(req.query.q || "").trim();
    let where = "WHERE 1=1";
    const params = [];
    if (q) {
      where += " AND (name LIKE ? OR slug LIKE ?)";
      const qq = `%${q}%`;
      params.push(qq, qq);
    }
    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS * FROM categories ${where} ORDER BY name LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({ data: rows, total, page, limit });
  })
);

app.post(
  "/api/categories",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Nama wajib" });
    const code = req.body.code != null ? String(req.body.code).trim() || null : null;
    const [r] = await pool.query(`INSERT INTO categories (name, code, slug) VALUES (?, ?, ?)`, [
      name,
      code,
      name.toLowerCase().replace(/\s+/g, "-"),
    ]);
    res.status(201).json({ id: r.insertId });
  })
);

app.put(
  "/api/categories/:id",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const code = req.body.code != null ? String(req.body.code).trim() || null : null;
    await pool.query(`UPDATE categories SET name=?, code=? WHERE id=?`, [req.body.name, code, req.params.id]);
    res.json({ ok: true });
  })
);

app.delete(
  "/api/categories/:id",
  requireAuth,
  requireRoles("admin"),
  asyncHandler(async (req, res) => {
    await pool.query(`DELETE FROM categories WHERE id=?`, [req.params.id]);
    res.json({ ok: true });
  })
);

app.get(
  "/api/income-categories",
  requireAuth,
  cashflowOrOwnerAdmin,
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(`SELECT id, name FROM income_categories ORDER BY name`);
    res.json({ data: rows });
  })
);

app.get(
  "/api/expense-categories",
  requireAuth,
  permOrOwnerAdmin("cashflow", "expenses", "expense_categories"),
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(`SELECT id, name, type FROM expense_categories ORDER BY name`);
    res.json({ data: rows });
  })
);

app.post(
  "/api/expense-categories",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Nama kategori wajib" });
    const type = String(req.body.type || "operational").trim() || "operational";
    const [r] = await pool.query(`INSERT INTO expense_categories (name, type) VALUES (?,?)`, [name, type]);
    res.status(201).json({ id: r.insertId });
  })
);

app.put(
  "/api/expense-categories/:id",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Nama wajib" });
    const type = String(req.body.type || "operational").trim() || "operational";
    await pool.query(`UPDATE expense_categories SET name=?, type=? WHERE id=?`, [name, type, req.params.id]);
    res.json({ ok: true });
  })
);

app.delete(
  "/api/expense-categories/:id",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    await pool.query(`DELETE FROM expense_categories WHERE id=?`, [req.params.id]);
    res.json({ ok: true });
  })
);

app.get(
  "/api/products",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const { page, limit, offset } = listPagination(req);
    let where = "WHERE 1=1";
    const params = [];
    if (q) {
      where += " AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)";
      const qq = `%${q}%`;
      params.push(qq, qq, qq);
    }
    if (req.query.active !== undefined) {
      where += " AND p.is_active = ?";
      params.push(Number(req.query.active));
    }
    if (req.query.low_stock === "1" || req.query.low_stock === "true") {
      where += " AND p.stock <= p.min_stock AND p.is_active = 1";
    }
    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS p.*,
        (SELECT GROUP_CONCAT(c.name) FROM product_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.product_id=p.id) AS categories,
        (SELECT COALESCE(SUM(ti.qty),0) FROM transaction_items ti
           INNER JOIN transactions t ON t.id = ti.transaction_id
           WHERE ti.product_id = p.id AND t.status = 'completed') AS qty_sold
       FROM products p ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);

    const productIds = rows.map((r) => r.id);
    let units = [];
    let prices = [];
    if (productIds.length > 0) {
      const [uRows] = await pool.query(`SELECT * FROM product_units WHERE product_id IN (?)`, [productIds]);
      units = uRows;
      const [pRows] = await pool.query(`SELECT * FROM product_prices WHERE product_id IN (?)`, [productIds]);
      prices = pRows;
    }

    const data = rows.map((p) => ({
      ...p,
      units: units.filter((u) => u.product_id === p.id),
      prices: prices.filter((pr) => pr.product_id === p.id),
    }));

    res.json({ data, total, page, limit });
  })
);

app.get(
  "/api/products/:id",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`SELECT * FROM products WHERE id=?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const [cats] = await pool.query(
      `SELECT c.id, c.name FROM product_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.product_id=?`,
      [req.params.id]
    );
    const [units] = await pool.query(`SELECT * FROM product_units WHERE product_id=?`, [req.params.id]);
    const [prices] = await pool.query(`SELECT * FROM product_prices WHERE product_id=?`, [req.params.id]);
    res.json({ ...rows[0], category_ids: cats.map((c) => c.id), units, prices });
  })
);

async function saveProductUnitsAndPrices(productId, baseUnitName, units, prices, conn) {
  await conn.query(`DELETE FROM product_prices WHERE product_id = ?`, [productId]);
  await conn.query(`DELETE FROM product_units WHERE product_id = ?`, [productId]);

  const unitNameToIdMap = {};

  if (Array.isArray(units)) {
    for (const u of units) {
      const [r] = await conn.query(
        `INSERT INTO product_units (product_id, unit_name, conversion_value, purchase_price, sell_price, barcode)
         VALUES (?,?,?,?,?,?)`,
        [
          productId,
          String(u.unit_name || "").trim(),
          Number(u.conversion_value || 1),
          Number(u.purchase_price || 0),
          Number(u.sell_price || 0),
          u.barcode ? String(u.barcode).trim() : null
        ]
      );
      unitNameToIdMap[String(u.unit_name).trim().toLowerCase()] = r.insertId;
    }
  }

  if (Array.isArray(prices)) {
    for (const pr of prices) {
      const uName = String(pr.unit_name || "").trim().toLowerCase();
      let unitId = null;
      if (uName && uName !== String(baseUnitName || "").trim().toLowerCase()) {
        unitId = unitNameToIdMap[uName] || null;
      }
      await conn.query(
        `INSERT INTO product_prices (product_id, product_unit_id, customer_category, price)
         VALUES (?,?,?,?)`,
        [
          productId,
          unitId,
          String(pr.customer_category || "umum").trim(),
          Number(pr.price || 0)
        ]
      );
    }
  }
}

app.post(
  "/api/products",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const sku = String(b.sku || "").trim() || `SKU-${Date.now()}`;
    let barcode = b.barcode ? String(b.barcode).trim() : null;
    if (!barcode) barcode = `899${String(Date.now()).slice(-9)}`;
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      const [r] = await conn.query(
        `INSERT INTO products (sku, barcode, name, description, supplier_id, purchase_price, sell_price, stock, min_stock, unit, location, brand, is_active)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          sku,
          barcode,
          b.name,
          b.description || null,
          b.supplier_id || null,
          Number(b.purchase_price || 0),
          Number(b.sell_price || 0),
          Number(b.stock || 0),
          Number(b.min_stock || 0),
          String(b.unit || "PCS").trim() || "PCS",
          b.location != null ? String(b.location).trim() || null : null,
          b.brand != null ? String(b.brand).trim() || null : null,
          b.is_active === false ? 0 : 1,
        ]
      );
      const pid = r.insertId;
      if (Array.isArray(b.category_ids)) {
        for (const cid of b.category_ids) {
          await conn.query(`INSERT IGNORE INTO product_categories (product_id, category_id) VALUES (?,?)`, [pid, cid]);
        }
      }
      
      await saveProductUnitsAndPrices(pid, b.unit || "PCS", b.units, b.prices, conn);
      
      await conn.commit();
      res.status(201).json({ id: pid, barcode });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

app.put(
  "/api/products/:id",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const stockPart =
      b.stock !== undefined && b.stock !== null && String(b.stock).trim() !== ""
        ? ", stock=?"
        : "";
    const params = [
      b.sku,
      b.barcode,
      b.name,
      b.description || null,
      b.supplier_id || null,
      b.purchase_price,
      b.sell_price,
      b.min_stock,
      String(b.unit || "PCS").trim() || "PCS",
      b.location != null ? String(b.location).trim() || null : null,
      b.brand != null ? String(b.brand).trim() || null : null,
      b.is_active ? 1 : 0,
    ];
    if (stockPart) params.push(Number(b.stock));
    params.push(req.params.id);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `UPDATE products SET sku=?, barcode=?, name=?, description=?, supplier_id=?, purchase_price=?, sell_price=?,
         min_stock=?, unit=?, location=?, brand=?, is_active=?${stockPart} WHERE id=?`,
        params
      );
      await conn.query(`DELETE FROM product_categories WHERE product_id=?`, [req.params.id]);
      if (Array.isArray(b.category_ids)) {
        for (const cid of b.category_ids) {
          await conn.query(`INSERT INTO product_categories (product_id, category_id) VALUES (?,?)`, [req.params.id, cid]);
        }
      }

      await saveProductUnitsAndPrices(req.params.id, b.unit || "PCS", b.units, b.prices, conn);

      await conn.commit();
      res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

app.delete(
  "/api/products/:id",
  requireAuth,
  requireRoles("admin"),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`SELECT image_path FROM products WHERE id=?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Produk tidak ada" });
    const prev = rows[0].image_path;
    await pool.query(`DELETE FROM products WHERE id=?`, [req.params.id]);
    unlinkProductImageFile(prev);
    res.json({ ok: true });
  })
);

app.delete(
  "/api/products/:id/image",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`SELECT image_path FROM products WHERE id=?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Produk tidak ada" });
    const prev = rows[0].image_path;
    await pool.query(`UPDATE products SET image_path=NULL WHERE id=?`, [req.params.id]);
    unlinkProductImageFile(prev);
    res.json({ ok: true });
  })
);

app.post(
  "/api/products/:id/image",
  requireAuth,
  requireRoles("admin", "owner"),
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "File wajib" });
    const [rows] = await pool.query(`SELECT image_path FROM products WHERE id=?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Produk tidak ada" });
    const prev = rows[0].image_path;
    const rel = `/uploads/${req.file.filename}`;
    await pool.query(`UPDATE products SET image_path=? WHERE id=?`, [rel, req.params.id]);
    unlinkProductImageFile(prev);
    res.json({ path: rel });
  })
);

app.post(
  "/api/stock-movements",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const { product_id, type, qty, notes } = req.body;
    if (!product_id || !type || qty === undefined || qty === null || qty === "")
      return res.status(400).json({ error: "Data tidak lengkap" });
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const raw = Number(qty);
      let delta;
      let qtyStored;
      if (type === "adjustment") {
        delta = raw;
        qtyStored = raw;
      } else {
        const sign = type === "in" || type === "purchase" ? 1 : type === "out" || type === "sale" ? -1 : raw >= 0 ? 1 : -1;
        qtyStored = Math.abs(raw);
        delta = qtyStored * sign;
      }
      await conn.query(`INSERT INTO stock_movements (product_id, type, qty, notes, created_by) VALUES (?,?,?,?,?)`, [
        product_id,
        type,
        qtyStored,
        notes || null,
        req.user.id,
      ]);
      await conn.query(`UPDATE products SET stock = stock + ? WHERE id=?`, [delta, product_id]);
      await conn.commit();
      res.status(201).json({ ok: true });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

app.post(
  "/api/stock/physical-adjust",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const product_id = Number(req.body.product_id);
    const actual = Number(req.body.actual_stock);
    const notes = req.body.notes != null ? String(req.body.notes).trim() : "";
    if (!product_id || Number.isNaN(actual) || actual < 0) return res.status(400).json({ error: "Data tidak valid" });
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [pr] = await conn.query(`SELECT id, stock, name FROM products WHERE id=? FOR UPDATE`, [product_id]);
      if (!pr.length) throw new Error("Produk tidak ada");
      const current = Number(pr[0].stock);
      const delta = actual - current;
      await conn.query(`UPDATE products SET stock=? WHERE id=?`, [actual, product_id]);
      if (delta !== 0) {
        await conn.query(`INSERT INTO stock_movements (product_id, type, qty, notes, created_by) VALUES (?,?,?,?,?)`, [
          product_id,
          "adjustment",
          delta,
          notes || `Penyesuaian fisik (${current} → ${actual})`,
          req.user.id,
        ]);
      }
      await conn.commit();
      res.status(201).json({ ok: true, stock: actual, delta });
    } catch (e) {
      await conn.rollback();
      res.status(400).json({ error: e.message || "Gagal" });
    } finally {
      conn.release();
    }
  })
);

app.get(
  "/api/stock-movements",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    const q = String(req.query.q || "").trim();
    let where = "WHERE 1=1";
    const params = [];
    if (q) {
      where += " AND (p.name LIKE ? OR sm.type LIKE ? OR sm.notes LIKE ?)";
      const qq = `%${q}%`;
      params.push(qq, qq, qq);
    }
    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS sm.*, p.name AS product_name FROM stock_movements sm JOIN products p ON p.id=sm.product_id
       ${where} ORDER BY sm.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({ data: rows, total, page, limit });
  })
);

app.get(
  "/api/customers",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const { page, limit, offset } = listPagination(req);
    let where = "WHERE 1=1";
    const params = [];
    if (q) {
      where += " AND (name LIKE ? OR whatsapp LIKE ?)";
      const qq = `%${q}%`;
      params.push(qq, qq);
    }
    const [rows] = await pool.query(`SELECT SQL_CALC_FOUND_ROWS * FROM customers ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [
      ...params,
      limit,
      offset,
    ]);
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({ data: rows, total, page, limit });
  })
);

app.post(
  "/api/customers",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const b = req.body;
    const [r] = await pool.query(
      `INSERT INTO customers (name, whatsapp, address, category, notes) VALUES (?,?,?,?,?)`,
      [b.name, b.whatsapp || null, b.address || null, b.category || "umum", b.notes || null]
    );
    res.status(201).json({ id: r.insertId });
  })
);

app.put(
  "/api/customers/:id",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const b = req.body;
    await pool.query(`UPDATE customers SET name=?, whatsapp=?, address=?, category=?, notes=? WHERE id=?`, [
      b.name,
      b.whatsapp,
      b.address,
      b.category,
      b.notes,
      req.params.id,
    ]);
    res.json({ ok: true });
  })
);

app.delete(
  "/api/customers/:id",
  requireAuth,
  requireRoles("admin"),
  asyncHandler(async (req, res) => {
    await pool.query(`DELETE FROM customers WHERE id=?`, [req.params.id]);
    res.json({ ok: true });
  })
);

app.get(
  "/api/suppliers",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const { page, limit, offset } = listPagination(req);
    let where = "WHERE 1=1";
    const params = [];
    if (q) {
      where += " AND name LIKE ?";
      params.push(`%${q}%`);
    }
    const [rows] = await pool.query(`SELECT SQL_CALC_FOUND_ROWS * FROM suppliers ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [
      ...params,
      limit,
      offset,
    ]);
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({ data: rows, total, page, limit });
  })
);

app.post(
  "/api/suppliers",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const b = req.body;
    const [r] = await pool.query(
      `INSERT INTO suppliers (name, contact_name, phone, whatsapp, email, address, category, notes) VALUES (?,?,?,?,?,?,?,?)`,
      [b.name, b.contact_name, b.phone, b.whatsapp, b.email, b.address, b.category, b.notes]
    );
    res.status(201).json({ id: r.insertId });
  })
);

app.put(
  "/api/suppliers/:id",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const b = req.body;
    await pool.query(
      `UPDATE suppliers SET name=?, contact_name=?, phone=?, whatsapp=?, email=?, address=?, category=?, notes=? WHERE id=?`,
      [b.name, b.contact_name, b.phone, b.whatsapp, b.email, b.address, b.category, b.notes, req.params.id]
    );
    res.json({ ok: true });
  })
);

app.delete(
  "/api/suppliers/:id",
  requireAuth,
  requireRoles("admin"),
  asyncHandler(async (req, res) => {
    await pool.query(`DELETE FROM suppliers WHERE id=?`, [req.params.id]);
    res.json({ ok: true });
  })
);

async function createPosTransaction(body, userId, conn) {
  const {
    customer_id,
    discount_total = 0,
    tax_percent = 0,
    notes,
    status = "completed",
    payments = [],
    items = [],
    sale_date: rawSaleDate,
  } = body;
  if (!Array.isArray(items) || !items.length) throw new Error("Item kosong");

  const sale_date =
    rawSaleDate && /^\d{4}-\d{2}-\d{2}$/.test(String(rawSaleDate))
      ? String(rawSaleDate).slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  let grossSubtotal = 0;
  let lineDiscountSum = 0;
  let totalCost = 0;
  let totalMargin = 0;
  const lineRows = [];

  for (const it of items) {
    const [pr] = await conn.query(`SELECT * FROM products WHERE id=? FOR UPDATE`, [it.product_id]);
    if (!pr.length) throw new Error(`Produk ${it.product_id} tidak ada`);
    const p = pr[0];
    const qty = Number(it.qty);
    const conv = Number(it.conversion_value || 1);
    const sell = Number(it.sell_price != null ? it.sell_price : (p.sell_price * conv));
    const purch = Number(it.purchase_price != null ? it.purchase_price : (p.purchase_price * conv));
    const disc = Math.max(0, Number(it.discount_amount || 0));
    const lineSub = sell * qty;
    const lineTotal = lineSub - disc;
    const marginLine = (sell - purch) * qty - disc;
    grossSubtotal += lineSub;
    lineDiscountSum += disc;
    totalCost += purch * qty;
    totalMargin += marginLine;
    lineRows.push({
      product_id: it.product_id,
      product_name: p.name,
      barcode: it.barcode || p.barcode,
      purchase_price: purch,
      sell_price: sell,
      qty,
      discount_amount: disc,
      subtotal: lineSub,
      line_total: lineTotal,
      margin_amount: marginLine,
      stock_available: p.stock,
      unit_name: String(it.unit_name || p.unit || "PCS"),
      conversion_value: conv,
    });
  }

  const headerDiscount = Math.max(0, Number(discount_total) || 0);
  const totalDiscount = lineDiscountSum + headerDiscount;
  const taxAmount = (grossSubtotal - totalDiscount) * (Number(tax_percent) / 100);
  const grandTotal = grossSubtotal - totalDiscount + taxAmount;
  const totalProfit = grandTotal - totalCost;

  const invoice_no = generateInvoiceNo();

  if (status === "completed") {
    const [setRows] = await conn.query(`SELECT value FROM settings WHERE \`key\` = 'allow_negative_stock'`);
    const allowNegativeStock = setRows[0]?.value === "1" || setRows[0]?.value === "true";

    for (const lr of lineRows) {
      const [pr] = await conn.query(`SELECT stock FROM products WHERE id=? FOR UPDATE`, [lr.product_id]);
      const deductQty = lr.qty * lr.conversion_value;
      if (!allowNegativeStock && pr[0].stock < deductQty) throw new Error(`Stok tidak cukup: ${lr.product_name}`);
    }
  }

  const [txr] = await conn.query(
    `INSERT INTO transactions (invoice_no, user_id, customer_id, status, subtotal, discount_total, tax_percent, tax_amount,
      grand_total, total_cost, total_margin, total_profit, notes, sale_date, paid_amount, change_amount)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      invoice_no,
      userId,
      customer_id || null,
      status,
      grossSubtotal,
      totalDiscount,
      Number(tax_percent),
      taxAmount,
      grandTotal,
      totalCost,
      totalMargin,
      totalProfit,
      notes || null,
      sale_date,
      0,
      0,
    ]
  );
  const txId = txr.insertId;

  for (const lr of lineRows) {
    await conn.query(
      `INSERT INTO transaction_items (transaction_id, product_id, product_name, barcode, purchase_price, sell_price, qty,
        discount_amount, subtotal, line_total, margin_amount, unit_name, conversion_value)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        txId,
        lr.product_id,
        lr.product_name,
        lr.barcode,
        lr.purchase_price,
        lr.sell_price,
        lr.qty,
        lr.discount_amount,
        lr.subtotal,
        lr.line_total,
        lr.margin_amount,
        lr.unit_name,
        lr.conversion_value,
      ]
    );
  }

  let paidSum = 0;
  let changeAmount = 0;
  if (status === "completed" && payments.length) {
    let remaining = grandTotal;
    const METHOD_ORDER = { cash: 1, transfer: 2, qris: 3, hutang: 4 };
    const ordered = [...payments]
      .filter((p) => Number(p.amount || 0) > 0)
      .sort((a, b) => (METHOD_ORDER[a.method] || 99) - (METHOD_ORDER[b.method] || 99));

    for (const pay of ordered) {
      const tendered = Number(pay.amount || 0);
      paidSum += tendered;
      const slice = Math.min(tendered, Math.max(remaining, 0));
      remaining -= slice;

      await conn.query(
        `INSERT INTO transaction_payments (transaction_id, method, amount, cash_account_id) VALUES (?,?,?,?)`,
        [txId, pay.method, tendered, pay.cash_account_id || null]
      );

      if (pay.method === "cash" && pay.cash_account_id && slice > 0) {
        await conn.query(`UPDATE cash_accounts SET balance = balance + ? WHERE id=?`, [slice, pay.cash_account_id]);
        await conn.query(
          `INSERT INTO cash_flows (cash_account_id, type, amount, description, flow_date, created_by, reference)
           VALUES (?,?,?,?,?,?,?)`,
          [pay.cash_account_id, "in", slice, `Penjualan ${invoice_no}`, sale_date, userId, `trx:${txId}`]
        );
      }
      if (pay.method === "transfer" && pay.cash_account_id && slice > 0) {
        await conn.query(`UPDATE cash_accounts SET balance = balance + ? WHERE id=?`, [slice, pay.cash_account_id]);
        await conn.query(
          `INSERT INTO cash_flows (cash_account_id, type, amount, description, flow_date, created_by, reference)
           VALUES (?,?,?,?,?,?,?)`,
          [pay.cash_account_id, "in", slice, `Transfer ${invoice_no}`, sale_date, userId, `trx:${txId}`]
        );
      }
      if (pay.method === "qris" && pay.cash_account_id && slice > 0) {
        await conn.query(`UPDATE cash_accounts SET balance = balance + ? WHERE id=?`, [slice, pay.cash_account_id]);
        await conn.query(
          `INSERT INTO cash_flows (cash_account_id, type, amount, description, flow_date, created_by, reference)
           VALUES (?,?,?,?,?,?,?)`,
          [pay.cash_account_id, "in", slice, `QRIS ${invoice_no}`, sale_date, userId, `trx:${txId}`]
        );
      }
      if (pay.method === "hutang") {
        const custId = customer_id;
        if (!custId) throw new Error("Customer wajib untuk pembayaran hutang/piutang");
        if (slice > 0) {
          await conn.query(
            `INSERT INTO receivables (customer_id, transaction_id, amount, paid_amount, balance, status)
             VALUES (?,?,?,?,?,'open')`,
            [custId, txId, slice, 0, slice]
          );
          await conn.query(`UPDATE customers SET balance_receivable = balance_receivable + ? WHERE id=?`, [slice, custId]);
        }
      }
    }

    if (remaining > 0.015) throw new Error("Total pembayaran kurang dari grand total");

    changeAmount = Math.max(0, paidSum - grandTotal);
    await conn.query(`UPDATE transactions SET paid_amount=?, change_amount=? WHERE id=?`, [paidSum, changeAmount, txId]);
  } else if (status === "completed" && grandTotal > 0.01) {
    throw new Error("Pembayaran wajib untuk menyelesaikan transaksi");
  }

  if (status === "completed") {
    for (const lr of lineRows) {
      const deductQty = lr.qty * lr.conversion_value;
      await conn.query(`UPDATE products SET stock = stock - ? WHERE id=?`, [deductQty, lr.product_id]);
      await conn.query(
        `INSERT INTO stock_movements (product_id, type, qty, reference_type, reference_id, created_by, notes)
         VALUES (?,'sale',?, 'transaction', ?, ?, ?)`,
        [lr.product_id, deductQty, txId, userId, `Sold ${lr.qty} ${lr.unit_name}`]
      );
    }
    if (customer_id) {
      await conn.query(`UPDATE customers SET total_purchase = total_purchase + ? WHERE id=?`, [grandTotal, customer_id]);
    }
  }

  return { id: txId, invoice_no, grand_total: grandTotal, change_amount: changeAmount };
}

/** Hapus transaksi selesai: balik kas (cash_flows trx:), stok, total belanja pelanggan; receivable harus lunas. */
async function voidCompletedTransaction(conn, txId, row, voidUserId) {
  const [[recv]] = await conn.query(
    `SELECT COALESCE(SUM(balance),0) AS b FROM receivables WHERE transaction_id=?`,
    [txId]
  );
  if (Number(recv.b) > 0.02) throw new Error("Masih ada sisa piutang — lunasi dulu atau gunakan refund.");

  const ref = `trx:${txId}`;
  const [flows] = await conn.query(`SELECT cash_account_id, amount FROM cash_flows WHERE reference=?`, [ref]);
  for (const f of flows) {
    await conn.query(`UPDATE cash_accounts SET balance = balance - ? WHERE id=?`, [Number(f.amount), f.cash_account_id]);
  }
  if (flows.length) await conn.query(`DELETE FROM cash_flows WHERE reference=?`, [ref]);

  await conn.query(`DELETE FROM receivables WHERE transaction_id=?`, [txId]);

  await conn.query(`DELETE FROM stock_movements WHERE reference_type IN ('transaction','refund') AND reference_id=?`, [txId]);

  const [items] = await conn.query(`SELECT * FROM transaction_items WHERE transaction_id=?`, [txId]);
  for (const it of items) {
    await conn.query(`UPDATE products SET stock = stock + ? WHERE id=?`, [it.qty, it.product_id]);
    await conn.query(
      `INSERT INTO stock_movements (product_id, type, qty, reference_type, reference_id, notes, created_by)
       VALUES (?,'adjustment',?, 'void_tx', ?, ?, ?)`,
      [it.product_id, it.qty, txId, `Hapus transaksi ${row.invoice_no}`, voidUserId]
    );
  }

  if (row.customer_id) {
    const gt = Number(row.grand_total);
    await conn.query(`UPDATE customers SET total_purchase = GREATEST(0, total_purchase - ?) WHERE id=?`, [gt, row.customer_id]);
  }

  await conn.query(`DELETE FROM transactions WHERE id=?`, [txId]);
}

/** Hapus transaksi sudah refund: stok sudah dikembalikan saat refund — hanya balik kas & total belanja. */
async function voidRefundedTransaction(conn, txId, row) {
  const [[recv]] = await conn.query(
    `SELECT COALESCE(SUM(balance),0) AS b FROM receivables WHERE transaction_id=?`,
    [txId]
  );
  if (Number(recv.b) > 0.02) throw new Error("Masih ada sisa piutang tercatat — tidak bisa hapus.");

  const ref = `trx:${txId}`;
  const [flows] = await conn.query(`SELECT cash_account_id, amount FROM cash_flows WHERE reference=?`, [ref]);
  for (const f of flows) {
    await conn.query(`UPDATE cash_accounts SET balance = balance - ? WHERE id=?`, [Number(f.amount), f.cash_account_id]);
  }
  if (flows.length) await conn.query(`DELETE FROM cash_flows WHERE reference=?`, [ref]);

  await conn.query(`DELETE FROM receivables WHERE transaction_id=?`, [txId]);
  await conn.query(`DELETE FROM stock_movements WHERE reference_type IN ('transaction','refund') AND reference_id=?`, [txId]);

  if (row.customer_id) {
    const gt = Number(row.grand_total);
    await conn.query(`UPDATE customers SET total_purchase = GREATEST(0, total_purchase - ?) WHERE id=?`, [gt, row.customer_id]);
  }

  await conn.query(`DELETE FROM transactions WHERE id=?`, [txId]);
}

app.post(
  "/api/transactions",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await createPosTransaction(req.body, req.user.id, conn);
      await conn.commit();
      res.status(201).json(result);
    } catch (e) {
      await conn.rollback();
      res.status(400).json({ error: e.message || "Gagal simpan transaksi" });
    } finally {
      conn.release();
    }
  })
);

app.get(
  "/api/transactions",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    const q = String(req.query.q || "").trim();
    let where = "WHERE 1=1";
    const params = [];
    if (q) {
      where += " AND (invoice_no LIKE ? OR notes LIKE ?)";
      params.push(`%${q}%`, `%${q}%`);
    }
    if (req.query.status) {
      where += " AND status=?";
      params.push(req.query.status);
    }
    if (req.query.from) {
      where += " AND COALESCE(t.sale_date, DATE(t.created_at)) >= ?";
      params.push(req.query.from);
    }
    if (req.query.to) {
      where += " AND COALESCE(t.sale_date, DATE(t.created_at)) <= ?";
      params.push(req.query.to);
    }
    if (String(req.query.owing || "") === "1") {
      where +=
        " AND t.status='completed' AND COALESCE((SELECT SUM(r3.balance) FROM receivables r3 WHERE r3.transaction_id = t.id), 0) > 0.015";
    }
    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS t.*, u.name AS cashier_name, c.name AS customer_name,
              COALESCE((SELECT SUM(r.balance) FROM receivables r WHERE r.transaction_id = t.id), 0) AS receivable_balance
       FROM transactions t
       JOIN users u ON u.id=t.user_id
       LEFT JOIN customers c ON c.id=t.customer_id
       ${where}
       ORDER BY t.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({ data: rows, total, page, limit });
  })
);

app.get(
  "/api/transactions/:id",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const [tx] = await pool.query(
      `SELECT t.*, u.name AS cashier_name, c.name AS customer_name, c.whatsapp AS customer_wa,
              COALESCE((SELECT SUM(r.amount) FROM receivables r WHERE r.transaction_id = t.id), 0) AS receivable_amount,
              COALESCE((SELECT SUM(r.paid_amount) FROM receivables r WHERE r.transaction_id = t.id), 0) AS receivable_paid_amount,
              COALESCE((SELECT SUM(r.balance) FROM receivables r WHERE r.transaction_id = t.id), 0) AS receivable_balance
       FROM transactions t
       JOIN users u ON u.id=t.user_id
       LEFT JOIN customers c ON c.id=t.customer_id
       WHERE t.id=?`,
      [req.params.id]
    );
    if (!tx.length) return res.status(404).json({ error: "Not found" });
    const [items] = await pool.query(`SELECT * FROM transaction_items WHERE transaction_id=?`, [req.params.id]);
    const [pays] = await pool.query(`SELECT * FROM transaction_payments WHERE transaction_id=?`, [req.params.id]);
    const [receivable_lines] = await pool.query(
      `SELECT id, amount, paid_amount, balance, status, due_date FROM receivables WHERE transaction_id=? ORDER BY id`,
      [req.params.id]
    );
    res.json({ ...tx[0], items, payments: pays, receivable_lines });
  })
);

app.delete(
  "/api/transactions/:id",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "ID tidak valid" });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [txRows] = await conn.query(`SELECT * FROM transactions WHERE id=? FOR UPDATE`, [id]);
      if (!txRows.length) {
        await conn.rollback();
        return res.status(404).json({ error: "Transaksi tidak ada" });
      }
      const row = txRows[0];
      const status = String(row.status);

      if (["draft", "hold"].includes(status)) {
        await conn.query(`DELETE FROM transactions WHERE id=?`, [id]);
        await conn.commit();
        return res.json({ ok: true });
      }

      if (!["admin", "owner"].includes(req.user.role_name)) {
        await conn.rollback();
        return res.status(403).json({ error: "Hapus transaksi selesai/refund hanya untuk admin atau owner" });
      }

      if (status === "completed") {
        await voidCompletedTransaction(conn, id, row, req.user.id);
      } else if (status === "refunded") {
        await voidRefundedTransaction(conn, id, row);
      } else {
        await conn.rollback();
        return res.status(400).json({ error: `Transaksi status "${status}" tidak bisa dihapus` });
      }

      await conn.commit();
      res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      res.status(400).json({ error: e.message || "Gagal menghapus" });
    } finally {
      conn.release();
    }
  })
);

app.post(
  "/api/transactions/:id/refund",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [tx] = await conn.query(`SELECT * FROM transactions WHERE id=? FOR UPDATE`, [req.params.id]);
      if (!tx.length) throw new Error("Transaksi tidak ada");
      if (tx[0].status !== "completed") throw new Error("Hanya transaksi selesai yang bisa refund");
      const [items] = await conn.query(`SELECT * FROM transaction_items WHERE transaction_id=?`, [req.params.id]);
      for (const it of items) {
        await conn.query(`UPDATE products SET stock = stock + ? WHERE id=?`, [it.qty, it.product_id]);
        await conn.query(
          `INSERT INTO stock_movements (product_id, type, qty, reference_type, reference_id, notes, created_by)
           VALUES (?,'refund',?, 'refund', ?, 'Refund trx', ?)`,
          [it.product_id, it.qty, req.params.id, req.user.id]
        );
      }
      await conn.query(`UPDATE transactions SET status='refunded' WHERE id=?`, [req.params.id]);
      await conn.commit();
      res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      res.status(400).json({ error: e.message });
    } finally {
      conn.release();
    }
  })
);

app.get(
  "/api/cash-accounts",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    const q = String(req.query.q || "").trim();
    let mf = String(req.query.mutasi_from || "").trim();
    let mt = String(req.query.mutasi_to || "").trim();
    const usePeriod =
      /^\d{4}-\d{2}-\d{2}$/.test(mf) && /^\d{4}-\d{2}-\d{2}$/.test(mt);
    if (usePeriod && mf > mt) [mf, mt] = [mt, mf];
    const toD = usePeriod ? mt : null;

    let where = "WHERE 1=1";
    const whereParams = [];
    if (q) {
      where += " AND (ca.name LIKE ? OR ca.type LIKE ?)";
      const qq = `%${q}%`;
      whereParams.push(qq, qq);
    }
    const includeInactive = String(req.query.all || "") === "1" || String(req.query.all || "") === "true";
    if (!includeInactive) {
      where += " AND COALESCE(ca.is_active,1)=1";
    }

    const mutasiQ = String(req.query.mutasi_q || "").trim();
    if (usePeriod) {
      if (mutasiQ) {
        const qqm = `%${mutasiQ}%`;
        where += ` AND EXISTS (
          SELECT 1 FROM cash_flows cfx
          WHERE cfx.cash_account_id = ca.id
            AND cfx.flow_date BETWEEN ? AND ?
            AND (cfx.description LIKE ? OR cfx.reference LIKE ? OR ca.name LIKE ?)
        )`;
        whereParams.push(mf, mt, qqm, qqm, qqm);
      } else {
        where += ` AND EXISTS (
          SELECT 1 FROM cash_flows cfx
          WHERE cfx.cash_account_id = ca.id
            AND cfx.flow_date BETWEEN ? AND ?
        )`;
        whereParams.push(mf, mt);
      }
    }

    const signedFlow = (alias) =>
      `CASE ${alias}.type WHEN 'in' THEN ${alias}.amount WHEN 'transfer_in' THEN ${alias}.amount WHEN 'out' THEN -${alias}.amount WHEN 'transfer_out' THEN -${alias}.amount ELSE 0 END`;

    const balanceForPeriodSql = usePeriod
      ? `, (ca.balance - COALESCE((
          SELECT SUM(${signedFlow("cf")})
          FROM cash_flows cf
          WHERE cf.cash_account_id = ca.id AND cf.flow_date > ?
        ), 0)) AS balance_for_period`
      : "";

    const mutasiNetSql = usePeriod
      ? mutasiQ
        ? `, (SELECT COALESCE(SUM(${signedFlow("cfn")}), 0)
            FROM cash_flows cfn
            WHERE cfn.cash_account_id = ca.id
              AND cfn.flow_date BETWEEN ? AND ?
              AND (cfn.description LIKE ? OR cfn.reference LIKE ? OR ca.name LIKE ?)
           ) AS mutasi_net_period`
        : `, (SELECT COALESCE(SUM(${signedFlow("cfn")}), 0)
            FROM cash_flows cfn
            WHERE cfn.cash_account_id = ca.id
              AND cfn.flow_date BETWEEN ? AND ?
           ) AS mutasi_net_period`
      : "";

    /** Urutan ? mengikuti teks SQL kiri-ke-kanan: subquery SELECT dulu, lalu WHERE, lalu LIMIT. */
    const selectParams = [];
    if (usePeriod) {
      selectParams.push(toD);
      if (mutasiQ) {
        const qqm = `%${mutasiQ}%`;
        selectParams.push(mf, mt, qqm, qqm, qqm);
      } else {
        selectParams.push(mf, mt);
      }
    }

    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS ca.*${balanceForPeriodSql}${mutasiNetSql}
       FROM cash_accounts ca
       ${where} ORDER BY ca.id LIMIT ? OFFSET ?`,
      [...selectParams, ...whereParams, limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({ data: rows, total, page, limit });
  })
);

/** Saldo per rekening pada akhir tanggal `as_of` (inklusif), dari saldo kini dikurangi mutasi setelah tanggal itu. */
app.get(
  "/api/cash-accounts/summary-as-of",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const asOf = String(req.query.as_of || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
      return res.status(400).json({ error: "Parameter as_of (YYYY-MM-DD) wajib" });
    }
    const [rows] = await pool.query(
      `SELECT ca.id, ca.name, ca.type,
        (ca.balance - COALESCE(SUM(
          CASE cf.type
            WHEN 'in' THEN cf.amount
            WHEN 'transfer_in' THEN cf.amount
            WHEN 'out' THEN -cf.amount
            WHEN 'transfer_out' THEN -cf.amount
            ELSE 0
          END
        ), 0)) AS balance_as_of
       FROM cash_accounts ca
       LEFT JOIN cash_flows cf ON cf.cash_account_id = ca.id AND cf.flow_date > ?
       WHERE COALESCE(ca.is_active,1)=1
       GROUP BY ca.id, ca.name, ca.type, ca.balance
       ORDER BY ca.name`,
      [asOf]
    );
    res.json({ data: rows, as_of: asOf });
  })
);

app.post(
  "/api/cash-accounts",
  requireAuth,
  cashflowOrOwnerAdmin,
  asyncHandler(async (req, res) => {
    const b = req.body;
    const type = ["kas", "bank", "ewallet"].includes(String(b.type)) ? b.type : "kas";
    const [r] = await pool.query(`INSERT INTO cash_accounts (name, type, balance, is_active) VALUES (?,?,?,1)`, [
      String(b.name || "").trim() || "Rekening baru",
      type,
      Number(b.balance || 0),
    ]);
    res.status(201).json({ id: r.insertId });
  })
);

app.put(
  "/api/cash-accounts/:id",
  requireAuth,
  cashflowOrOwnerAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body;
    const [rows] = await pool.query(`SELECT id FROM cash_accounts WHERE id=?`, [id]);
    if (!rows.length) return res.status(404).json({ error: "Akun tidak ada" });
    const type = ["kas", "bank", "ewallet"].includes(String(b.type)) ? b.type : "kas";
    const isAct = b.is_active === false || b.is_active === 0 || String(b.is_active) === "0" ? 0 : 1;
    await pool.query(`UPDATE cash_accounts SET name=?, type=?, is_active=? WHERE id=?`, [
      String(b.name || "").trim() || "Tanpa nama",
      type,
      isAct,
      id,
    ]);
    res.json({ ok: true });
  })
);

app.delete(
  "/api/cash-accounts/:id",
  requireAuth,
  cashflowOrOwnerAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [rows] = await pool.query(`SELECT id FROM cash_accounts WHERE id=?`, [id]);
    if (!rows.length) return res.status(404).json({ error: "Akun tidak ada" });
    await pool.query(`UPDATE cash_accounts SET is_active=0 WHERE id=?`, [id]);
    res.json({ ok: true });
  })
);

app.get(
  "/api/cash-flows/next-code",
  requireAuth,
  permOrOwnerAdmin("cashflow", "expenses"),
  asyncHandler(async (_req, res) => {
    const [[r]] = await pool.query(`SELECT LPAD(IFNULL(MAX(id),0)+1, 6, '0') AS code FROM cash_flows`);
    res.json({ code: r.code });
  })
);

app.get(
  "/api/cash-flows",
  requireAuth,
  permOrOwnerAdmin("cashflow", "expenses"),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    let where = "WHERE 1=1";
    const params = [];
    if (req.query.from) {
      where += " AND cf.flow_date >= ?";
      params.push(req.query.from);
    }
    if (req.query.to) {
      where += " AND cf.flow_date <= ?";
      params.push(req.query.to);
    }
    if (req.query.account_id) {
      where += " AND cf.cash_account_id=?";
      params.push(req.query.account_id);
    }
    if (req.query.type) {
      where += " AND cf.type=?";
      params.push(req.query.type);
    }
    const q = String(req.query.q || "").trim();
    if (q) {
      where += " AND (cf.description LIKE ? OR cf.reference LIKE ? OR ca.name LIKE ?)";
      const qq = `%${q}%`;
      params.push(qq, qq, qq);
    }
    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS cf.*, ca.name AS account_name,
         ec.name AS expense_category_name, ic.name AS income_category_name
       FROM cash_flows cf
       JOIN cash_accounts ca ON ca.id=cf.cash_account_id
       LEFT JOIN expense_categories ec ON cf.category_type='expense' AND cf.category_id = ec.id
       LEFT JOIN income_categories ic ON cf.category_type='income' AND cf.category_id = ic.id
       ${where} ORDER BY cf.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({ data: rows, total, page, limit });
  })
);

app.post(
  "/api/cash-flows",
  requireAuth,
  permOrOwnerAdmin("cashflow", "expenses"),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const type = b.type;
      const amt = Number(b.amount);
      if (type === "transfer_out") {
        const [from] = await conn.query(`SELECT balance FROM cash_accounts WHERE id=? FOR UPDATE`, [b.from_account_id]);
        if (!from.length || from[0].balance < amt) throw new Error("Saldo tidak cukup");
        await conn.query(`UPDATE cash_accounts SET balance = balance - ? WHERE id=?`, [amt, b.from_account_id]);
        await conn.query(`UPDATE cash_accounts SET balance = balance + ? WHERE id=?`, [amt, b.to_account_id]);
        await conn.query(
          `INSERT INTO cash_flows (cash_account_id, type, amount, description, flow_date, created_by)
           VALUES (?,?,?,?,?,?)`,
          [b.from_account_id, "transfer_out", amt, b.description || "Transfer keluar", b.flow_date, req.user.id]
        );
        await conn.query(
          `INSERT INTO cash_flows (cash_account_id, type, amount, description, flow_date, created_by)
           VALUES (?,?,?,?,?,?)`,
          [b.to_account_id, "transfer_in", amt, b.description || "Transfer masuk", b.flow_date, req.user.id]
        );
      } else {
        let category_id = null;
        let category_type = null;
        if (type === "in" && b.income_category_id) {
          category_id = Number(b.income_category_id);
          category_type = "income";
        }
        if (type === "out" && b.expense_category_id) {
          category_id = Number(b.expense_category_id);
          category_type = "expense";
        }
        await conn.query(`UPDATE cash_accounts SET balance = balance + ? WHERE id=?`, [
          type === "in" ? amt : -amt,
          b.cash_account_id,
        ]);
        await conn.query(
          `INSERT INTO cash_flows (cash_account_id, type, amount, category_id, category_type, description, flow_date, created_by)
           VALUES (?,?,?,?,?,?,?,?)`,
          [b.cash_account_id, type, amt, category_id, category_type, b.description || "", b.flow_date, req.user.id]
        );
      }
      await conn.commit();
      res.status(201).json({ ok: true });
    } catch (e) {
      await conn.rollback();
      res.status(400).json({ error: e.message });
    } finally {
      conn.release();
    }
  })
);

app.put(
  "/api/cash-flows/:id",
  requireAuth,
  permOrOwnerAdmin("cashflow", "expenses"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(`SELECT * FROM cash_flows WHERE id=? FOR UPDATE`, [id]);
      if (!rows.length) {
        await conn.rollback();
        return res.status(404).json({ error: "Aliran kas tidak ada" });
      }
      const row = rows[0];
      if (row.type !== "in" && row.type !== "out") {
        throw new Error("Hanya jenis masuk atau keluar yang dapat diubah");
      }
      if (row.reference && String(row.reference).startsWith("trx:")) {
        throw new Error("Aliran dari penjualan tidak dapat diubah dari sini");
      }

      const newAcc = Number(b.cash_account_id != null ? b.cash_account_id : row.cash_account_id);
      const newAmt = Number(b.amount != null ? b.amount : row.amount);
      if (!Number.isFinite(newAmt) || newAmt <= 0) throw new Error("Jumlah tidak valid");
      const newDesc = b.description != null ? String(b.description) : row.description;
      const rawDate = b.flow_date != null ? String(b.flow_date) : row.flow_date;
      const newFlowDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate.slice(0, 10) : row.flow_date;

      let category_id = row.category_id;
      let category_type = row.category_type;
      if (row.type === "out" && b.expense_category_id !== undefined) {
        category_id = b.expense_category_id ? Number(b.expense_category_id) : null;
        category_type = category_id ? "expense" : null;
      }
      if (row.type === "in" && b.income_category_id !== undefined) {
        category_id = b.income_category_id ? Number(b.income_category_id) : null;
        category_type = category_id ? "income" : null;
      }

      const accIds = [...new Set([Number(row.cash_account_id), newAcc])].sort((a, b) => a - b);
      for (const aid of accIds) {
        await conn.query(`SELECT id FROM cash_accounts WHERE id=? FOR UPDATE`, [aid]);
      }

      if (row.type === "out") {
        await conn.query(`UPDATE cash_accounts SET balance = balance + ? WHERE id=?`, [row.amount, row.cash_account_id]);
      } else {
        await conn.query(`UPDATE cash_accounts SET balance = balance - ? WHERE id=?`, [row.amount, row.cash_account_id]);
      }

      if (row.type === "out") {
        const [chk] = await conn.query(`SELECT balance FROM cash_accounts WHERE id=?`, [newAcc]);
        if (!chk.length || Number(chk[0].balance) < newAmt) throw new Error("Saldo tidak cukup");
        await conn.query(`UPDATE cash_accounts SET balance = balance - ? WHERE id=?`, [newAmt, newAcc]);
      } else {
        await conn.query(`UPDATE cash_accounts SET balance = balance + ? WHERE id=?`, [newAmt, newAcc]);
      }

      await conn.query(
        `UPDATE cash_flows SET cash_account_id=?, amount=?, category_id=?, category_type=?, description=?, flow_date=? WHERE id=?`,
        [newAcc, newAmt, category_id, category_type, newDesc || null, newFlowDate, id]
      );
      await conn.commit();
      res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      res.status(400).json({ error: e.message });
    } finally {
      conn.release();
    }
  })
);

/** Pasangan transfer_in / transfer_out (dicatat berpasangan tanpa reference). */
async function findTransferPair(conn, row) {
  if (row.type !== "transfer_out" && row.type !== "transfer_in") return null;
  const pairType = row.type === "transfer_out" ? "transfer_in" : "transfer_out";
  const [pairs] = await conn.query(
    `SELECT * FROM cash_flows
     WHERE type=? AND amount=? AND flow_date=? AND created_by <=> ?
       AND id != ?
       AND ABS(TIMESTAMPDIFF(SECOND, created_at, ?)) <= 10
     ORDER BY ABS(TIMESTAMPDIFF(SECOND, created_at, ?)) ASC
     LIMIT 1`,
    [pairType, row.amount, row.flow_date, row.created_by, row.id, row.created_at, row.created_at]
  );
  return pairs[0] || null;
}

function reverseCashFlowBalance(conn, flowRow) {
  const amt = Number(flowRow.amount);
  const accId = flowRow.cash_account_id;
  if (flowRow.type === "in" || flowRow.type === "transfer_in") {
    return conn.query(`UPDATE cash_accounts SET balance = balance - ? WHERE id=?`, [amt, accId]);
  }
  return conn.query(`UPDATE cash_accounts SET balance = balance + ? WHERE id=?`, [amt, accId]);
}

app.delete(
  "/api/cash-flows/:id",
  requireAuth,
  permOrOwnerAdmin("cashflow", "expenses"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(`SELECT * FROM cash_flows WHERE id=? FOR UPDATE`, [id]);
      if (!rows.length) {
        await conn.rollback();
        return res.status(404).json({ error: "Aliran kas tidak ada" });
      }
      const row = rows[0];
      const pair = await findTransferPair(conn, row);
      const accIds = [...new Set([Number(row.cash_account_id), pair ? Number(pair.cash_account_id) : null].filter(Boolean))].sort(
        (a, b) => a - b
      );
      for (const aid of accIds) {
        await conn.query(`SELECT id FROM cash_accounts WHERE id=? FOR UPDATE`, [aid]);
      }
      await reverseCashFlowBalance(conn, row);
      if (pair) {
        await reverseCashFlowBalance(conn, pair);
        await conn.query(`DELETE FROM cash_flows WHERE id=?`, [pair.id]);
      }
      await conn.query(`DELETE FROM cash_flows WHERE id=?`, [id]);
      await conn.commit();
      res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      res.status(400).json({ error: e.message });
    } finally {
      conn.release();
    }
  })
);

app.get(
  "/api/receivables",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    const q = String(req.query.q || "").trim();
    let where = "WHERE 1=1";
    const params = [];
    if (q) {
      where += " AND (c.name LIKE ? OR r.notes LIKE ?)";
      const qq = `%${q}%`;
      params.push(qq, qq);
    }
    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS r.*, c.name AS customer_name FROM receivables r JOIN customers c ON c.id=r.customer_id
       ${where} ORDER BY r.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({ data: rows, total, page, limit });
  })
);

app.post(
  "/api/receivables/:id/pay",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const amt = Number(req.body.amount);
    const cash_account_id = req.body.cash_account_id;
    if (!Number.isFinite(amt) || amt <= 0)
      return res.status(400).json({ error: "Jumlah pembayaran tidak valid" });
    if (!cash_account_id) return res.status(400).json({ error: "Rekening kas wajib dipilih" });
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query(`SELECT * FROM receivables WHERE id=? FOR UPDATE`, [req.params.id]);
      if (!r.length) throw new Error("Not found");
      const row = r[0];
      const balNow = Number(row.balance);
      // Toleransi pembulatan rupiah: jika selisih sangat kecil, lunaskan penuh.
      const payAmt = amt > balNow && amt - balNow <= 1 ? balNow : amt;
      if (payAmt > balNow + 0.02) throw new Error("Jumlah melebihi sisa piutang");
      const newPaid = Number(row.paid_amount) + payAmt;
      const rawBal = Number(row.amount) - newPaid;
      const bal = Math.abs(rawBal) <= 0.5 ? 0 : rawBal;
      await conn.query(`UPDATE receivables SET paid_amount=?, balance=?, status=? WHERE id=?`, [
        newPaid,
        bal,
        bal <= 0 ? "paid" : "partial",
        req.params.id,
      ]);
      await conn.query(`UPDATE cash_accounts SET balance = balance + ? WHERE id=?`, [payAmt, cash_account_id]);
      await conn.query(
        `INSERT INTO cash_flows (cash_account_id, type, amount, description, flow_date, created_by)
         VALUES (?,?,?,?,CURDATE(),?)`,
        [cash_account_id, "in", payAmt, `Pelunasan piutang #${req.params.id}`, req.user.id]
      );
      await conn.query(
        `INSERT INTO installment_payments (receivable_id, amount, payment_date, cash_account_id) VALUES (?,?,CURDATE(),?)`,
        [req.params.id, payAmt, cash_account_id]
      );
      await conn.query(`UPDATE customers SET balance_receivable = balance_receivable - ? WHERE id=?`, [payAmt, row.customer_id]);
      await conn.commit();
      res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      res.status(400).json({ error: e.message });
    } finally {
      conn.release();
    }
  })
);

app.get(
  "/api/payables",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    const q = String(req.query.q || "").trim();
    let where = "WHERE 1=1";
    const params = [];
    if (q) {
      where += " AND (s.name LIKE ? OR p.notes LIKE ? OR p.reference LIKE ?)";
      const qq = `%${q}%`;
      params.push(qq, qq, qq);
    }
    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS p.*, s.name AS supplier_name FROM payables p JOIN suppliers s ON s.id=p.supplier_id
       ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({ data: rows, total, page, limit });
  })
);

app.post(
  "/api/payables",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const b = req.body;
    const [r] = await pool.query(
      `INSERT INTO payables (supplier_id, reference, amount, paid_amount, balance, due_date, status, notes)
       VALUES (?,?,?,?,?,?, 'open', ?)`,
      [b.supplier_id, b.reference, b.amount, 0, b.amount, b.due_date || null, b.notes]
    );
    await pool.query(`UPDATE suppliers SET balance_payable = balance_payable + ? WHERE id=?`, [b.amount, b.supplier_id]);
    res.status(201).json({ id: r.insertId });
  })
);

app.post(
  "/api/payables/:id/pay",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const amt = Number(req.body.amount);
    const cash_account_id = req.body.cash_account_id;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [p] = await conn.query(`SELECT * FROM payables WHERE id=? FOR UPDATE`, [req.params.id]);
      if (!p.length) throw new Error("Not found");
      const row = p[0];
      const maxPay = Number(row.balance);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Jumlah bayar tidak valid");
      if (amt > maxPay + 0.01) throw new Error("Jumlah bayar melebihi sisa hutang");
      const newPaid = Number(row.paid_amount) + amt;
      const bal = Number(row.amount) - newPaid;
      await conn.query(`UPDATE payables SET paid_amount=?, balance=?, status=? WHERE id=?`, [
        newPaid,
        bal,
        bal <= 0 ? "paid" : "partial",
        req.params.id,
      ]);
      if (cash_account_id) {
        await conn.query(`UPDATE cash_accounts SET balance = balance - ? WHERE id=?`, [amt, cash_account_id]);
        await conn.query(
          `INSERT INTO cash_flows (cash_account_id, type, amount, description, flow_date, created_by)
           VALUES (?,?,?,?,CURDATE(),?)`,
          [cash_account_id, "out", amt, `Bayar hutang #${req.params.id}`, req.user.id]
        );
      }
      await conn.query(
        `INSERT INTO installment_payments (payable_id, amount, payment_date, cash_account_id) VALUES (?,?,CURDATE(),?)`,
        [req.params.id, amt, cash_account_id]
      );
      await conn.query(`UPDATE suppliers SET balance_payable = balance_payable - ? WHERE id=?`, [amt, row.supplier_id]);
      await conn.commit();
      res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      res.status(400).json({ error: e.message });
    } finally {
      conn.release();
    }
  })
);

app.get(
  "/api/supplier-purchases",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS sp.*, s.name AS supplier_name
       FROM supplier_purchases sp
       JOIN suppliers s ON s.id = sp.supplier_id
       ORDER BY sp.purchase_date DESC, sp.id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({ data: rows, total, page, limit });
  })
);

app.post(
  "/api/supplier-purchases",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const { supplier_id, total, purchase_date, notes } = req.body;
    const sid = Number(supplier_id);
    const amt = Number(total);
    if (!sid || !Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: "Supplier dan total nominal wajib (total > 0)" });
    const pd =
      purchase_date && /^\d{4}-\d{2}-\d{2}$/.test(String(purchase_date))
        ? String(purchase_date).slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query(
        `INSERT INTO supplier_purchases (supplier_id, total, purchase_date, notes) VALUES (?,?,?,?)`,
        [sid, amt, pd, notes || null]
      );
      await conn.query(`UPDATE suppliers SET total_purchase = total_purchase + ? WHERE id=?`, [amt, sid]);
      await conn.commit();
      res.status(201).json({ id: r.insertId });
    } catch (e) {
      await conn.rollback();
      res.status(400).json({ error: e.message });
    } finally {
      conn.release();
    }
  })
);

app.get(
  "/api/reports/sales",
  requireAuth,
  reportsOrOwnerAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    const from = req.query.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM (
         SELECT COALESCE(sale_date, DATE(created_at)) AS d FROM transactions
         WHERE status='completed' AND COALESCE(sale_date, DATE(created_at)) BETWEEN ? AND ?
         GROUP BY COALESCE(sale_date, DATE(created_at))
       ) x`,
      [from, to]
    );
    const [rows] = await pool.query(
      `SELECT COALESCE(sale_date, DATE(created_at)) AS d, SUM(grand_total) AS omzet, SUM(total_profit) AS profit, COUNT(*) AS trx
       FROM transactions WHERE status='completed' AND COALESCE(sale_date, DATE(created_at)) BETWEEN ? AND ?
       GROUP BY COALESCE(sale_date, DATE(created_at)) ORDER BY d LIMIT ? OFFSET ?`,
      [from, to, limit, offset]
    );
    res.json({ data: rows, total: cnt, page, limit });
  })
);

app.get(
  "/api/reports/best-sellers",
  requireAuth,
  reportsOrOwnerAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    const from = req.query.from;
    const to = req.query.to;
    const q = String(req.query.q || "").trim();
    const nameFilter = q ? " AND p.name LIKE ?" : "";
    const baseParams = [from || null, from || null, to || null, to || null];
    if (q) baseParams.push(`%${q}%`);
    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM (
         SELECT p.id
         FROM transaction_items ti
         JOIN products p ON p.id=ti.product_id
         JOIN transactions t ON t.id=ti.transaction_id
         WHERE t.status='completed'
         AND (? IS NULL OR COALESCE(t.sale_date, DATE(t.created_at)) >= ?)
         AND (? IS NULL OR COALESCE(t.sale_date, DATE(t.created_at)) <= ?)
         ${nameFilter}
         GROUP BY p.id
       ) z`,
      baseParams
    );
    const dataParams = [...baseParams, limit, offset];
    const [rows] = await pool.query(
      `SELECT p.id, p.name, SUM(ti.qty) AS qty, SUM(ti.line_total) AS revenue, AVG(ti.sell_price - ti.purchase_price) AS avg_margin
       FROM transaction_items ti
       JOIN products p ON p.id=ti.product_id
       JOIN transactions t ON t.id=ti.transaction_id
       WHERE t.status='completed'
       AND (? IS NULL OR COALESCE(t.sale_date, DATE(t.created_at)) >= ?)
       AND (? IS NULL OR COALESCE(t.sale_date, DATE(t.created_at)) <= ?)
       ${nameFilter}
       GROUP BY p.id ORDER BY qty DESC LIMIT ? OFFSET ?`,
      dataParams
    );
    res.json({ data: rows, total: countRow.cnt, page, limit });
  })
);

app.get(
  "/api/reports/margin-by-product",
  requireAuth,
  reportsOrOwnerAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    const q = String(req.query.q || "").trim();
    const nameFilter = q ? " AND p.name LIKE ?" : "";
    const baseParams = [];
    if (q) baseParams.push(`%${q}%`);
    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM (
         SELECT p.id
         FROM transaction_items ti
         JOIN products p ON p.id=ti.product_id
         JOIN transactions t ON t.id=ti.transaction_id
         WHERE t.status='completed' AND DATE(t.created_at) >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
         ${nameFilter}
         GROUP BY p.id
       ) z`,
      baseParams
    );
    const dataParams = [...baseParams, limit, offset];
    const [rows] = await pool.query(
      `SELECT p.id, p.name,
        SUM(ti.margin_amount) AS margin,
        SUM(ti.line_total) AS revenue,
        SUM(ti.qty) AS qty
       FROM transaction_items ti
       JOIN products p ON p.id=ti.product_id
       JOIN transactions t ON t.id=ti.transaction_id
       WHERE t.status='completed' AND DATE(t.created_at) >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
       ${nameFilter}
       GROUP BY p.id ORDER BY margin DESC LIMIT ? OFFSET ?`,
      dataParams
    );
    res.json({ data: rows, total: countRow.cnt, page, limit });
  })
);

app.get(
  "/api/reports/stock-summary",
  requireAuth,
  reportsOrOwnerAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    const q = String(req.query.q || "").trim();
    let nameWhere = "WHERE p.is_active = 1";
    const params = [];
    if (q) {
      nameWhere += " AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)";
      const qq = `%${q}%`;
      params.push(qq, qq, qq);
    }
    const [[{ cnt }]] = await pool.query(`SELECT COUNT(*) AS cnt FROM products p ${nameWhere}`, params);
    const [rows] = await pool.query(
      `SELECT p.id, p.sku, p.name, p.stock AS balance,
        (SELECT GROUP_CONCAT(DISTINCT c.name ORDER BY c.name)
           FROM product_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.product_id = p.id) AS categories,
        COALESCE(SUM(CASE WHEN sm.type IN ('in','purchase','refund') THEN ABS(sm.qty) ELSE 0 END), 0) AS qty_in,
        COALESCE(SUM(CASE WHEN sm.type IN ('out','sale') THEN ABS(sm.qty) ELSE 0 END), 0) AS qty_out,
        COALESCE(SUM(CASE WHEN sm.type = 'adjustment' THEN sm.qty ELSE 0 END), 0) AS qty_adjust
       FROM products p
       LEFT JOIN stock_movements sm ON sm.product_id = p.id
       ${nameWhere}
       GROUP BY p.id
       ORDER BY p.name ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ data: rows, total: cnt, page, limit });
  })
);

app.get(
  "/api/reports/profit-loss",
  requireAuth,
  reportsOrOwnerAdmin,
  asyncHandler(async (req, res) => {
    const from =
      req.query.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    const dateExpr = "COALESCE(sale_date, DATE(created_at))";
    const [[sales]] = await pool.query(
      `SELECT
         COALESCE(SUM(grand_total),0) AS revenue,
         COALESCE(SUM(total_cost),0) AS hpp,
         COALESCE(SUM(tax_amount),0) AS tax_amount,
         COALESCE(SUM(total_profit),0) AS gross_profit
       FROM transactions
       WHERE status='completed' AND ${dateExpr} BETWEEN ? AND ?`,
      [from, to]
    );
    const [[ops]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM cash_flows WHERE type='out' AND flow_date BETWEEN ? AND ?`,
      [from, to]
    );
    const [breakdown] = await pool.query(
      `SELECT COALESCE(ec.name, '(Tanpa kategori)') AS expense_type,
         COALESCE(SUM(cf.amount),0) AS amount
       FROM cash_flows cf
       LEFT JOIN expense_categories ec ON cf.category_type = 'expense' AND cf.category_id = ec.id
       WHERE cf.type = 'out' AND cf.flow_date BETWEEN ? AND ?
       GROUP BY ec.id, ec.name
       HAVING SUM(cf.amount) > 0
       ORDER BY amount DESC`,
      [from, to]
    );
    const revenue = Number(sales.revenue);
    const hpp = Number(sales.hpp);
    const tax = Number(sales.tax_amount);
    const gross = Number(sales.gross_profit);
    const expenseTotal = Number(ops.total);
    const breakdownSum = breakdown.reduce((s, r) => s + Number(r.amount), 0);
    const netProfit = gross - expenseTotal;
    const denom = revenue - tax || revenue || 1;
    res.json({
      from,
      to,
      summary: {
        revenue,
        revenue_after_tax: revenue - tax,
        hpp,
        tax_amount: tax,
        gross_profit: gross,
        operational_expense: expenseTotal,
        expense_by_category_total: breakdownSum,
        net_profit: netProfit,
        pct_gross: denom !== 0 ? (gross / denom) * 100 : null,
        pct_net: denom !== 0 ? (netProfit / denom) * 100 : null,
      },
      expense_breakdown: breakdown.map((r) => ({
        expense_type: r.expense_type,
        amount: Number(r.amount),
        pct: expenseTotal > 0 ? (Number(r.amount) / expenseTotal) * 100 : 0,
      })),
    });
  })
);

app.get(
  "/api/reports/stock-prediction",
  requireAuth,
  reportsOrOwnerAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    const q = String(req.query.q || "").trim();
    const nameFilter = q ? " AND p.name LIKE ?" : "";
    const baseParams = [];
    if (q) baseParams.push(`%${q}%`);
    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM (
         SELECT p.id, COALESCE(AVG(daily.qty),0) AS avg_daily_sales
         FROM products p
         LEFT JOIN (
           SELECT ti.product_id, SUM(ti.qty)/30 AS qty
           FROM transaction_items ti JOIN transactions t ON t.id=ti.transaction_id
           WHERE t.status='completed' AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
           GROUP BY ti.product_id
         ) daily ON daily.product_id = p.id
         WHERE p.is_active=1 ${nameFilter}
         GROUP BY p.id
         HAVING avg_daily_sales > 0
       ) z`,
      baseParams
    );
    const dataParams = [...baseParams, limit, offset];
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.stock, p.min_stock,
        COALESCE(AVG(daily.qty),0) AS avg_daily_sales,
        CASE WHEN COALESCE(AVG(daily.qty),0) > 0 THEN FLOOR(p.stock / AVG(daily.qty)) ELSE NULL END AS days_cover
       FROM products p
       LEFT JOIN (
         SELECT ti.product_id, SUM(ti.qty)/30 AS qty
         FROM transaction_items ti JOIN transactions t ON t.id=ti.transaction_id
         WHERE t.status='completed' AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         GROUP BY ti.product_id
       ) daily ON daily.product_id = p.id
       WHERE p.is_active=1 ${nameFilter}
       GROUP BY p.id
       HAVING avg_daily_sales > 0
       ORDER BY days_cover ASC LIMIT ? OFFSET ?`,
      dataParams
    );
    res.json({ data: rows, total: countRow.cnt, page, limit });
  })
);

app.get(
  "/api/employees",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    const q = String(req.query.q || "").trim();
    let where = "WHERE 1=1";
    const params = [];
    if (q) {
      where += " AND (name LIKE ? OR phone LIKE ? OR position LIKE ?)";
      const qq = `%${q}%`;
      params.push(qq, qq, qq);
    }
    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS * FROM employees ${where} ORDER BY id LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({ data: rows, total, page, limit });
  })
);

app.post(
  "/api/employees",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const [r] = await pool.query(
      `INSERT INTO employees (user_id, name, phone, position, base_salary, hire_date, is_active) VALUES (?,?,?,?,?,?,1)`,
      [b.user_id || null, b.name, b.phone, b.position, b.base_salary, b.hire_date]
    );
    res.status(201).json({ id: r.insertId });
  })
);

app.get(
  "/api/attendances",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    const from = req.query.from;
    const to = req.query.to;
    const q = String(req.query.q || "").trim();
    let where = "WHERE (? IS NULL OR a.work_date >= ?) AND (? IS NULL OR a.work_date <= ?)";
    const params = [from || null, from || null, to || null, to || null];
    if (q) {
      where += " AND (e.name LIKE ? OR a.notes LIKE ?)";
      const qq = `%${q}%`;
      params.push(qq, qq);
    }
    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS a.*, e.name AS employee_name FROM attendances a
       JOIN employees e ON e.id=a.employee_id
       ${where}
       ORDER BY a.work_date DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({ data: rows, total, page, limit });
  })
);

app.post(
  "/api/attendances",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const b = req.body;
    await pool.query(
      `INSERT INTO attendances (employee_id, work_date, check_in, check_out, status, notes)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE check_in=VALUES(check_in), check_out=VALUES(check_out), status=VALUES(status)`,
      [b.employee_id, b.work_date, b.check_in, b.check_out, b.status || "hadir", b.notes]
    );
    res.json({ ok: true });
  })
);

app.post(
  "/api/salaries/generate",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const month = Number(req.body.month);
    const year = Number(req.body.year);
    const [emps] = await pool.query(`SELECT * FROM employees WHERE is_active=1`);
    for (const e of emps) {
      const [[bonus]] = await pool.query(
        `SELECT COALESCE(SUM(amount),0) AS b FROM employee_bonuses WHERE employee_id=? AND MONTH(bonus_date)=? AND YEAR(bonus_date)=?`,
        [e.id, month, year]
      );
      const [[ded]] = await pool.query(
        `SELECT COALESCE(SUM(amount),0) AS d FROM employee_deductions WHERE employee_id=? AND MONTH(deduction_date)=? AND YEAR(deduction_date)=?`,
        [e.id, month, year]
      );
      const [[loan]] = await pool.query(
        `SELECT COALESCE(SUM(balance),0) AS l FROM employee_loans WHERE employee_id=?`,
        [e.id]
      );
      const base = Number(e.base_salary);
      const net = base + Number(bonus.b) - Number(ded.d) - Math.min(Number(loan.l), base * 0.1);
      await pool.query(
        `INSERT INTO salaries (employee_id, period_month, period_year, base_amount, bonus_total, deduction_total, loan_deduction, net_amount, status)
         VALUES (?,?,?,?,?,?,?,?, 'draft')
         ON DUPLICATE KEY UPDATE base_amount=VALUES(base_amount), bonus_total=VALUES(bonus_total), deduction_total=VALUES(deduction_total),
         loan_deduction=VALUES(loan_deduction), net_amount=VALUES(net_amount)`,
        [e.id, month, year, base, bonus.b, ded.d, Math.min(Number(loan.l), base * 0.1), net]
      );
    }
    res.json({ ok: true });
  })
);

app.get(
  "/api/salaries",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    const month = Number(req.query.month || new Date().getMonth() + 1);
    const year = Number(req.query.year || new Date().getFullYear());
    const q = String(req.query.q || "").trim();
    let extra = "";
    const params = [month, year];
    if (q) {
      extra = " AND e.name LIKE ?";
      params.push(`%${q}%`);
    }
    params.push(limit, offset);
    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS s.*, e.name AS employee_name FROM salaries s JOIN employees e ON e.id=s.employee_id
       WHERE s.period_month=? AND s.period_year=?${extra}
       ORDER BY e.name LIMIT ? OFFSET ?`,
      params
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({ data: rows, total, page, limit });
  })
);

app.get(
  "/api/settings",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(`SELECT \`key\`, value FROM settings`);
    const obj = {};
    rows.forEach((r) => {
      obj[r.key] = r.value;
    });
    res.json(obj);
  })
);

app.put(
  "/api/settings",
  requireAuth,
  requireRoles("admin"),
  asyncHandler(async (req, res) => {
    for (const [k, v] of Object.entries(req.body)) {
      await pool.query(`INSERT INTO settings (\`key\`, value) VALUES (?,?) ON DUPLICATE KEY UPDATE value=?`, [k, String(v), String(v)]);
    }
    res.json({ ok: true });
  })
);

app.get(
  "/api/printers",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    const q = String(req.query.q || "").trim();
    let where = "WHERE 1=1";
    const params = [];
    if (q) {
      where += " AND (name LIKE ? OR address LIKE ?)";
      const qq = `%${q}%`;
      params.push(qq, qq);
    }
    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS * FROM printers ${where} ORDER BY id LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({ data: rows, total, page, limit });
  })
);

app.post(
  "/api/printers",
  requireAuth,
  requireRoles("admin"),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const [r] = await pool.query(
      `INSERT INTO printers (store_id, name, connection_type, address, paper_width_mm, is_default) VALUES (?,?,?,?,?,?)`,
      [b.store_id || null, b.name, b.connection_type || "bluetooth", b.address, b.paper_width_mm || 58, b.is_default ? 1 : 0]
    );
    res.status(201).json({ id: r.insertId });
  })
);


// ==================================// ==========================================
// CATALOG & SOCIAL MEDIA FEATURE ENDPOINTS (WITH catalog PREFIX)
// ==========================================

const CATALOG_UPLOAD_DIR = path.join(__dirname, "uploads-catalog-sekargumilang");
if (!fs.existsSync(CATALOG_UPLOAD_DIR)) fs.mkdirSync(CATALOG_UPLOAD_DIR, { recursive: true });

app.use("/uploads-catalog-sekargumilang", express.static(CATALOG_UPLOAD_DIR));

const catalogStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CATALOG_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `cat_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const catalogUpload = multer({
  storage: catalogStorage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) return cb(new Error("Hanya gambar"));
    cb(null, true);
  },
});

async function nextCatalogProductSortOrder(conn = pool) {
  const [[row]] = await conn.query(`SELECT COALESCE(MAX(sort_order), 0) + 10 AS n FROM catalog_products`);
  return Number(row?.n || 10);
}

async function nextCatalogImageSortOrder(productId, conn = pool) {
  const [[row]] = await conn.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 10 AS n FROM catalog_product_images WHERE product_id=?`,
    [productId]
  );
  return Number(row?.n || 10);
}

async function syncCatalogProductPrimaryImage(productId, conn = pool) {
  const [[img]] = await conn.query(
    `SELECT image_path FROM catalog_product_images WHERE product_id=? ORDER BY sort_order ASC, id ASC LIMIT 1`,
    [productId]
  );
  await conn.query(`UPDATE catalog_products SET image_path=? WHERE id=?`, [img?.image_path || null, productId]);
}

async function applyCatalogSortOrder(table, ids, sortValues = null, conn = pool) {
  const clean = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  if (!clean.length) return;
  const values =
    Array.isArray(sortValues) && sortValues.length === clean.length
      ? sortValues.map((n) => Number(n))
      : clean.map((_id, i) => (i + 1) * 10);
  for (let i = 0; i < clean.length; i++) {
    await conn.query(`UPDATE ${table} SET sort_order=? WHERE id=?`, [values[i], clean[i]]);
  }
}

// --- PUBLIC ENDPOINTS ---

// 1. GET Public Categories Tree
app.get(
  "/api/catalog/categories",
  asyncHandler(async (req, res) => {
    const [cats] = await pool.query(
      `SELECT id, name, code, slug FROM catalog_categories ORDER BY name`
    );
    for (const cat of cats) {
      const [subs] = await pool.query(
        `SELECT id, name, code, slug FROM catalog_subcategories WHERE category_id = ? ORDER BY name`,
        [cat.id]
      );
      cat.subcategories = subs;
    }
    res.json({
      success: true,
      data: cats
    });
  })
);

// 2. GET Public Products
app.get(
  "/api/catalog/products",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "12"), 10) || 12));
    const offset = (page - 1) * limit;
    const q = String(req.query.q || "").trim();
    const catId = req.query.category_id ? Number(req.query.category_id) : null;
    const subCatId = req.query.subcategory_id ? Number(req.query.subcategory_id) : null;

    let where = "WHERE p.is_active = 1";
    const params = [];

    if (q) {
      where += " AND (p.name LIKE ? OR p.description LIKE ?)";
      const qq = `%${q}%`;
      params.push(qq, qq);
    }

    if (subCatId) {
      where += " AND p.subcategory_id = ?";
      params.push(subCatId);
    } else if (catId) {
      where += " AND p.category_id = ?";
      params.push(catId);
    }

    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS p.id, p.sku, p.barcode, p.name, p.description, p.sell_price, p.crossed_price, p.stock, p.is_active, p.image_path, p.sort_order
       FROM catalog_products p
       ${where}
       ORDER BY p.sort_order ASC, p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);

    for (const row of rows) {
      const [imgs] = await pool.query(
        `SELECT id, image_path, sort_order FROM catalog_product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC`,
        [row.id]
      );
      row.images = imgs;
    }

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  })
);

// 2b. GET Public Single Product (shareable detail)
app.get(
  "/api/catalog/products/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, error: "ID produk tidak valid" });
    }

    const [rows] = await pool.query(
      `SELECT p.id, p.sku, p.barcode, p.name, p.description, p.sell_price, p.crossed_price, p.stock,
              p.is_active, p.image_path, p.sort_order, p.category_id, p.subcategory_id,
              c.name AS category_name, s.name AS subcategory_name
       FROM catalog_products p
       LEFT JOIN catalog_categories c ON c.id = p.category_id
       LEFT JOIN catalog_subcategories s ON s.id = p.subcategory_id
       WHERE p.id = ? AND p.is_active = 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: "Produk tidak ditemukan" });
    }

    const product = rows[0];
    const [imgs] = await pool.query(
      `SELECT id, image_path, sort_order FROM catalog_product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC`,
      [id]
    );
    product.images = imgs;

    res.json({ success: true, data: product });
  })
);

// 3. GET Public Social Media
app.get(
  "/api/catalog/social-media",
  asyncHandler(async (req, res) => {
    const keys = ["catalog_ig", "catalog_tiktok", "catalog_fb", "catalog_youtube", "catalog_wa"];
    const [rows] = await pool.query(
      `SELECT \`key\`, value FROM settings WHERE \`key\` IN (?)`,
      [keys]
    );

    const result = {
      ig: "",
      tiktok: "",
      fb: "",
      youtube: "",
      wa: [],
    };

    for (const row of rows) {
      if (row.key === "catalog_ig") result.ig = row.value;
      else if (row.key === "catalog_tiktok") result.tiktok = row.value;
      else if (row.key === "catalog_fb") result.fb = row.value;
      else if (row.key === "catalog_youtube") result.youtube = row.value;
      else if (row.key === "catalog_wa") {
        try {
          result.wa = JSON.parse(row.value);
        } catch {
          result.wa = [];
        }
      }
    }

    res.json({
      success: true,
      data: result
    });
  })
);

// --- ADMIN CATEGORIES ENDPOINTS ---

// 4. GET Admin Categories
app.get(
  "/api/catalog/admin/categories",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = catalogListPagination(req);
    const q = String(req.query.q || "").trim();
    let where = "WHERE 1=1";
    const params = [];
    if (q) {
      where += " AND (name LIKE ? OR slug LIKE ? OR code LIKE ?)";
      const qq = `%${q}%`;
      params.push(qq, qq, qq);
    }

    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS * FROM catalog_categories ${where} ORDER BY name LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  })
);

// 5. POST Admin Categories
app.post(
  "/api/catalog/admin/categories",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Nama wajib" });
    const code = req.body.code != null ? String(req.body.code).trim() || null : null;
    const [r] = await pool.query(`INSERT INTO catalog_categories (name, code, slug) VALUES (?, ?, ?)`, [
      name,
      code,
      name.toLowerCase().replace(/\s+/g, "-"),
    ]);
    res.status(201).json({ success: true, id: r.insertId });
  })
);

// 6. PUT Admin Categories
app.put(
  "/api/catalog/admin/categories/:id",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Nama wajib" });
    const code = req.body.code != null ? String(req.body.code).trim() || null : null;

    await pool.query(
      `UPDATE catalog_categories SET name=?, code=?, slug=? WHERE id=?`,
      [
        name,
        code,
        name.toLowerCase().replace(/\s+/g, "-"),
        req.params.id
      ]
    );
    res.json({ success: true });
  })
);

// 7. DELETE Admin Categories
app.delete(
  "/api/catalog/admin/categories/:id",
  requireAuth,
  requireRoles("admin"),
  asyncHandler(async (req, res) => {
    await pool.query(`DELETE FROM catalog_categories WHERE id=?`, [req.params.id]);
    res.json({ success: true });
  })
);

// --- ADMIN SUBCATEGORIES ENDPOINTS ---

// 8. GET Admin Subcategories
app.get(
  "/api/catalog/admin/subcategories",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = catalogListPagination(req);
    const q = String(req.query.q || "").trim();
    const catId = req.query.category_id ? Number(req.query.category_id) : null;

    let where = "WHERE 1=1";
    const params = [];
    if (q) {
      where += " AND (s.name LIKE ? OR s.code LIKE ? OR s.slug LIKE ?)";
      const qq = `%${q}%`;
      params.push(qq, qq, qq);
    }
    if (catId) {
      where += " AND s.category_id = ?";
      params.push(catId);
    }

    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS s.*, c.name AS category_name
       FROM catalog_subcategories s
       JOIN catalog_categories c ON c.id = s.category_id
       ${where}
       ORDER BY s.name
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  })
);

// 9. POST Admin Subcategories
app.post(
  "/api/catalog/admin/subcategories",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    const category_id = Number(req.body.category_id);
    if (!name) return res.status(400).json({ error: "Nama wajib" });
    if (!category_id) return res.status(400).json({ error: "Kategori induk wajib" });
    const code = req.body.code != null ? String(req.body.code).trim() || null : null;

    const [r] = await pool.query(
      `INSERT INTO catalog_subcategories (category_id, name, code, slug) VALUES (?, ?, ?, ?)`,
      [
        category_id,
        name,
        code,
        name.toLowerCase().replace(/\s+/g, "-")
      ]
    );
    res.status(201).json({ success: true, id: r.insertId });
  })
);

// 10. PUT Admin Subcategories
app.put(
  "/api/catalog/admin/subcategories/:id",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    const category_id = Number(req.body.category_id);
    if (!name) return res.status(400).json({ error: "Nama wajib" });
    if (!category_id) return res.status(400).json({ error: "Kategori induk wajib" });
    const code = req.body.code != null ? String(req.body.code).trim() || null : null;

    await pool.query(
      `UPDATE catalog_subcategories SET category_id=?, name=?, code=?, slug=? WHERE id=?`,
      [
        category_id,
        name,
        code,
        name.toLowerCase().replace(/\s+/g, "-"),
        req.params.id
      ]
    );
    res.json({ success: true });
  })
);

// 11. DELETE Admin Subcategories
app.delete(
  "/api/catalog/admin/subcategories/:id",
  requireAuth,
  requireRoles("admin"),
  asyncHandler(async (req, res) => {
    await pool.query(`DELETE FROM catalog_subcategories WHERE id=?`, [req.params.id]);
    res.json({ success: true });
  })
);

// --- ADMIN PRODUCTS ENDPOINTS ---

// 12. GET Admin Products
app.get(
  "/api/catalog/admin/products",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const { page, limit, offset } = catalogListPagination(req);
    let where = "WHERE 1=1";
    const params = [];
    if (q) {
      where += " AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)";
      const qq = `%${q}%`;
      params.push(qq, qq, qq);
    }
    if (req.query.active !== undefined) {
      where += " AND p.is_active = ?";
      params.push(Number(req.query.active));
    }

    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS p.*, c.name AS category_name, s.name AS subcategory_name
       FROM catalog_products p
       LEFT JOIN catalog_categories c ON c.id = p.category_id
       LEFT JOIN catalog_subcategories s ON s.id = p.subcategory_id
       ${where}
       ORDER BY p.sort_order ASC, p.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);

    for (const row of rows) {
      const [imgs] = await pool.query(
        `SELECT id, image_path, sort_order FROM catalog_product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC`,
        [row.id]
      );
      row.images = imgs;
      row.categories = [row.category_name, row.subcategory_name].filter(Boolean).join(" > ");
    }

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  })
);

// 13. GET Admin Products by ID
app.get(
  "/api/catalog/admin/products/:id",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`SELECT * FROM catalog_products WHERE id=?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const [imgs] = await pool.query(
      `SELECT id, image_path, sort_order FROM catalog_product_images WHERE product_id=? ORDER BY sort_order ASC, id ASC`,
      [req.params.id]
    );
    res.json({
      success: true,
      data: {
        ...rows[0],
        images: imgs
      }
    });
  })
);

// 13b. PUT Admin Products reorder (drag & drop)
app.put(
  "/api/catalog/admin/products/reorder",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ error: "Daftar urutan produk wajib" });
    const sortValues = Array.isArray(req.body?.sort_values) ? req.body.sort_values.map(Number) : null;
    await applyCatalogSortOrder("catalog_products", ids, sortValues);
    res.json({ success: true });
  })
);

// 14. POST Admin Products
app.post(
  "/api/catalog/admin/products",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const sku = String(b.sku || "").trim() || `SKU-${Date.now()}`;
    let barcode = b.barcode ? String(b.barcode).trim() : null;
    if (!barcode) barcode = `899${String(Date.now()).slice(-9)}`;
    const category_id = Number(b.category_id);
    const subcategory_id = b.subcategory_id ? Number(b.subcategory_id) : null;

    if (!category_id) return res.status(400).json({ error: "Kategori wajib dipilih" });

    const sortOrder =
      b.sort_order != null && b.sort_order !== "" && Number.isFinite(Number(b.sort_order))
        ? Math.max(0, Math.trunc(Number(b.sort_order)))
        : await nextCatalogProductSortOrder();

    const [r] = await pool.query(
      `INSERT INTO catalog_products (category_id, subcategory_id, sku, barcode, name, description, sell_price, crossed_price, stock, is_active, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        category_id,
        subcategory_id,
        sku,
        barcode,
        b.name,
        b.description || null,
        Number(b.sell_price || 0),
        b.crossed_price != null && b.crossed_price !== "" ? Number(b.crossed_price) : null,
        Number(b.stock || 0),
        b.is_active === false ? 0 : 1,
        sortOrder,
      ]
    );
    res.status(201).json({ success: true, id: r.insertId, barcode });
  })
);

// 15. PUT Admin Products
app.put(
  "/api/catalog/admin/products/:id",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const category_id = Number(b.category_id);
    const subcategory_id = b.subcategory_id ? Number(b.subcategory_id) : null;

    if (!category_id) return res.status(400).json({ error: "Kategori wajib dipilih" });

    const sortOrder =
      b.sort_order != null && b.sort_order !== "" && Number.isFinite(Number(b.sort_order))
        ? Math.max(0, Math.trunc(Number(b.sort_order)))
        : null;

    const fields = [
      "category_id=?",
      "subcategory_id=?",
      "sku=?",
      "barcode=?",
      "name=?",
      "description=?",
      "sell_price=?",
      "crossed_price=?",
      "stock=?",
      "is_active=?",
    ];
    const vals = [
      category_id,
      subcategory_id,
      b.sku,
      b.barcode,
      b.name,
      b.description || null,
      Number(b.sell_price),
      b.crossed_price != null && b.crossed_price !== "" ? Number(b.crossed_price) : null,
      Number(b.stock || 0),
      b.is_active ? 1 : 0,
    ];
    if (sortOrder !== null) {
      fields.push("sort_order=?");
      vals.push(sortOrder);
    }
    vals.push(req.params.id);

    await pool.query(`UPDATE catalog_products SET ${fields.join(", ")} WHERE id=?`, vals);
    res.json({ success: true });
  })
);

// 16. DELETE Admin Products
app.delete(
  "/api/catalog/admin/products/:id",
  requireAuth,
  requireRoles("admin"),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`SELECT image_path FROM catalog_products WHERE id=?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Produk tidak ada" });

    const [imgs] = await pool.query(`SELECT image_path FROM catalog_product_images WHERE product_id=?`, [req.params.id]);

    await pool.query(`DELETE FROM catalog_products WHERE id=?`, [req.params.id]);

    // Delete multiple catalog images from disk
    for (const img of imgs) {
      const absPath = path.join(__dirname, img.image_path);
      fs.unlink(absPath, () => { });
    }

    unlinkProductImageFile(rows[0].image_path);
    res.json({ success: true });
  })
);

// 17. POST Admin Product Multiple Images Upload
app.post(
  "/api/catalog/admin/products/:id/images",
  requireAuth,
  requireRoles("admin", "owner"),
  catalogUpload.array("images", 10),
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.id);
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: "File gambar wajib" });

    const inserted = [];
    for (const file of files) {
      const rel = `/uploads-catalog-sekargumilang/${file.filename}`;
      const sortOrder = await nextCatalogImageSortOrder(productId);
      const [r] = await pool.query(
        `INSERT INTO catalog_product_images (product_id, image_path, sort_order) VALUES (?, ?, ?)`,
        [productId, rel, sortOrder]
      );
      inserted.push({ id: r.insertId, image_path: rel, sort_order: sortOrder });
    }

    await syncCatalogProductPrimaryImage(productId);

    res.json({ success: true, images: inserted });
  })
);

// 17b. PUT Admin Product Images reorder (drag & drop)
app.put(
  "/api/catalog/admin/products/:id/images/reorder",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.id);
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ error: "Daftar urutan gambar wajib" });
    const sortValues = Array.isArray(req.body?.sort_values) ? req.body.sort_values.map(Number) : null;

    const placeholders = ids.map(() => "?").join(",");
    const [owned] = await pool.query(
      `SELECT id FROM catalog_product_images WHERE product_id=? AND id IN (${placeholders})`,
      [productId, ...ids.map(Number)]
    );
    if (owned.length !== ids.length) {
      return res.status(400).json({ error: "Urutan gambar tidak valid untuk produk ini" });
    }

    await applyCatalogSortOrder("catalog_product_images", ids, sortValues);
    await syncCatalogProductPrimaryImage(productId);
    res.json({ success: true });
  })
);

// 18. DELETE Admin Product Image
app.delete(
  "/api/catalog/admin/products/:id/images/:imageId",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.id);
    const imageId = Number(req.params.imageId);

    const [[img]] = await pool.query(
      `SELECT image_path FROM catalog_product_images WHERE id=? AND product_id=?`,
      [imageId, productId]
    );
    if (!img) return res.status(404).json({ error: "Gambar tidak ditemukan" });

    await pool.query(`DELETE FROM catalog_product_images WHERE id=?`, [imageId]);

    const absPath = path.join(__dirname, img.image_path);
    fs.unlink(absPath, () => { });

    await syncCatalogProductPrimaryImage(productId);

    res.json({ success: true });
  })
);

// 19. PUT Admin Social Media and Contact
app.put(
  "/api/catalog/admin/social-media",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const { ig, tiktok, fb, youtube, wa } = req.body;

    const updates = [
      { key: "catalog_ig", value: String(ig || "").trim() },
      { key: "catalog_tiktok", value: String(tiktok || "").trim() },
      { key: "catalog_fb", value: String(fb || "").trim() },
      { key: "catalog_youtube", value: String(youtube || "").trim() },
      { key: "catalog_wa", value: JSON.stringify(Array.isArray(wa) ? wa : []) },
    ];

    for (const item of updates) {
      await pool.query(
        `INSERT INTO settings (\`key\`, value) VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE value = ?`,
        [item.key, item.value, item.value]
      );
    }

    res.json({ success: true });
  })
);


app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

app.listen(PORT, () => {
  console.log(`API listening on ${PORT}`);
});
