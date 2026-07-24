-- Migration 006: Customer Loyalty Points System

-- 1. Add points to customers table
ALTER TABLE customers ADD COLUMN points INT NOT NULL DEFAULT 0;

-- 2. Add reward_points to products table
ALTER TABLE products ADD COLUMN reward_points INT NOT NULL DEFAULT 0;

-- 3. Add point fields to transactions table
ALTER TABLE transactions 
  ADD COLUMN points_earned INT NOT NULL DEFAULT 0,
  ADD COLUMN points_redeemed INT NOT NULL DEFAULT 0,
  ADD COLUMN point_discount_amount DECIMAL(18,2) NOT NULL DEFAULT 0;

-- 4. Create customer_point_logs table
CREATE TABLE IF NOT EXISTS customer_point_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  transaction_id BIGINT UNSIGNED DEFAULT NULL,
  type ENUM('earn','redeem','adjustment') NOT NULL,
  points INT NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cpl_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_cpl_tx FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
  INDEX idx_cpl_customer (customer_id),
  INDEX idx_cpl_tx (transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Insert default loyalty settings if not existing
INSERT IGNORE INTO settings (`key`, `value`) VALUES 
('loyalty_enabled', '1'),
('point_redeem_value', '100'),
('default_product_points', '0');
