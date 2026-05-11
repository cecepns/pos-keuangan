/**
 * POS Keuangan - Backend tunggal (Express + MySQL)
 * Jalankan dari folder server: npm install && cp .env.example .env && npm start
 */
require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");

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
  fs.unlink(abs, () => {});
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "pos_keuangan",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

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
const MAX_PAGE_SIZE = 10;

function listPagination(req) {
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const raw = parseInt(String(req.query.limit ?? String(MAX_PAGE_SIZE)), 10);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.isFinite(raw) && raw > 0 ? raw : MAX_PAGE_SIZE));
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
  requireRoles("admin"),
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
  requireRoles("admin"),
  asyncHandler(async (req, res) => {
    const { name, email, password, role_id, store_id } = req.body;
    if (!name || !email || !password || !role_id) return res.status(400).json({ error: "Data tidak lengkap" });
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
  requireRoles("admin"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { name, email, role_id, store_id, is_active, password } = req.body;
    if (!name || !email || !role_id) return res.status(400).json({ error: "Nama, email, dan role wajib" });
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

app.get(
  "/api/permissions",
  requireAuth,
  requireRoles("admin"),
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(`SELECT id, code, description FROM permissions ORDER BY code`);
    res.json({ data: rows });
  })
);

app.get(
  "/api/roles/:id/permissions",
  requireAuth,
  requireRoles("admin"),
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
  requireRoles("admin"),
  asyncHandler(async (req, res) => {
    const roleId = Number(req.params.id);
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

    const [[todaySales]] = await pool.query(
      `SELECT COALESCE(SUM(grand_total),0) AS omzet,
              COALESCE(SUM(total_profit),0) AS profit,
              COUNT(*) AS trx_count,
              COALESCE(SUM((SELECT SUM(qty) FROM transaction_items ti WHERE ti.transaction_id = transactions.id)),0) AS items_sold
       FROM transactions WHERE status='completed' AND COALESCE(sale_date, DATE(created_at)) = ?`,
      [dateStr]
    );

    const [[monthCompare]] = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN YEAR(COALESCE(sale_date, created_at))=YEAR(CURDATE()) AND MONTH(COALESCE(sale_date, created_at))=MONTH(CURDATE()) THEN grand_total END),0) AS omzet_now,
        COALESCE(SUM(CASE WHEN YEAR(COALESCE(sale_date, created_at))=YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND MONTH(COALESCE(sale_date, created_at))=MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) THEN grand_total END),0) AS omzet_prev,
        COALESCE(SUM(CASE WHEN YEAR(COALESCE(sale_date, created_at))=YEAR(CURDATE()) AND MONTH(COALESCE(sale_date, created_at))=MONTH(CURDATE()) THEN total_margin END),0) AS margin_now,
        COALESCE(SUM(CASE WHEN YEAR(COALESCE(sale_date, created_at))=YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND MONTH(COALESCE(sale_date, created_at))=MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) THEN total_margin END),0) AS margin_prev
       FROM transactions WHERE status='completed'`
    );

    let cashFlow = { in: 0, out: 0 };
    let debtSummary = { piutang: 0, hutang: 0 };
    let lowStock = [];
    let bestSeller = [];

    if (role !== "kasir" || true) {
      const [[cf]] = await pool.query(
        `SELECT
          COALESCE(SUM(CASE WHEN type IN ('in','transfer_in') THEN amount END),0) AS cin,
          COALESCE(SUM(CASE WHEN type IN ('out','transfer_out') THEN amount END),0) AS cout
         FROM cash_flows WHERE flow_date = ?`,
        [dateStr]
      );
      cashFlow = { in: Number(cf.cin), out: Number(cf.cout) };

      const [[recv]] = await pool.query(`SELECT COALESCE(SUM(balance),0) AS b FROM receivables WHERE status IN ('open','partial','overdue')`);
      const [[pay]] = await pool.query(`SELECT COALESCE(SUM(balance),0) AS b FROM payables WHERE status IN ('open','partial','overdue')`);
      debtSummary = { piutang: Number(recv.b), hutang: Number(pay.b) };

      const [ls] = await pool.query(
        `SELECT id, sku, name, stock, min_stock FROM products WHERE is_active=1 AND stock <= min_stock ORDER BY stock ASC LIMIT 10`
      );
      lowStock = ls;

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

    const [salesSeries] = await pool.query(
      `SELECT COALESCE(sale_date, DATE(created_at)) AS d, SUM(grand_total) AS total
       FROM transactions WHERE status='completed' AND COALESCE(sale_date, DATE(created_at)) >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
       GROUP BY COALESCE(sale_date, DATE(created_at)) ORDER BY d`
    );

    const [profitSeries] = await pool.query(
      `SELECT COALESCE(sale_date, DATE(created_at)) AS d, SUM(total_profit) AS total
       FROM transactions WHERE status='completed' AND COALESCE(sale_date, DATE(created_at)) >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
       GROUP BY COALESCE(sale_date, DATE(created_at)) ORDER BY d`
    );

    const kasirSimple = role === "kasir";

    res.json({
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
  ownerOrAdmin,
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(`SELECT id, name FROM income_categories ORDER BY name`);
    res.json({ data: rows });
  })
);

app.get(
  "/api/expense-categories",
  requireAuth,
  ownerOrAdmin,
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
    res.json({ data: rows, total, page, limit });
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
    res.json({ ...rows[0], category_ids: cats.map((c) => c.id) });
  })
);

app.post(
  "/api/products",
  requireAuth,
  requireRoles("admin", "owner"),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const sku = String(b.sku || "").trim() || `SKU-${Date.now()}`;
    let barcode = b.barcode ? String(b.barcode).trim() : null;
    if (!barcode) barcode = `899${String(Date.now()).slice(-9)}`;
    const [r] = await pool.query(
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
        await pool.query(`INSERT IGNORE INTO product_categories (product_id, category_id) VALUES (?,?)`, [pid, cid]);
      }
    }
    res.status(201).json({ id: pid, barcode });
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
    await pool.query(
      `UPDATE products SET sku=?, barcode=?, name=?, description=?, supplier_id=?, purchase_price=?, sell_price=?,
       min_stock=?, unit=?, location=?, brand=?, is_active=?${stockPart} WHERE id=?`,
      params
    );
    await pool.query(`DELETE FROM product_categories WHERE product_id=?`, [req.params.id]);
    if (Array.isArray(b.category_ids)) {
      for (const cid of b.category_ids) {
        await pool.query(`INSERT INTO product_categories (product_id, category_id) VALUES (?,?)`, [req.params.id, cid]);
      }
    }
    res.json({ ok: true });
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

  let subtotal = 0;
  let totalCost = 0;
  let totalMargin = 0;
  const lineRows = [];

  for (const it of items) {
    const [pr] = await conn.query(`SELECT * FROM products WHERE id=? FOR UPDATE`, [it.product_id]);
    if (!pr.length) throw new Error(`Produk ${it.product_id} tidak ada`);
    const p = pr[0];
    const qty = Number(it.qty);
    const sell = Number(it.sell_price != null ? it.sell_price : p.sell_price);
    const purch = Number(p.purchase_price);
    const disc = Number(it.discount_amount || 0);
    const lineSub = sell * qty;
    const lineTotal = lineSub - disc;
    const marginLine = (sell - purch) * qty - disc;
    subtotal += lineSub;
    totalCost += purch * qty;
    totalMargin += marginLine;
    lineRows.push({
      product_id: it.product_id,
      product_name: p.name,
      barcode: p.barcode,
      purchase_price: purch,
      sell_price: sell,
      qty,
      discount_amount: disc,
      subtotal: lineSub,
      line_total: lineTotal,
      margin_amount: marginLine,
      stock_available: p.stock,
    });
  }

  const taxAmount = (subtotal - Number(discount_total)) * (Number(tax_percent) / 100);
  const grandTotal = subtotal - Number(discount_total) + taxAmount;
  const totalProfit = grandTotal - totalCost;

  const invoice_no = generateInvoiceNo();

  if (status === "completed") {
    for (const lr of lineRows) {
      const [pr] = await conn.query(`SELECT stock FROM products WHERE id=? FOR UPDATE`, [lr.product_id]);
      if (pr[0].stock < lr.qty) throw new Error(`Stok tidak cukup: ${lr.product_name}`);
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
      subtotal,
      Number(discount_total),
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
        discount_amount, subtotal, line_total, margin_amount)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
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
      await conn.query(`UPDATE products SET stock = stock - ? WHERE id=?`, [lr.qty, lr.product_id]);
      await conn.query(
        `INSERT INTO stock_movements (product_id, type, qty, reference_type, reference_id, created_by)
         VALUES (?,'sale',?, 'transaction', ?, ?)`,
        [lr.product_id, lr.qty, txId, userId]
      );
    }
    if (customer_id) {
      await conn.query(`UPDATE customers SET total_purchase = total_purchase + ? WHERE id=?`, [grandTotal, customer_id]);
    }
  }

  return { id: txId, invoice_no, grand_total: grandTotal, change_amount: changeAmount };
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
    res.json({ ...tx[0], items, payments: pays });
  })
);

app.delete(
  "/api/transactions/:id",
  requireAuth,
  kasirOrAdmin,
  asyncHandler(async (req, res) => {
    const [tx] = await pool.query(`SELECT id, status FROM transactions WHERE id=?`, [req.params.id]);
    if (!tx.length) return res.status(404).json({ error: "Transaksi tidak ada" });
    if (!["draft", "hold"].includes(String(tx[0].status)))
      return res.status(400).json({ error: "Hanya transaksi draft atau hold yang bisa dihapus" });
    await pool.query(`DELETE FROM transactions WHERE id=?`, [req.params.id]);
    res.json({ ok: true });
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
    let where = "WHERE 1=1";
    const params = [];
    if (q) {
      where += " AND (name LIKE ? OR type LIKE ?)";
      const qq = `%${q}%`;
      params.push(qq, qq);
    }
    const includeInactive = String(req.query.all || "") === "1" || String(req.query.all || "") === "true";
    if (!includeInactive) {
      where += " AND COALESCE(is_active,1)=1";
    }
    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS * FROM cash_accounts ${where} ORDER BY id LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() AS total`);
    res.json({ data: rows, total, page, limit });
  })
);

