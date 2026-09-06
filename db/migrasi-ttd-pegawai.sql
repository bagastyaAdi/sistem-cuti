-- Migrasi: tanda tangan pegawai (muncul di bagian VI surat).
-- Jalankan sekali di Supabase SQL Editor. Aman diulang.

alter table public.profiles add column if not exists ttd_path text default '';

-- Pegawai menyimpan gambar TTD ke bucket "dokumen" pada folder <uid>/,
-- kebijakan storage yang sudah ada ("pemohon unggah dokumen sendiri") sudah mengizinkan.
