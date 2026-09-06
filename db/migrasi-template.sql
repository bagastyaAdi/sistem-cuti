-- =====================================================================
--  Migrasi: template surat yang bisa diedit + snapshot saat penerbitan
--  Jalankan sekali di Supabase SQL Editor (aman diulang).
-- =====================================================================

alter table public.pengaturan add column if not exists template jsonb default '{}'::jsonb;
alter table public.pengajuan  add column if not exists template_snapshot jsonb;
update public.pengaturan set template = '{}'::jsonb where template is null;

-- RPC penerbitan nomor + snapshot template (agar cetak ulang surat lama tetap sama)
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
      'template',       coalesce(s.template, '{}'::jsonb),
      'pejabat_kepala', s.pejabat_kepala,
      'pejabat_atasan', s.pejabat_atasan,
      'ttd_path',       s.ttd_path,
      'cap_path',       s.cap_path,
      'show_legal',     s.show_legal
    )
  where id = p_id
  returning * into rec;

  return rec;
end $$;

grant execute on function public.terbitkan_cuti(uuid) to authenticated;
