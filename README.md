# Sistem Cuti Puspem Badung

Aplikasi pengajuan & verifikasi surat cuti pegawai Dinas Komunikasi dan Informatika
Kabupaten Badung. Frontend statis (HTML + CSS + JS, tanpa build), backend **Supabase**
(Postgres + Auth + Storage). Portal Pegawai dan Portal Kepegawaian terpisah.

Login pakai **email + kata sandi**. Pegawai mendaftar sendiri. Ada pemulihan
kata sandi lewat email (`reset.html`).

## Alur

```
Pegawai daftar / masuk (NIP + kata sandi)
        │
        ▼
Isi formulir cuti  →  Preview Surat (dokumen A4)  →  Ajukan Surat
        │
        ▼
Status: Menunggu Verifikasi
        │
        ▼
Admin Kepegawaian  →  Periksa data + dokumen
        │
   ┌────┴─────┐
Tidak sesuai   Sesuai
   │            │
Perlu Revisi   Disetujui  →  nomor surat terbit otomatis (+1)
   │            │              tanda tangan & cap dinas ditempel
Pegawai         │
perbaiki &      ▼
kirim ulang   Cetak / Unduh PDF
```

## Menjalankan

### 1. Buat project Supabase
1. https://supabase.com → New project.
2. **SQL Editor** → tempel isi `db/schema.sql` → **Run**.
3. **Authentication → Providers → Email** → matikan *Confirm email*.
4. Buat akun admin pertama — ikuti komentar di bagian bawah `db/schema.sql`.

### 2. Hubungkan frontend
Edit `assets/config.js`:
```js
window.CUTI_CONFIG = {
  SUPABASE_URL: "https://xxxx.supabase.co",   // Settings → API → Project URL
  SUPABASE_ANON_KEY: "eyJ...",                // Settings → API → anon public
};
```

### 3. Deploy
Situs statis — deploy folder ini apa adanya.
- **Vercel:** `vercel.com/new` → import repo → Framework **Other** → Deploy.
- **Lokal:** `python -m http.server 5177` lalu buka `http://127.0.0.1:5177`.

## Struktur

| Berkas | Isi |
|---|---|
| `index.html` | Halaman masuk / daftar pegawai |
| `pegawai.html` | Portal pegawai — beranda, ajukan cuti, riwayat, profil |
| `admin.html` | Portal kepegawaian — antrean, semua pengajuan, data pegawai, pengaturan |
| `assets/db.js` | Lapisan data Supabase |
| `assets/surat.js` | Pembangun dokumen A4 + cetak |
| `db/schema.sql` | Tabel, Row Level Security, RPC, bucket storage |
| `db/migrasi-template.sql` | Migrasi: kolom `template` (teks surat editable) + snapshot |

## Template surat

Seluruh teks tetap surat (kepala surat, judul, tujuan, kalimat penutup,
judul bagian I–VIII, catatan kaki, logo) diedit admin di **Pengaturan →
Template Surat** — tersimpan di `pengaturan.template` (JSONB), bukan hardcode.
Kolom yang dikosongkan memakai teks bawaan.

Saat surat **disetujui**, template + pejabat + TTD/cap disalin ke
`pengajuan.template_snapshot`. Jadi kalau template diubah kemudian, surat yang
sudah terbit tetap tercetak sama; hanya draf/menunggu yang ikut versi terbaru.

## Keamanan
- `anon key` aman di frontend — akses dibatasi Row Level Security per peran.
- Pegawai hanya melihat/mengubah pengajuannya sendiri.
- Hanya admin yang dapat menyetujui, meminta revisi, menolak, dan mengubah pengaturan.
- Penerbitan nomor surat berjalan atomik lewat fungsi `terbitkan_cuti`.
