# POS Keuangan

Fullstack POS & analisis keuangan (React + Vite + Express + MySQL).

## Struktur

- `client/` — frontend React (Vite, Tailwind, Zustand, Recharts, dsb.)
- `server/server.js` — seluruh API Express dalam satu file
- `database/schema.sql` & `database/seed.sql` — skema & data demo

## Prasyarat

- Node.js 18+
- MySQL 8+

## Database

```bash
mysql -u root -p -e "CREATE DATABASE pos_keuangan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p pos_keuangan < database/schema.sql
mysql -u root -p pos_keuangan < database/seed.sql
```

## Backend

```bash
cd server
cp .env.example .env
# isi DB_* dan JWT_SECRET
npm install
npm start
# API: http://localhost:4000
```

## Frontend

```bash
cd client
npm install
npm run dev
# App: http://localhost:5173 (proxy ke /api)
```

## Akun demo (password: `password`)

- `admin@pos.local` — Admin  
- `kasir@pos.local` — Kasir  
- `owner@pos.local` — Owner  

## Produksi

Build frontend: `npm run build --prefix client` — statik di `client/dist`.  
Service worker & manifest PWA ada di `public/`; registrasi SW aktif saat `import.meta.env.PROD`.

Jalankan API dengan `server/server.js`. Gambar produk disimpan sebagai path relatif (`/uploads/...`); untuk `<img>` gunakan helper `uploadSrc` di client (`VITE_API_ORIGIN` jika API beda host dari SPA).
# pos-keuangan
