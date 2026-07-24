-- Migrate legacy kategori + barang from sekargum_sekargumilangkasir.sql
-- Target schema: database/schema.sql (categories, products, product_categories)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TEMPORARY TABLE IF EXISTS tmp_legacy_categories;
CREATE TEMPORARY TABLE tmp_legacy_categories (
  kode VARCHAR(20),
  nama VARCHAR(128),
  no INT
) ENGINE=Memory;

INSERT INTO tmp_legacy_categories (kode, nama, no) VALUES
('0001', 'PHALAENOPSIS', 1),
('0002', 'DENDROBIUM', 2),
('0003', 'CATLEYA', 3),
('0004', 'ONCYDIUM', 4),
('0005', 'SPESIES', 5),
('0006', 'MEDIA ANGGREK', 6),
('0007', 'PUPUK ANGGREK', 7),
('0008', 'PRASARANA ANGGREK', 8),
('0009', 'VANDA HYBRID', 9),
('0010', 'GRAMA', 10),
('0011', 'TANAMAN HIAS', 11),
('0012', '', 12),
('0013', '', 13);

DROP TEMPORARY TABLE IF EXISTS tmp_legacy_products;
CREATE TEMPORARY TABLE tmp_legacy_products (
  no INT,
  kode VARCHAR(20),
  sku VARCHAR(64),
  nama VARCHAR(255),
  kategori VARCHAR(128),
  brand VARCHAR(128),
  barcode VARCHAR(64),
  hargabeli DECIMAL(18,2),
  hargajual DECIMAL(18,2),
  terjual INT,
  terbeli INT,
  sisa INT,
  retur INT,
  stokmin INT,
  ukuran VARCHAR(32),
  warna VARCHAR(64),
  expired DATE,
  satuan VARCHAR(32),
  lokasi VARCHAR(255),
  keterangan TEXT,
  supplier VARCHAR(255),
  avatar VARCHAR(512)
) ENGINE=InnoDB;

