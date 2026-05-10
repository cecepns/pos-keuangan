-- Optional migration: run on existing DB after pull
-- Tambah kolom data barang / kategori seperti referensi ERP

ALTER TABLE categories
  ADD COLUMN code VARCHAR(16) DEFAULT NULL AFTER name,
  ADD INDEX idx_categories_code (code);

ALTER TABLE products
  ADD COLUMN unit VARCHAR(32) NOT NULL DEFAULT 'PCS' AFTER min_stock,
  ADD COLUMN location VARCHAR(255) DEFAULT NULL AFTER unit,
  ADD COLUMN brand VARCHAR(128) DEFAULT NULL AFTER location;
