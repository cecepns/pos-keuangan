-- Migration: Add catalog features (prefixed tables)
-- Aman dijalankan berulang

-- 1. Tabel Kategori Katalog
CREATE TABLE IF NOT EXISTS catalog_categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  code VARCHAR(16) DEFAULT NULL,
  slug VARCHAR(128) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ccategories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabel Subkategori Katalog (Terhubung dengan Kategori Induk)
CREATE TABLE IF NOT EXISTS catalog_subcategories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  name VARCHAR(128) NOT NULL,
  code VARCHAR(16) DEFAULT NULL,
  slug VARCHAR(128) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_csub_cat FOREIGN KEY (category_id) REFERENCES catalog_categories(id) ON DELETE CASCADE,
  INDEX idx_csubcategories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel Produk Katalog (Terhubung dengan Kategori & Subkategori)
CREATE TABLE IF NOT EXISTS catalog_products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  subcategory_id INT UNSIGNED DEFAULT NULL,
  sku VARCHAR(64) DEFAULT NULL,
  barcode VARCHAR(64) DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  sell_price DECIMAL(18,2) NOT NULL DEFAULT 0,
  crossed_price DECIMAL(18,2) DEFAULT NULL,
  stock INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  image_path VARCHAR(512) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cprod_cat FOREIGN KEY (category_id) REFERENCES catalog_categories(id) ON DELETE CASCADE,
  CONSTRAINT fk_cprod_sub FOREIGN KEY (subcategory_id) REFERENCES catalog_subcategories(id) ON DELETE SET NULL,
  INDEX idx_cproducts_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabel Gambar Multi-katalog Produk
CREATE TABLE IF NOT EXISTS catalog_product_images (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  image_path VARCHAR(512) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cpi_prod FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Seed default settings untuk social media katalog
INSERT INTO settings (`key`, value) VALUES
('catalog_ig', '@anggrek_sekargumilang'),
('catalog_tiktok', '@anggrekmurahpurwokerto'),
('catalog_fb', 'Anggrek Sekar Gumilang'),
('catalog_youtube', 'Anggrek Sekar Gumilang'),
('catalog_wa', '[{"name":"Admin Utama","phone":"6281234567890"}]')
ON DUPLICATE KEY UPDATE value=VALUES(value);
