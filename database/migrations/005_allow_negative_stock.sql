-- Migration: Add allow_negative_stock setting default value
-- Date: 2026-07-24

INSERT INTO settings (`key`, value) VALUES ('allow_negative_stock', '0')
ON DUPLICATE KEY UPDATE value=VALUES(value);