INSERT INTO tmp_legacy_products (
  no, kode, sku, nama, kategori, brand, barcode, hargabeli, hargajual,
  terjual, terbeli, sisa, retur, stokmin, ukuran, warna, expired,
  satuan, lokasi, keterangan, supplier, avatar
) VALUES
(1, '000001', 'SKU000001', 'PHALAENOPSIS A0001 115', 'PHALAENOPSIS', 'SEEDLING', 'BRG000001', 90000, 115000, 16, 59, 6, 0, 1, '', '', '0000-00-00', 'PCS', '', '', ',CENTRA ANGGREK', 'dist/upload/'),
(2, '000002', 'SKU000002', 'PHALAENOPSIS A0001 120', 'PHALAENOPSIS', 'SEEDLING', 'BRG000002', 90000, 120000, 233, 102, 2, 0, 1, '', '', '0000-00-00', 'PCS', '', '', ',CENTRA ANGGREK', 'dist/upload/'),
(3, '000003', 'SKU000003', 'PHALAENOPSIS A0001 130', 'PHALAENOPSIS', 'DEWASA', 'BRG000003', 90000, 130000, 1561, 893, 22, 0, 1, '', '', '0000-00-00', 'PCS', '', '', ',CENTRA ANGGREK', 'dist/upload/'),
(4, '000004', 'SKU000004', 'PHALAENOPSIS PREM A0001 150', 'PHALAENOPSIS', 'BUNGA', 'BRG000004', 105000, 150000, 832, 473, 24, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(5, '000005', 'SKU000005', 'SEED PHAL A0002 15', 'PHALAENOPSIS', 'SEEDLING', 'BRG000005', 10000, 15000, 0, 0, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(6, '000006', 'SKU000006', 'SEED PHAL A0002 RO 45', 'PHALAENOPSIS', 'SEEDLING', 'BRG000006', 20000, 45000, 14, 30, 12, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(11, '000011', 'SKU000011', 'DENDROBIUM REMAJA A0004 35', 'DENDROBIUM', 'REMAJA', 'BRG000011', 17000, 35000, 65, 0, 1, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(14, '000014', 'SKU000014', 'SEEDLING DENDROBIUM A0005 25', 'DENDROBIUM', 'SEEDLING', 'BRG000014', 5000, 25000, 1175, 482, 18, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(16, '000016', 'SKU000016', 'CATELYA SEEDLING A0009 50', 'CATLEYA', 'SEEDLING', 'BRG000016', 15000, 35000, 9, 31, 16, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(17, '000017', 'SKU000017', 'RETUSA A0017 20', 'SPESIES', 'DEWASA', 'BRG000017', 5000, 20000, 57, 185, 129, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(18, '000018', 'SKU000018', 'VANDA TRICOLOR A0019 45', 'SPESIES', 'DEWASA', 'BRG000018', 15000, 45000, 5, 0, 7, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(19, '000019', 'SKU000019', 'PETROCERAS A0020 20', 'SPESIES', 'DEWASA', 'BRG000019', 7000, 20000, 9, 17, 9, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(21, '000021', 'SKU000021', 'DENDROBIUM BOTOL A0027 75', 'DENDROBIUM', 'BIBIT BOTOLAN', 'BRG000021', 35000, 75000, 17, 28, 5, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(22, '000022', 'SKU000022', 'PAKIS LEMPENG A0038 5', 'PRASARANA ANGGREK', 'SEEDLING', 'BRG000022', 2500, 5000, 846, 559, 73, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(23, '000023', 'SKU000023', 'B1 THAILAND A0045 45', 'PUPUK ANGGREK', 'OBAT-OBATAN', 'BRG000023', 37500, 45000, 64, 33, 1, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(24, '000024', 'SKU000024', 'SMILLIANE A0049 250', 'SPESIES', 'DEWASA', 'BRG000024', 175000, 250000, 1, 0, 1, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(25, '000025', 'SKU000025', 'SPECTABILE BESAR A0050 500', 'SPESIES', 'DEWASA', 'BRG000025', 175000, 500000, 6, 11, 3, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(28, '000028', 'SKU000028', 'DENDROBIUM A0061 65', 'DENDROBIUM', 'SEEDLING', 'BRG000028', 49000, 65000, 411, 327, 26, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(29, '000029', 'SKU000029', 'DENDROBIUM POT 18 A0064 85', 'DENDROBIUM', 'SEEDLING', 'BRG000029', 49000, 85000, 25, 41, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(30, '000030', 'SKU000030', 'DENDROBIUM A0065 55', 'DENDROBIUM', 'BUNGA', 'BRG000030', 37500, 55000, 51, 32, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(31, '000031', 'SKU000031', 'POT KREWENG 15CM A0066 5', 'PRASARANA ANGGREK', 'POT KREWENGAN', 'BRG000031', 3000, 5000, 243, 210, 73, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(32, '000032', 'SKU000032', 'POT SILINDER A0069 20CM 30', 'PRASARANA ANGGREK', 'SEEDLING', 'BRG000032', 12000, 30000, 304, 221, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(33, '000033', 'SKU000033', 'DENDROBIUM A0072 75', 'DENDROBIUM', 'BUNGA', 'BRG000033', 49000, 75000, 507, 356, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(34, '000034', 'SKU000034', 'POT SILINDER 15 CM A0070 20', 'PRASARANA ANGGREK', 'SEEDLING', 'BRG000034', 9000, 20000, 268, 188, 3, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(35, '000035', 'SKU000035', 'DENDROBIUM A0073 175', 'DENDROBIUM', 'DEWASA', 'BRG000035', 55000, 175000, 97, 57, 1, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(36, '000036', 'SKU000036', 'PUPUK GAVIOTA D A0075 35', 'PUPUK ANGGREK', 'OBAT-OBATAN', 'BRG000036', 27500, 35000, 88, 46, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(37, '000037', 'SKU000037', 'PUPUK GAVIOTA B A0076 35', 'PUPUK ANGGREK', 'OBAT-OBATAN', 'BRG000037', 27500, 35000, 105, 58, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(38, '000038', 'SKU000038', 'POT RAK KAYU 30X30X60 A0079 45', 'PRASARANA ANGGREK', 'POT KAYU', 'BRG000038', 35000, 45000, 219, 187, 25, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(39, '000039', 'SKU000039', 'SEED GRAMA A0080 65', 'GRAMA', 'SEEDLING', 'BRG000039', 60000, 65000, 6, 6, 19, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(41, '000041', 'SKU000041', 'DENDRO DMMH 150', 'DENDROBIUM', 'DEWASA', 'BRG000041', 75000, 150000, 46, 47, 2, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(42, '000042', 'SKU000042', 'DENDRO SPECTABILE A0053 250', 'DENDROBIUM', 'DEWASA', 'BRG000042', 175000, 250000, 12, 0, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(43, '000043', 'SKU000043', 'DENDRO A0064 POT 18 75', 'DENDROBIUM', 'SEEDLING', 'BRG000043', 48150, 75000, 11, 1, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(44, '000044', 'SKU000044', 'DENDRO A0063 250', 'DENDROBIUM', 'SEEDLING', 'BRG000044', 80250, 250000, 6, 0, 1, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(45, '000045', 'SKU000045', 'DENDRO A0062 185', 'DENDROBIUM', 'SEEDLING', 'BRG000045', 48150, 185000, 30, 18, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(46, '000046', 'SKU000046', 'VANDA HYBRID A0047 35', 'VANDA HYBRID', 'REMAJA', 'BRG000046', 15000, 35000, 6, 0, 4, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(47, '000047', 'SKU000047', 'CATELLYA A0011 125', 'CATLEYA', 'DEWASA', 'BRG000047', 75000, 125000, 17, 0, 8, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(48, '000048', 'SKU000048', 'GRAMA A0014 125', 'GRAMA', 'PRA REMAJA', 'BRG000048', 75000, 125000, 2, 0, 4, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(49, '000049', 'SKU000049', 'POT CATLEYA 15Ã¢â¬â¢ A0082 10', 'PRASARANA ANGGREK', 'POT', 'BRG000049', 5000, 10000, 1, 0, 11, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(50, '000050', 'SKU000050', 'POT CATLEYA 17Ã¢â¬â¢ A0081 15', 'PRASARANA ANGGREK', 'POT', 'BRG000050', 7500, 15000, 2, 0, 7, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(52, '000052', 'SKU000052', 'POT GANTUNG KAYU 15 CM A0086 20', 'PRASARANA ANGGREK', 'POT KAYU', 'BRG000052', 15000, 20000, 211, 128, 1, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(53, '000053', 'SKU000053', 'POT GANTUNG KAYU 10 CM A0085 15', 'PRASARANA ANGGREK', 'POT', 'BRG000053', 10000, 15000, 401, 309, 5, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(54, '000054', 'SKU000054', 'POT RAK KAYU 20x20x50 A0084 35', 'PRASARANA ANGGREK', 'POT KAYU', 'BRG000054', 25000, 35000, 489, 373, 3, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(55, '000055', 'SKU000055', 'KADAKA SETERIL A0087 15', 'MEDIA ANGGREK', 'MEDIA ANGGREK', 'BRG000055', 5000, 15000, 285, 5, 0, 0, 1, '', '', '0000-00-00', 'PACK', '', '', '', 'dist/upload/'),
(56, '000056', 'SKU000056', 'ARANG PACK A0088 15', 'MEDIA ANGGREK', 'MEDIA ANGGREK', 'BRG000056', 4500, 15000, 212, 40, 3, 0, 1, '', '', '0000-00-00', 'PACK', '', '', '', 'dist/upload/'),
(57, '000057', 'SKU000057', 'MEDIA HAMPERS 10', 'MEDIA ANGGREK', 'SEEDLING', 'BRG000057', 0, 10000, 96, 120, 74, 0, 1, '', '', '0000-00-00', 'PACK', '', '', '', 'dist/upload/'),
(59, '000059', 'SKU000059', 'PUPUK BANTAL PABRIK A0090 30', 'PUPUK ANGGREK', 'OBAT-OBATAN', 'BRG000059', 15000, 30000, 60, 16, 0, 0, 1, '', '', '0000-00-00', 'PACK', '', '', '', 'dist/upload/'),
(60, '000060', 'SKU000060', 'DENDRO FULL SUN FULL RAIN 35', 'DENDROBIUM', 'REMAJA', 'BRG000060', 10000, 35000, 23, 0, 2, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(61, '000061', 'SKU000061', 'HAMPERS PACK', 'PHALAENOPSIS', 'SEEDLING', 'BRG000061', 20000, 30000, 514, 0, 485, 0, 1, '', '', '0000-00-00', 'PAKET', '', '', '', 'dist/upload/'),
(62, '000062', 'SKU000062', 'ONGKIR AREA PURWOKERTO', 'PRASARANA ANGGREK', 'SEEDLING', 'BRG000062', 20000, 25000, 521, 0, 478, 0, 1, '', '', '0000-00-00', 'PAKET', '', '', '', 'dist/upload/'),
(63, '000063', 'SKU000063', 'PHALAENOPSIS PRA REMAJA MMH A0091 35', 'PHALAENOPSIS', 'PRA REMAJA', 'BRG000063', 26000, 35000, 155, 0, 81, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(64, '000064', 'SKU000064', 'PHALAENOPSIS PRA REMAJA MMH A0091  45', 'PHALAENOPSIS', 'REMAJA', 'BRG000064', 26000, 45000, 209, 9, 8, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(67, '000067', 'SKU000067', 'PHALAENOPSIS MINI BUNGA 75', 'PHALAENOPSIS', 'DEWASA', 'BRG000067', 50000, 75000, 192, 0, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(68, '000068', 'SKU000068', 'C.ROKSUSENI A0010 ', 'DENDROBIUM', 'DEWASA', 'BRG000068', 50000, 250000, 0, 0, 5, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(69, '000069', 'SKU000069', 'SERABUT KELAPA PACK A0093 10', 'PRASARANA ANGGREK', 'MEDIA ANGGREK', 'BRG000069', 2000, 10000, 30, 1, 41, 0, 1, '', '', '0000-00-00', 'PACK', '', '', '', 'dist/upload/'),
(70, '000070', 'SKU000070', 'WIJAYA KUSUMA 15', 'TANAMAN HIAS', 'TANAMAN HIAS', 'BRG000070', 5000, 15000, 5, 0, 5, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(71, '000071', 'SKU000071', 'DENDROBIUM SPEKTABILE REMAJA A0068 45', 'DENDROBIUM', 'REMAJA', 'BRG000071', 15000, 45000, 6, 5, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(72, '000072', 'SKU000072', 'POT VANDA 10Ã¢â¬â¢ A00083 5', 'PRASARANA ANGGREK', 'POT', 'BRG000051', 2500, 5000, 8, 0, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(73, '000073', 'SKU000073', 'VIRTAKO 10 ml 35', 'PUPUK ANGGREK', 'OBAT-OBATAN', 'BRG000073', 25000, 35000, 5, 0, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(74, '000074', 'SKU000074', 'PUPUK BANTAL REPACK 10', 'PUPUK ANGGREK', 'OBAT-OBATAN', 'BRG000074', 8340, 10000, 128, 39, 5, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(75, '000075', 'SKU000075', 'POT KR 15cm 35', 'PRASARANA ANGGREK', 'POT', 'BRG000075', 25000, 35000, 3, 0, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(76, '000076', 'SKU000076', 'POT TANAH DAUN 25', 'PRASARANA ANGGREK', 'POT', 'BRG000076', 13000, 25000, 135, 95, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(77, '000077', 'SKU000077', 'POT TANAH  DAUN TG/BL 45', 'PRASARANA ANGGREK', 'POT', 'BRG000077', 20000, 45000, 10, 5, 3, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(78, '000078', 'SKU000078', 'SEED DENDRO A0096 BS RO 25', 'DENDROBIUM', 'SEEDLING', 'BRG000078', 17500, 25000, 85, 10, 7, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(79, '000079', 'SKU000079', 'PAKIS BATANG CABANG', 'MEDIA ANGGREK', 'MEDIA ANGGREK', 'BRG000079', 75000, 200000, 0, 0, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(80, '000080', 'SKU000080', 'PAKIS BATANG', 'MEDIA ANGGREK', 'SEEDLING', 'BRG000080', 50000, 100000, 15, 10, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(81, '000081', 'SKU000081', 'PAKIS CACAH KANDI 35', 'MEDIA ANGGREK', 'MEDIA ANGGREK', 'BRG000081', 15000, 35000, 4, 0, 1, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(82, '000082', 'SKU000082', 'PHAL A0001 PASCA', 'PHALAENOPSIS', 'PASCA', 'BRG000082', 80000, 85000, 2, 0, 0, 0, 1, '', '', '0000-00-00', 'pcs', '', '', '', 'dist/upload/'),
(83, '000083', 'SKU000083', 'VANDA HYBRID JUMBO 250', 'VANDA HYBRID', 'BUNGA', 'BRG000083', 180000, 250000, 4, 0, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(84, '000084', 'SKU000084', 'ONCIDIUM 200', 'ONCYDIUM', 'BUNGA', 'BRG000084', 150000, 200000, 7, 1, 0, 0, 1, '', '', '0000-00-00', 'pcs', '', '', '', 'dist/upload/'),
(85, '000085', 'SKU000085', 'Tali Ijuk', '', 'SEEDLING', 'BRG000085', 10000, 15000, 12, 4, 0, 0, 11, '', '', '0000-00-00', '', '', '', '', 'dist/upload/'),
(87, '000087', 'SKU000087', 'DENDROBIUM SPC', 'DENDROBIUM', 'SEEDLING', 'BRG000087', 65000, 175000, 3, 0, 27, 0, 1, '', '', '0000-00-00', '', '', '', '', 'dist/upload/'),
(88, '000088', 'SKU000088', 'SEEDLING DENDRO PRA GRADE A 40', 'DENDROBIUM', 'SEEDLING', 'BRG000088', 16000, 40000, 15, 0, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(89, '000089', 'SKU000089', 'SEEDLING DENDRO PRA GRADE B 30', 'DENDROBIUM', 'SEEDLING', 'BRG000089', 16000, 30000, 101, 0, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(91, '000091', 'SKU000091', 'POT TIRUS', 'PRASARANA ANGGREK', 'POT', 'BRG000091', 9000, 15000, 50, 16, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(92, '000092', 'SKU000092', 'PAKIS CACAH', 'MEDIA ANGGREK', 'MEDIA ANGGREK', 'BRG000092', 5000, 10000, 44, 5, 6, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(93, '000093', 'SKU000093', 'SEED GRAMA 20', 'GRAMA', 'SEEDLING', 'BRG000093', 10000, 20000, 29, 0, 3, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(94, '000094', 'SKU000094', 'BEGONIA', 'TANAMAN HIAS', 'SEEDLING', 'BRG000094', 20000, 30000, 7, 10, 8, 0, 11, '', '', '0000-00-00', '', '', '', '', 'dist/upload/'),
(95, '000095', 'SKU000095', 'DENDROBIUM REMAJA A0084', 'DENDROBIUM', 'SEEDLING', 'BRG000095', 35000, 55000, 179, 153, 3, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(96, '000096', 'SKU000096', 'DENDROBIUM REMAJA  A0085', 'DENDROBIUM', 'SEEDLING', 'BRG000096', 40000, 55000, 133, 117, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(97, '000097', 'SKU000097', 'PHALAENOPSIS DEWASA DMMH 75', 'PHALAENOPSIS', 'DEWASA', 'BRG000097', 55000, 75000, 440, 184, 26, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(98, '000098', 'SKU000098', 'POT TERASO BESAR 100', 'PRASARANA ANGGREK', 'SEEDLING', 'BRG000098', 60000, 100000, 15, 9, 2, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(99, '000099', 'SKU000099', 'POT TERASO SEDANG75', 'PRASARANA ANGGREK', 'POT', 'BRG000099', 50000, 75000, 13, 4, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(100, '000100', 'SKU000100', 'DENDROBIUM A0072 RO 75', 'DENDROBIUM', 'BUNGA', 'BRG000100', 47500, 75000, 33, 14, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(101, '000101', 'SKU000101', 'DENDROBIUM A0061 RO 65', 'DENDROBIUM', 'BUNGA', 'BRG000101', 47500, 65000, 18, 2, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(102, '000102', 'SKU000102', 'DENDROBIUM A0073 RO 175', 'DENDROBIUM', 'BUNGA', 'BRG000102', 47500, 175000, 9, 2, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(103, '000103', 'SKU000103', 'DENDROBIUM A0064 RO ', 'DENDROBIUM', 'BUNGA', 'BRG000103', 55000, 150000, 17, 0, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(105, '000104', 'SKU000104', 'DENDROBIUM A0087 RO 150', 'DENDROBIUM', 'BUNGA', 'BRG000104', 65000, 150000, 2, 2, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(106, '000106', 'SKU000106', 'DENDROBIUM A0088 RO 125', 'DENDROBIUM', 'DEWASA', 'BRG000106', 85000, 125000, 2, 2, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(107, '000107', 'SKU000107', 'DENDROBIUM A0089 RO 75', 'DENDROBIUM', 'DEWASA', 'BRG000107', 45000, 75000, 24, 21, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(108, '000108', 'SKU000108', 'DENDROBIUM A0090 RO 75', 'DENDROBIUM', 'BUNGA', 'BRG000108', 50000, 85000, 8, 15, 1, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(109, '000109', 'SKU000109', 'DENDROBIUM A0091 RO 150', 'DENDROBIUM', 'BUNGA', 'BRG000109', 90000, 150000, 4, 4, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(110, '000110', 'SKU000110', 'POT TERASO KECIL 45', 'PRASARANA ANGGREK', 'POT', 'BRG000110', 30000, 45000, 26, 19, 1, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(111, '000111', 'SKU000111', 'TAMBAHAN 10K', '', 'SEEDLING', 'BRG000111', 0, 10000, 396, 0, 604, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(112, '000112', 'SKU000112', 'DENDROBIUM A0092 RO 175', 'DENDROBIUM', 'BUNGA', 'BRG000112', 125000, 175000, 6, 8, 2, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(113, '000113', 'SKU000113', 'DENDROBIUM A0093 RO 150', 'DENDROBIUM', 'BUNGA', 'BRG000113', 100000, 150000, 2, 0, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(114, '000114', 'SKU000114', 'DENDROBIUM A0094 RO 150', 'DENDROBIUM', 'DEWASA', 'BRG000114', 75000, 150000, 4, 0, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(115, '000115', 'SKU000115', 'DENDDRO STREPSI RO 85', 'DENDROBIUM', 'DEWASA', 'BRG000115', 45000, 85000, 38, 15, 1, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(116, '000116', 'SKU000116', 'DENDRO NOPORN RO 85', 'DENDROBIUM', 'DEWASA', 'BRG000116', 50000, 85000, 65, 15, 9, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(118, '000118', 'SKU000118', 'PAKIS GANTUNG 70CM 35', 'MEDIA ANGGREK', 'MEDIA ANGGREK', 'BRG000118', 15000, 35000, 69, 30, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(119, '000119', 'SKU000119', 'POT TANAH DAUN SEDANG 25', 'PRASARANA ANGGREK', 'SEEDLING', 'BRG000119', 15000, 25000, 3, 0, 0, 0, 11, '', '', '0000-00-00', 'SCP', '', '', '', 'dist/upload/'),
(120, '000120', 'SKU000120', 'DENDRO HTO A0098 RO DEWASA 100-350', 'DENDROBIUM', 'SEEDLING', 'BRG000120', 130000, 150000, 48, 44, 77, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(121, '000121', 'SKU000121', 'PANDURATA 85', 'SPESIES', 'DEWASA', 'BRG000121', 25000, 85000, 8, 0, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(122, '000122', 'SKU000122', 'DENDRO PRA A0095 RO BS 40', 'DENDROBIUM', 'SEEDLING', 'BRG000122', 35000, 40000, 131, 16, 14, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(123, '000123', 'SKU000123', 'DENDRO PRA RO A0097 SPC 100', 'DENDROBIUM', 'PRA REMAJA', 'BRG000123', 50000, 75000, 9, 25, 38, 0, 1, '', '', '0000-00-00', 'PCS', '', '', ',RIO ORCHID', 'dist/upload/'),
(124, '000124', 'SKU000124', 'DENDRO PRA A0095 SG 40', 'DENDROBIUM', 'PRA REMAJA', 'BRG000124', 17000, 40000, 55, 0, 24, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(125, '000125', 'SKU000125', 'HAMPERS WRAPPING', 'PRASARANA ANGGREK', 'MEDIA ANGGREK', 'BRG000125', 25000, 40000, 54, 24, 0, 0, 1, '', '', '0000-00-00', 'PCS', '', '', '', 'dist/upload/'),
(126, '000126', 'SKU000126', 'SEED A0005 RO 30', 'DENDROBIUM', 'SEEDLING', 'BRG000126', 15000, 30000, 2, 0, 7, 0, 11, '', '', '0000-00-00', 'SCP', '', '', '', 'dist/upload/');

-- Normalize legacy invalid zero date.
UPDATE tmp_legacy_products
SET expired = NULL
WHERE expired = '0000-00-00';

-- 1) Insert categories (skip empty names), preserve old code when available.
INSERT INTO categories (name, code, slug)
SELECT src.name, src.code, src.slug
FROM (
  SELECT DISTINCT
    TRIM(c.nama) AS name,
    NULLIF(TRIM(c.kode), '') AS code,
    LOWER(REPLACE(REPLACE(REPLACE(TRIM(c.nama), ' ', '-'), '/', '-'), '--', '-')) AS slug
  FROM tmp_legacy_categories c
  WHERE TRIM(COALESCE(c.nama, '')) <> ''

  UNION

  SELECT DISTINCT
    TRIM(p.kategori) AS name,
    NULL AS code,
    LOWER(REPLACE(REPLACE(REPLACE(TRIM(p.kategori), ' ', '-'), '/', '-'), '--', '-')) AS slug
  FROM tmp_legacy_products p
  WHERE TRIM(COALESCE(p.kategori, '')) <> ''
) src
LEFT JOIN categories c_exist ON c_exist.name = src.name
WHERE c_exist.id IS NULL;

-- 2) Insert products with deduped sku/barcode for UNIQUE safety.
INSERT INTO products (
  sku, barcode, name, description, image_path, supplier_id,
  purchase_price, sell_price, stock, min_stock, unit, location, brand, is_active
)
SELECT
  CASE
    WHEN d.sku_base = '' THEN CONCAT('SKU-', LPAD(d.kode_num, 6, '0'))
    WHEN d.sku_dup_n = 1 THEN d.sku_base
    ELSE CONCAT(d.sku_base, '-', d.sku_dup_n)
  END AS sku,
  CASE
    WHEN d.barcode_base = '' THEN NULL
    WHEN d.barcode_dup_n = 1 THEN d.barcode_base
    ELSE CONCAT(d.barcode_base, '-', d.barcode_dup_n)
  END AS barcode,
  d.product_name,
  NULLIF(TRIM(d.keterangan), ''),
  NULLIF(TRIM(d.avatar), ''),
  NULL,
  COALESCE(d.hargabeli, 0),
  COALESCE(d.hargajual, 0),
  GREATEST(COALESCE(d.sisa, 0), 0),
  GREATEST(COALESCE(d.stokmin, 0), 0),
  CASE WHEN TRIM(COALESCE(d.satuan, '')) = '' THEN 'PCS' ELSE UPPER(TRIM(d.satuan)) END,
  NULLIF(TRIM(d.lokasi), ''),
  NULLIF(TRIM(d.brand), ''),
  1
FROM (
  SELECT
    p.no,
    p.kode,
    CAST(COALESCE(NULLIF(p.kode, ''), '0') AS UNSIGNED) AS kode_num,
    TRIM(COALESCE(p.sku, '')) AS sku_base,
    TRIM(COALESCE(p.barcode, '')) AS barcode_base,
    TRIM(COALESCE(p.nama, '')) AS product_name,
    p.keterangan,
    p.avatar,
    p.hargabeli,
    p.hargajual,
    p.sisa,
    p.stokmin,
    p.satuan,
    p.lokasi,
    p.brand,
    ROW_NUMBER() OVER (PARTITION BY TRIM(COALESCE(p.sku, '')) ORDER BY p.no) AS sku_dup_n,
    ROW_NUMBER() OVER (PARTITION BY TRIM(COALESCE(p.barcode, '')) ORDER BY p.no) AS barcode_dup_n
  FROM tmp_legacy_products p
  WHERE TRIM(COALESCE(p.nama, '')) <> ''
) d
LEFT JOIN products p_exist ON p_exist.name = d.product_name
WHERE p_exist.id IS NULL;

-- 3) Link products to categories by legacy product-category text.
INSERT IGNORE INTO product_categories (product_id, category_id)
SELECT p_new.id, c.id
FROM tmp_legacy_products lp
JOIN products p_new
  ON p_new.name = TRIM(lp.nama)
JOIN categories c
  ON c.name = TRIM(lp.kategori)
WHERE TRIM(COALESCE(lp.kategori, '')) <> '';

DROP TEMPORARY TABLE IF EXISTS tmp_legacy_categories;
DROP TEMPORARY TABLE IF EXISTS tmp_legacy_products;

SET FOREIGN_KEY_CHECKS = 1;
