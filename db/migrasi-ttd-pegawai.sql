-- Migrasi: tanda tangan pegawai (muncul di bagian VI surat).
-- Jalankan sekali di Supabase SQL Editor. Aman diulang.

alter table public.profiles add column if not exists ttd_path text default '';

-- Pegawai menyimpan gambar TTD ke bucket "dokumen" pada folder <uid>/.
-- INSERT sudah diizinkan kebijakan "pemohon unggah dokumen sendiri".
-- Tambah izin UPDATE agar unggah ulang (upsert) tanda tangan tidak ditolak RLS:
drop policy if exists "pemohon perbarui berkas sendiri" on storage.objects;
create policy "pemohon perbarui berkas sendiri" on storage.objects
  for update using (bucket_id = 'dokumen' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'dokumen' and (storage.foldername(name))[1] = auth.uid()::text);
