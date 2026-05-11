-- Dummy data (password untuk semua user demo: password)
-- bcrypt hash untuk 'password'
SET NAMES utf8mb4;

INSERT INTO roles (id, name, description) VALUES
(1, 'admin', 'Akses penuh'),
(2, 'kasir', 'POS & transaksi'),
(3, 'owner', 'Laporan & analisis')
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT IGNORE INTO permissions (code, description) VALUES
('all', 'Semua akses'),
('dashboard', 'Dashboard'),
('pos', 'Kasir POS'),
('products', 'Produk'),
('categories', 'Kategori produk'),
('barcode_labels', 'Cetak barcode'),
('stock_summary', 'Data stok'),
('stock_adjust', 'Penyesuaian stok'),
('low_stock', 'Stok menipis'),
('expenses', 'Pengeluaran'),
('expense_categories', 'Kategori pengeluaran'),
('customers', 'Pelanggan'),
('suppliers', 'Supplier'),
('transactions', 'Transaksi'),
('cashflow', 'Cash flow'),
('reports', 'Laporan'),
('employees', 'Karyawan'),
('users', 'Pengguna & hak akses'),
('settings', 'Pengaturan');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions WHERE code='all';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE code IN ('dashboard','pos','customers','transactions');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE code IN (
  'dashboard','pos','products','categories','barcode_labels','stock_summary','stock_adjust','low_stock',
  'expenses','expense_categories','customers','suppliers','transactions','cashflow','reports'
);

INSERT INTO stores (id, name, address, phone) VALUES
(1, 'Toko Anggrek Sejahtera', 'Jl. Florikultura No. 88, Bogor', '081234567890')
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO users (id, role_id, store_id, name, email, password_hash, is_active) VALUES
(1, 1, 1, 'Admin Utama', 'admin@pos.local', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1),
(2, 2, 1, 'Kasir Ani', 'kasir@pos.local', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1),
(3, 3, 1, 'Owner Budi', 'owner@pos.local', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1)
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO categories (id, name, code, slug) VALUES
(1, 'Anggrek', '0001', 'anggrek'),
(2, 'Media Tanam', '0002', 'media-tanam'),
(3, 'Pot & Wadah', '0003', 'pot-wadah'),
(4, 'Pupuk', '0004', 'pupuk')
ON DUPLICATE KEY UPDATE name=VALUES(name), code=VALUES(code);

INSERT INTO suppliers (id, name, contact_name, phone, whatsapp, category, total_purchase, balance_payable) VALUES
(1, 'CV Bibit Nusantara', 'Pak Joko', '022123456', '628111222333', 'bibit', 15000000, 500000),
(2, 'Supplier Pot Plastik', 'Bu Rina', '021555666', '628444555666', 'wadah', 8000000, 0)
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO customers (id, name, whatsapp, address, category, total_purchase, balance_receivable) VALUES
(1, 'Ibu Siti Collection', '628777888999', 'Jakarta Selatan', 'wholesale', 25000000, 1500000),
(2, 'Pak Ahmad', '628333444555', 'Depok', 'retail', 3200000, 0),
(3, 'Taman Kota X', '628222333444', 'Bogor', 'institusi', 12000000, 800000)
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO cash_accounts (id, name, type, balance) VALUES
(1, 'Kas Toko', 'kas', 35000000),
(2, 'BCA Ops', 'bank', 12000000),
(3, 'OVO Bisnis', 'ewallet', 2500000)
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO income_categories (name) VALUES ('Penjualan'), ('Lain-lain') ON DUPLICATE KEY UPDATE name=name;
INSERT INTO expense_categories (name, type) VALUES
('Listrik', 'operational'),
('Sewa', 'operational'),
('Pembelian alat', 'alat'),
('Biaya POS', 'pos')
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO products (id, sku, barcode, name, description, supplier_id, purchase_price, sell_price, stock, min_stock, is_active, image_path) VALUES
(1, 'AG-V001', '8990011001001', 'Anggrek Dendrobium Pink', 'Tanaman hias premium', 1, 85000, 145000, 45, 10, 1, NULL),
(2, 'AG-V002', '8990011001002', 'Anggrek Phalaenopsis Putih', 'Pot medium', 1, 120000, 210000, 22, 8, 1, NULL),
(3, 'MD-M001', '8990011002001', 'Media Pakis 5L', 'Media tanam', 2, 35000, 55000, 80, 15, 1, NULL),
(4, 'PT-P001', '8990011003001', 'Pot Plastik 6 inch', 'Warna campur', 2, 8000, 18000, 200, 40, 1, NULL)
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO product_categories (product_id, category_id) VALUES
(1, 1), (2, 1), (3, 2), (4, 3)
ON DUPLICATE KEY UPDATE product_id=product_id;

INSERT INTO settings (`key`, value) VALUES
('store_name', 'Toko Anggrek Sejahtera'),
('store_address', ''),
('store_phone', ''),
('receipt_footer', 'Terima kasih'),
('thermal_width_mm', '80'),
('tax_default', '0'),
('currency', 'IDR'),
('whatsapp_sender_note', 'Terima kasih atas pembelian Anda!')
ON DUPLICATE KEY UPDATE value=VALUES(value);

INSERT INTO printers (store_id, name, connection_type, paper_width_mm, is_default) VALUES
(1, 'Thermal Kasir', 'bluetooth', 58, 1);
