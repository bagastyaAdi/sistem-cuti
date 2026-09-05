/* Pembangun dokumen "FORMULIR PERMINTAAN DAN PEMBERIAN CUTI" (A4) + cetak. */
(function () {
  "use strict";
  var esc = DB.esc, fmtID = DB.fmtID, hari = DB.hariCuti, S = DB.STATUS;

  function chk(on){ return on ? '<span class="chk">&#10003;</span>' : ""; }

  function kop(){
    return '<div class="kop"><div style="width:74px"><img src="logo-badung.png" alt="Lambang Kabupaten Badung" style="width:100%"></div><div class="l">'
      + '<div class="b" style="font-size:15px">PEMERINTAH KABUPATEN BADUNG</div>'
      + '<div class="b" style="font-size:15px">DINAS KOMUNIKASI DAN INFORMATIKA</div>'
      + '<div style="font-size:10.5px">PUSAT PEMERINTAHAN KABUPATEN BADUNG &ldquo;MANGUPRAJA MANDALA&rdquo;</div>'
      + '<div style="font-size:10.5px">Jl. Raya Sempidi, Kel. Sempidi, Kec. Mengwi, Kab. Badung &ndash; Bali</div>'
      + '<div style="font-size:10.5px">Telp. (0361) 419888, (0361) 9066229, Kode Pos 80351 &middot; Email: diskominfo@badungkab.go.id</div>'
      + '</div></div>';
  }

  function catatan(p){
    if(p.status===S.SETUJU) return 'Diverifikasi &amp; diterbitkan oleh Sub Bagian Kepegawaian pada '+fmtID(p.tgl_surat)+'.';
    if(p.status===S.TOLAK) return 'Pengajuan tidak disetujui oleh Sub Bagian Kepegawaian.';
    if(p.status===S.REVISI) return 'Perlu revisi &mdash; '+esc(p.catatan_revisi||'silakan perbaiki data lalu kirim ulang.');
    return 'Draf &mdash; menunggu verifikasi Sub Bagian Kepegawaian. Nomor surat terbit otomatis setelah disetujui.';
  }

  // p = row pengajuan (dengan p.pemohon), s = row pengaturan
  function suratHTML(p, s){
    s = s || {};
    var m = p.pemohon || {};
    var pk = s.pejabat_kepala || {}, pa = s.pejabat_atasan || {};
    var approved = p.status===S.SETUJU, rejected = p.status===S.TOLAK;
    var dec = approved ? "ok" : rejected ? "no" : "";
    var legal = approved && s.show_legal !== false;
    var J = function(k){ return p.jenis===k; };

    var jenisRows =
      '<tr><td>1. Cuti Tahunan</td><td class="ctr">'+chk(J("Tahunan"))+'</td><td>2. Cuti Besar</td><td class="ctr">'+chk(J("Besar"))+'</td></tr>'
      +'<tr><td>3. Cuti Sakit</td><td class="ctr">'+chk(J("Sakit"))+'</td><td>4. Cuti Melahirkan</td><td class="ctr">'+chk(J("Melahirkan"))+'</td></tr>'
      +'<tr><td>5. Cuti Karena Alasan Penting</td><td class="ctr">'+chk(J("Karena Alasan Penting"))+'</td><td>6. Cuti di Luar Tanggungan Negara</td><td class="ctr">'+chk(J("Di Luar Tanggungan Negara"))+'</td></tr>';

    var decRow =
      '<tr><td class="ctr b">DISETUJUI<br>'+chk(dec==="ok")+'</td>'
      +'<td class="ctr b">PERUBAHAN<br></td>'
      +'<td class="ctr b">DITANGGUHKAN<br></td>'
      +'<td class="ctr b">TIDAK DISETUJUI<br>'+chk(dec==="no")+'</td></tr>';

    function sigArea(pej, tinggi){
      var stamp = "";
      if(legal){
        if(s.cap_path) stamp += '<img alt="Cap" src="'+esc(s.cap_path)+'" style="position:absolute;left:-44px;top:-4px;width:118px;opacity:.82">';
        if(s.ttd_path) stamp += '<img alt="TTD" src="'+esc(s.ttd_path)+'" style="position:absolute;left:8px;top:2px;width:128px">';
      }
      var gap = legal ? '<div style="position:relative;height:'+(tinggi-30)+'px;width:230px">'+stamp+'</div>' : '<br><br><br>';
      return esc(pej.jabatan||"")+',<br>'+gap+'('+esc(pej.nama||"..............................")+')<br>NIP. '+esc(pej.nip||"..............................");
    }

    var dok = (p.dokumen && p.dokumen.length)
      ? '<br><br>Dokumen pendukung: '+esc(p.dokumen.map(function(d){ return d.name||d; }).join(", "))
      : "";

    return '<div class="paper">'
      + kop()
      + '<table class="nb" style="margin-bottom:10px"><tr><td style="width:55%"></td>'
      +   '<td>Mangupura, '+(p.tgl_ajukan?fmtID(p.tgl_ajukan):"........................")+'<br>Kepada<br>Yth. Kepala Dinas Komunikasi dan Informatika Kabupaten Badung<br>di -<br>&nbsp;&nbsp;&nbsp;&nbsp;Mangupura</td></tr></table>'
      + '<div class="ctr b" style="text-decoration:underline;font-size:14px">FORMULIR PERMINTAAN DAN PEMBERIAN CUTI</div>'
      + '<div class="ctr" style="margin-bottom:10px">Nomor : '+esc(p.nomor||".................../Diskominfo")+'</div>'

      + '<table><tr><td colspan="4" class="st">I. DATA PEGAWAI</td></tr>'
      +   '<tr><td style="width:22%">Nama</td><td style="width:38%">'+esc(m.nama)+'</td><td style="width:15%">NIP</td><td class="tnum">'+esc(m.nip)+'</td></tr>'
      +   '<tr><td>Jabatan</td><td>'+esc(m.jabatan)+'</td><td>Masa Kerja</td><td>'+esc(m.masa_kerja||"-")+'</td></tr>'
      +   '<tr><td>Unit Kerja</td><td colspan="3">'+esc(m.unit)+'</td></tr></table>'

      + '<table style="border-top:0"><tr><td colspan="4" class="st">II. JENIS CUTI YANG DIAMBIL</td></tr>'+jenisRows+'</table>'
      + '<table style="border-top:0"><tr><td class="st">III. ALASAN CUTI</td></tr><tr><td>'+esc(p.alasan)+'</td></tr></table>'
      + '<table style="border-top:0"><tr><td colspan="4" class="st">IV. LAMANYA CUTI</td></tr>'
      +   '<tr><td style="width:12%">Selama</td><td style="width:20%">'+hari(p.mulai,p.selesai)+' (hari)</td>'
      +      '<td style="width:16%">Mulai Tanggal</td><td>'+fmtID(p.mulai)+' s/d '+fmtID(p.selesai)+'</td></tr></table>'

      + '<table style="border-top:0"><tr><td colspan="2" class="st">V. CATATAN CUTI</td></tr>'
      +   '<tr><td style="width:60%">1. Cuti Tahunan &mdash; sisa tahun berjalan (N)</td><td class="tnum">'+esc(p.sisa_n)+'</td></tr>'
      +   '<tr><td>2. Cuti Besar</td><td class="tnum">0</td></tr><tr><td>3. Cuti Sakit</td><td class="tnum">0</td></tr>'
      +   '<tr><td>4. Cuti Melahirkan</td><td class="tnum">0</td></tr><tr><td>5. Cuti Karena Alasan Penting</td><td class="tnum">0</td></tr>'
      +   '<tr><td>6. Cuti di Luar Tanggungan Negara</td><td class="tnum">0</td></tr></table>'

      + '<table style="border-top:0"><tr><td colspan="2" class="st">VI. ALAMAT SELAMA MENJALANKAN CUTI</td></tr>'
      +   '<tr><td style="width:70%">'+esc(p.alamat||"(sesuai alamat domisili pada data kepegawaian)")+dok+'</td>'
      +      '<td>No. HP / TELP<br>'+esc(p.telp)+'<br><br>Hormat Saya,<br><br><br>('+esc(m.nama)+')<br>NIP. '+esc(m.nip)+'</td></tr></table>'

      + '<table style="border-top:0"><tr><td colspan="4" class="st">VII. PERTIMBANGAN ATASAN LANGSUNG</td></tr>'+decRow
      +   '<tr><td colspan="4" style="height:96px;position:relative">'+(dec? sigArea(pa,70) : "")+'</td></tr></table>'

      + '<table style="border-top:0"><tr><td colspan="4" class="st">VIII. KEPUTUSAN PEJABAT YANG BERWENANG MEMBERIKAN CUTI</td></tr>'+decRow
      +   '<tr><td colspan="4" style="height:110px;position:relative">'+(dec? sigArea(pk,90) : "")+'</td></tr></table>'

      + '<div style="margin-top:10px;font-size:11px;color:#555">'+catatan(p)+'</div>'
      + '</div>';
  }

  function cetak(){ window.print(); }

  window.SURAT = { html: suratHTML, cetak: cetak };
})();
