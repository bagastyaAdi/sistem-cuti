-- =====================================================================
--  MIGRASI LENGKAP — jalankan SEKALI di Supabase SQL Editor.
--  Aman diulang. Sudah mencakup: template surat, TTD terpisah per
--  pejabat, cap, posisi TTD/cap, dan TTD + posisi milik pegawai.
--  Setelah run, tekan tombol "Reload schema" tak perlu — baris NOTIFY
--  di bawah sudah menyegarkan cache PostgREST.
-- =====================================================================

-- ---------- KOLOM BARU ----------
alter table public.pengaturan add column if not exists template         jsonb default '{}'::jsonb;
alter table public.pengaturan add column if not exists ttd_path         text  default '';   -- TTD Kepala Dinas (bagian VIII)
alter table public.pengaturan add column if not exists ttd_atasan_path  text  default '';   -- TTD Kepala Bidang (bagian VII)
alter table public.pengaturan add column if not exists cap_path         text  default '';   -- cap dinas (bagian VIII)
alter table public.pengaturan add column if not exists legal_pos        jsonb default '{}'::jsonb; -- {dinas:{x,y,w},bidang:{x,y,w},cap:{x,y,w}}
alter table public.pengaturan add column if not exists show_legal       boolean default true;

alter table public.pengajuan  add column if not exists template_snapshot jsonb;

alter table public.profiles   add column if not exists ttd_path text default '';             -- TTD pegawai (bagian VI)
alter table public.profiles   add column if not exists ttd_pos  jsonb default '{}'::jsonb;   -- {w,x,y}

update public.pengaturan set template  = '{}'::jsonb where template  is null;
update public.pengaturan set legal_pos = '{}'::jsonb where legal_pos is null;

-- ---------- IZIN STORAGE: pegawai boleh unggah ULANG (upsert) berkasnya ----------
drop policy if exists "pemohon perbarui berkas sendiri" on storage.objects;
create policy "pemohon perbarui berkas sendiri" on storage.objects
  for update using (bucket_id = 'dokumen' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'dokumen' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- RPC PENERBITAN NOMOR + SNAPSHOT ----------
create or replace function public.terbitkan_cuti(p_id uuid)
returns public.pengajuan
language plpgsql security definer set search_path = public as $$
declare
  s public.pengaturan;
  n int; bln text; no_surat text; rec public.pengajuan;
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

  update public.pengajuan set
    status = 'Disetujui', nomor = no_surat, tgl_surat = current_date,
    catatan_revisi = '', verifikator = auth.uid(), updated_at = now(),
    template_snapshot = jsonb_build_object(
      'template',        coalesce(s.template, '{}'::jsonb),
      'pejabat_kepala',  s.pejabat_kepala,
      'pejabat_atasan',  s.pejabat_atasan,
      'ttd_path',        s.ttd_path,
      'ttd_atasan_path', s.ttd_atasan_path,
      'cap_path',        s.cap_path,
      'legal_pos',       coalesce(s.legal_pos, '{}'::jsonb),
      'show_legal',      s.show_legal
    )
  where id = p_id
  returning * into rec;

  return rec;
end $$;

grant execute on function public.terbitkan_cuti(uuid) to authenticated;

-- ---------- SEGARKAN CACHE POSTGREST ----------
notify pgrst, 'reload schema';
