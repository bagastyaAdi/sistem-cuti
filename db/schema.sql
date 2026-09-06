-- =====================================================================
--  Sistem Cuti Puspem Badung — skema Supabase
--  Jalankan di: Supabase Dashboard -> SQL Editor -> New query -> Run
-- =====================================================================

-- ---------- TABEL ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  nip         text unique not null,
  nama        text not null,
  jabatan     text default '',
  unit        text default 'Dinas Komunikasi dan Informatika',
  hp          text default '',
  masa_kerja  text default '',
  ttd_path    text default '',   -- gambar tanda tangan pegawai (bagian VI surat)
  ttd_pos     jsonb default '{}'::jsonb,  -- ukuran & geser TTD pegawai: {w,x,y}
  role        text not null default 'pegawai' check (role in ('pegawai','admin')),
  created_at  timestamptz default now()
);

create table if not exists public.pengajuan (
  id             uuid primary key default gen_random_uuid(),
  pemohon        uuid not null references public.profiles(id) on delete cascade,
  jenis          text not null default 'Tahunan',
  alasan         text not null,
  mulai          date not null,
  selesai        date not null,
  alamat         text default '',
  telp           text default '',
  sisa_n         int  default 6,
  dokumen        jsonb default '[]'::jsonb,
  status         text not null default 'Menunggu Verifikasi'
                 check (status in ('Menunggu Verifikasi','Perlu Revisi','Disetujui','Tidak Disetujui')),
  catatan_revisi text default '',
  nomor          text default '',
  tgl_ajukan     date not null default current_date,
  tgl_surat      date,
  template_snapshot jsonb,
  verifikator    uuid references public.profiles(id),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
-- nama constraint FK dipakai oleh query embed di frontend:
alter table public.pengajuan drop constraint if exists pengajuan_pemohon_fkey;
alter table public.pengajuan add  constraint pengajuan_pemohon_fkey
  foreign key (pemohon) references public.profiles(id) on delete cascade;

create table if not exists public.pengaturan (
  id             int primary key default 1 check (id = 1),
  pejabat_kepala jsonb default '{"jabatan":"Kepala Dinas Komunikasi dan Informatika","nama":"","nip":""}'::jsonb,
  pejabat_atasan jsonb default '{"jabatan":"Kepala Bidang Layanan E-Government","nama":"","nip":""}'::jsonb,
  nomor_format   text  default '800.1.11.4/{no}/Diskominfo',
  counter        int   default 1,
  show_legal     boolean default true,
  ttd_path       text  default '',           -- TTD Kepala Dinas (bagian VIII)
  ttd_atasan_path text default '',           -- TTD Kepala Bidang / atasan langsung (bagian VII)
  cap_path       text  default '',           -- cap dinas, hanya bagian VIII (menumpuk TTD Kepala Dinas)
  legal_pos      jsonb default '{}'::jsonb,  -- offset yang diatur admin: {dinas:{x,y,w}, bidang:{x,y,w}, cap:{x,y,w}}
  template       jsonb default '{}'::jsonb   -- teks tetap surat yang bisa diedit admin
);
insert into public.pengaturan (id) values (1) on conflict (id) do nothing;

-- ---------- HELPER ----------
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- RLS ----------
alter table public.profiles   enable row level security;
alter table public.pengajuan  enable row level security;
alter table public.pengaturan enable row level security;

-- profiles
drop policy if exists "profil dibaca sendiri/admin" on public.profiles;
create policy "profil dibaca sendiri/admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "daftar pegawai" on public.profiles;
create policy "daftar pegawai" on public.profiles
  for insert with check (id = auth.uid() and role = 'pegawai');

drop policy if exists "ubah profil sendiri" on public.profiles;
create policy "ubah profil sendiri" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists "admin kelola profil" on public.profiles;
create policy "admin kelola profil" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- pengajuan
drop policy if exists "pemohon baca sendiri / admin baca semua" on public.pengajuan;
create policy "pemohon baca sendiri / admin baca semua" on public.pengajuan
  for select using (pemohon = auth.uid() or public.is_admin());

drop policy if exists "pemohon buat sendiri" on public.pengajuan;
create policy "pemohon buat sendiri" on public.pengajuan
  for insert with check (pemohon = auth.uid());

drop policy if exists "pemohon perbaiki saat revisi" on public.pengajuan;
create policy "pemohon perbaiki saat revisi" on public.pengajuan
  for update using (pemohon = auth.uid() and status in ('Perlu Revisi','Menunggu Verifikasi'))
  with check (pemohon = auth.uid());

drop policy if exists "admin proses pengajuan" on public.pengajuan;
create policy "admin proses pengajuan" on public.pengajuan
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin hapus pengajuan" on public.pengajuan;
create policy "admin hapus pengajuan" on public.pengajuan
  for delete using (public.is_admin());

-- pengaturan
drop policy if exists "semua yang login baca pengaturan" on public.pengaturan;
create policy "semua yang login baca pengaturan" on public.pengaturan
  for select using (auth.role() = 'authenticated');

drop policy if exists "admin ubah pengaturan" on public.pengaturan;
create policy "admin ubah pengaturan" on public.pengaturan
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------- RPC: terbitkan nomor + setujui (atomik) ----------
create or replace function public.terbitkan_cuti(p_id uuid)
returns public.pengajuan
language plpgsql security definer set search_path = public as $$
declare
  s public.pengaturan;
  n int;
  bln text;
  no_surat text;
  rec public.pengajuan;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin kepegawaian yang dapat menerbitkan nomor.';
  end if;

  select * into s from public.pengaturan where id = 1 for update;
  n := s.counter;
  bln := (array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'])[extract(month from current_date)::int];

  no_surat := s.nomor_format;
  no_surat := replace(no_surat, '{no3}', lpad(n::text, 3, '0'));
  no_surat := replace(no_surat, '{no}',  n::text);
  no_surat := replace(no_surat, '{bulan}', bln);
  no_surat := replace(no_surat, '{tahun}', extract(year from current_date)::text);

  update public.pengaturan set counter = counter + 1 where id = 1;

  update public.pengajuan
     set status = 'Disetujui', nomor = no_surat, tgl_surat = current_date,
         catatan_revisi = '', verifikator = auth.uid(), updated_at = now(),
         template_snapshot = jsonb_build_object(
           'template',       coalesce(s.template, '{}'::jsonb),
           'pejabat_kepala', s.pejabat_kepala,
           'pejabat_atasan', s.pejabat_atasan,
           'ttd_path',        s.ttd_path,
           'ttd_atasan_path', s.ttd_atasan_path,
           'cap_path',        s.cap_path,
           'legal_pos',       coalesce(s.legal_pos, '{}'::jsonb),
           'show_legal',      s.show_legal)
   where id = p_id
   returning * into rec;

  return rec;
end $$;

-- ---------- STORAGE ----------
insert into storage.buckets (id, name, public) values ('legalitas','legalitas', true)  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('dokumen','dokumen',   true)  on conflict (id) do nothing;

drop policy if exists "legalitas dibaca publik" on storage.objects;
create policy "legalitas dibaca publik" on storage.objects
  for select using (bucket_id = 'legalitas');
drop policy if exists "admin kelola legalitas" on storage.objects;
create policy "admin kelola legalitas" on storage.objects
  for all using (bucket_id = 'legalitas' and public.is_admin())
  with check (bucket_id = 'legalitas' and public.is_admin());

drop policy if exists "dokumen dibaca publik" on storage.objects;
create policy "dokumen dibaca publik" on storage.objects
  for select using (bucket_id = 'dokumen');
drop policy if exists "pemohon unggah dokumen sendiri" on storage.objects;
create policy "pemohon unggah dokumen sendiri" on storage.objects
  for insert with check (bucket_id = 'dokumen' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "pemohon perbarui berkas sendiri" on storage.objects;
create policy "pemohon perbarui berkas sendiri" on storage.objects
  for update using (bucket_id = 'dokumen' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'dokumen' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- HAK AKSES ROLE (WAJIB — kalau lewat: error 42501 "permission denied for table") ----------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles  to anon, authenticated;
grant select, insert, update, delete on public.pengajuan  to anon, authenticated;
grant select, update                 on public.pengaturan  to anon, authenticated;
grant execute on function public.is_admin()            to anon, authenticated;
grant execute on function public.terbitkan_cuti(uuid)  to authenticated;

-- =====================================================================
--  PENGATURAN DASHBOARD (WAJIB sebelum aplikasi bisa dipakai)
--  Authentication -> Sign In / Providers -> Email:
--    - "Confirm email"          : OFF   (pendaftaran langsung aktif; email tetap dipakai
--                                        untuk fitur "Lupa kata sandi")
--    - "Minimum password length": 4     (agar sandi pendek seperti "bagas"/"cuti" diterima)
-- =====================================================================
--  MEMBUAT AKUN ADMIN KEPEGAWAIAN
--  1) Authentication -> Users -> Add user
--       Email: (email admin, mis. gmail),  Password: (pilih),  Auto Confirm User: ON
--  2) Salin User UID-nya, lalu jalankan (ganti nilainya):
--
--     insert into public.profiles (id, nip, nama, jabatan, unit, role)
--     values ('UID-DARI-DASHBOARD', '198701012010011001', 'Dian ...',
--             'Kepala Sub Bagian Kepegawaian', 'Dinas Komunikasi dan Informatika', 'admin');
--
--  Pegawai cukup mendaftar sendiri lewat halaman "Daftar Pegawai".
--  Untuk menaikkan pegawai yang sudah ada jadi admin:
--     update public.profiles set role = 'admin' where nip = '<nip-pegawai>';
-- =====================================================================