app.post(
  "/api/cash-accounts",
  requireAuth,
  requireRoles("admin", "owner"),
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
  requireRoles("admin", "owner"),
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
  requireRoles("admin", "owner"),
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
  ownerOrAdmin,
  asyncHandler(async (_req, res) => {
    const [[r]] = await pool.query(`SELECT LPAD(IFNULL(MAX(id),0)+1, 6, '0') AS code FROM cash_flows`);
    res.json({ code: r.code });
  })
);

app.get(
  "/api/cash-flows",
  requireAuth,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = listPagination(req);
    let where = "WHERE 1=1";
    const params = [];
    if (req.query.from) {
      where += " AND flow_date >= ?";
      params.push(req.query.from);
    }
    if (req.query.to) {
      where += " AND flow_date <= ?";
      params.push(req.query.to);
    }
    if (req.query.account_id) {
      where += " AND cash_account_id=?";
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
  ownerOrAdmin,
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
  ownerOrAdmin,
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

app.delete(
  "/api/cash-flows/:id",
  requireAuth,
  ownerOrAdmin,
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
      if (row.type !== "in" && row.type !== "out") {
        throw new Error("Hanya jenis masuk atau keluar yang dapat dihapus");
      }
      if (row.reference && String(row.reference).startsWith("trx:")) {
        throw new Error("Aliran dari penjualan tidak dapat dihapus dari sini");
      }

      await conn.query(`SELECT id FROM cash_accounts WHERE id=? FOR UPDATE`, [row.cash_account_id]);
      if (row.type === "out") {
        await conn.query(`UPDATE cash_accounts SET balance = balance + ? WHERE id=?`, [row.amount, row.cash_account_id]);
      } else {
        await conn.query(`UPDATE cash_accounts SET balance = balance - ? WHERE id=?`, [row.amount, row.cash_account_id]);
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
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const amt = Number(req.body.amount);
    const cash_account_id = req.body.cash_account_id;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query(`SELECT * FROM receivables WHERE id=? FOR UPDATE`, [req.params.id]);
      if (!r.length) throw new Error("Not found");
      const row = r[0];
      const newPaid = Number(row.paid_amount) + amt;
      const bal = Number(row.amount) - newPaid;
      await conn.query(`UPDATE receivables SET paid_amount=?, balance=?, status=? WHERE id=?`, [
        newPaid,
        bal,
        bal <= 0 ? "paid" : "partial",
        req.params.id,
      ]);
      if (cash_account_id) {
        await conn.query(`UPDATE cash_accounts SET balance = balance + ? WHERE id=?`, [amt, cash_account_id]);
        await conn.query(
          `INSERT INTO cash_flows (cash_account_id, type, amount, description, flow_date, created_by)
           VALUES (?,?,?,?,CURDATE(),?)`,
          [cash_account_id, "in", amt, `Pelunasan piutang #${req.params.id}`, req.user.id]
        );
      }
      await conn.query(
        `INSERT INTO installment_payments (receivable_id, amount, payment_date, cash_account_id) VALUES (?,?,CURDATE(),?)`,
        [req.params.id, amt, cash_account_id]
      );
      await conn.query(`UPDATE customers SET balance_receivable = balance_receivable - ? WHERE id=?`, [amt, row.customer_id]);
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
  "/api/reports/sales",
  requireAuth,
  ownerOrAdmin,
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
  ownerOrAdmin,
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
  ownerOrAdmin,
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
  ownerOrAdmin,
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
  ownerOrAdmin,
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
  ownerOrAdmin,
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

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

app.listen(PORT, () => {
  console.log(`API listening on ${PORT}`);
});
