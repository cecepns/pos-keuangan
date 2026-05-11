-- Tambah kode izin menu & mapping role (kasir/owner). Aman dijalankan berulang (INSERT IGNORE).
SET NAMES utf8mb4;

INSERT IGNORE INTO permissions (code, description) VALUES
('dashboard', 'Dashboard'),
('categories', 'Kategori produk'),
('barcode_labels', 'Cetak barcode'),
('stock_summary', 'Data stok'),
('stock_adjust', 'Penyesuaian stok'),
('low_stock', 'Stok menipis'),
('expenses', 'Pengeluaran'),
('expense_categories', 'Kategori pengeluaran'),
('users', 'Pengguna & hak akses');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE code IN ('dashboard','pos','customers','transactions');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE code IN (
  'dashboard','pos','products','categories','barcode_labels','stock_summary','stock_adjust','low_stock',
  'expenses','expense_categories','customers','suppliers','transactions','cashflow','reports'
);
