-- Jalankan sekali jika DB sudah ada sebelum penambahan kolom sale_date.
ALTER TABLE transactions
  ADD COLUMN sale_date DATE DEFAULT NULL COMMENT 'Tanggal transaksi POS' AFTER notes;
