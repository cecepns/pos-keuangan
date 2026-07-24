-- Migration: manual sort order for catalog products & images
-- Jalankan sekali. Jika kolom sudah ada, abaikan error ALTER TABLE.

ALTER TABLE catalog_products
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER is_active;

ALTER TABLE catalog_product_images
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER image_path;

UPDATE catalog_products SET sort_order = id * 10 WHERE sort_order = 0;

UPDATE catalog_product_images SET sort_order = id * 10 WHERE sort_order = 0;

CREATE INDEX idx_cproducts_sort ON catalog_products (sort_order, id);
CREATE INDEX idx_cpi_sort ON catalog_product_images (product_id, sort_order, id);
