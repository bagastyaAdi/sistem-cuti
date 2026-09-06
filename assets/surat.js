/* Pembangun dokumen cuti (A4) + cetak.
   Seluruh teks tetap surat diambil dari "template" yang bisa diedit admin
   (tersimpan di pengaturan.template). Bila sebuah field kosong -> pakai bawaan.
   Surat yang SUDAH disetujui memakai snapshot template saat penerbitan
   (pengajuan.template_snapshot) sehingga cetak ulang selalu sama walau
   template kemudian diubah. */
(function () {
  "use strict";
  var esc = DB.esc, fmtID = DB.fmtID, hari = DB.hariCuti, S = DB.STATUS;

  var DEFAULT_TPL = {
    kop_baris: ["PEMERINTAH KABUPATEN BADUNG", "DINAS KOMUNIKASI DAN INFORMATIKA"],
    kop_sub: [
      "PUSAT PEMERINTAHAN KABUPATEN BADUNG “MANGUPRAJA MANDALA”",
      "Jl. Raya Sempidi, Kel. Sempidi, Kec. Mengwi, Kab. Badung – Bali",
      "Telp. (0361) 419888, (0361) 9066229, Kode Pos 80351 · Email: diskominfo@badungkab.go.id",
    ],
    logo_url: "",
    judul: "FORMULIR PERMINTAAN DAN PEMBERIAN CUTI",
    ditujukan: "Yth. Kepala Dinas Komunikasi dan Informatika Kabupaten Badung",
    kota: "Mangupura",
    penutup_pemohon: "Hormat Saya,",
    catatan_kaki: "",
    sec: {
      "1": "I. DATA PEGAWAI",
      "2": "II. JENIS CUTI YANG DIAMBIL",
      "3": "III. ALASAN CUTI",
      "4": "IV. LAMANYA CUTI",
      "5": "V. CATATAN CUTI",
      "6": "VI. ALAMAT SELAMA MENJALANKAN CUTI",
      "7": "VII. PERTIMBANGAN ATASAN LANGSUNG",
      "8": "VIII. KEPUTUSAN PEJABAT YANG BERWENANG MEMBERIKAN CUTI",
    },
  };

  function mergeTpl(t) {
    t = t || {};
    var o = JSON.parse(JSON.stringify(DEFAULT_TPL));
    Object.keys(DEFAULT_TPL).forEach(function (k) {
      if (k === "sec") return;
      if (t[k] != null && !(Array.isArray(t[k]) && t[k].length === 0) && t[k] !== "") o[k] = t[k];
    });
    o.sec = Object.assign({}, DEFAULT_TPL.sec, t.sec || {});
    return o;
  }

  // Ambil konfigurasi efektif: snapshot (kalau surat sudah terbit) atau pengaturan live.
  function effectiveCfg(p, s) {
    if (p.template_snapshot && p.template_snapshot.template) return p.template_snapshot;
    s = s || {};
    return {
      template: s.template, pejabat_kepala: s.pejabat_kepala, pejabat_atasan: s.pejabat_atasan,
      ttd_path: s.ttd_path, cap_path: s.cap_path, show_legal: s.show_legal,
    };
  }

  function chk(on) { return on ? '<span class="chk">&#10003;</span>' : ""; }

  function catatanStatus(p) {
    if (p.status === S.SETUJU) return "Diverifikasi &amp; diterbitkan oleh Sub Bagian Kepegawaian pada " + fmtID(p.tgl_surat) + ".";
    if (p.status === S.TOLAK) return "Pengajuan tidak disetujui oleh Sub Bagian Kepegawaian.";
    if (p.status === S.REVISI) return "Perlu revisi &mdash; " + esc(p.catatan_revisi || "silakan perbaiki data lalu kirim ulang.");
    return "Draf &mdash; menunggu verifikasi Sub Bagian Kepegawaian. Nomor surat terbit otomatis setelah disetujui.";
  }

  // p = row pengajuan (dengan p.pemohon); s = row pengaturan (live). preview: paksa template tertentu.
  function suratHTML(p, s, previewTpl) {
    var cfg = previewTpl
      ? { template: previewTpl, pejabat_kepala: (s || {}).pejabat_kepala, pejabat_atasan: (s || {}).pejabat_atasan,
          ttd_path: (s || {}).ttd_path, cap_path: (s || {}).cap_path, show_legal: (s || {}).show_legal }
      : effectiveCfg(p, s);
    var T = mergeTpl(cfg.template);
    var m = p.pemohon || {};
    var pk = cfg.pejabat_kepala || {}, pa = cfg.pejabat_atasan || {};
    var approved = p.status === S.SETUJU, rejected = p.status === S.TOLAK;
    var dec = approved ? "ok" : rejected ? "no" : "";
    var legal = approved && cfg.show_legal !== false;
    var J = function (k) { return p.jenis === k; };
    var logo = T.logo_url || "logo-badung.png";

    var kop = '<div class="kop"><div style="width:74px"><img src="' + esc(logo) + '" alt="" style="width:100%"></div><div class="l">'
      + T.kop_baris.map(function (b) { return '<div class="b" style="font-size:15px">' + esc(b) + "</div>"; }).join("")
      + T.kop_sub.map(function (b) { return '<div style="font-size:10.5px">' + esc(b) + "</div>"; }).join("")
      + "</div></div>";

    var jenisRows =
      '<tr><td>1. Cuti Tahunan</td><td class="ctr">' + chk(J("Tahunan")) + '</td><td>2. Cuti Besar</td><td class="ctr">' + chk(J("Besar")) + "</td></tr>"
      + '<tr><td>3. Cuti Sakit</td><td class="ctr">' + chk(J("Sakit")) + '</td><td>4. Cuti Melahirkan</td><td class="ctr">' + chk(J("Melahirkan")) + "</td></tr>"
      + '<tr><td>5. Cuti Karena Alasan Penting</td><td class="ctr">' + chk(J("Karena Alasan Penting")) + '</td><td>6. Cuti di Luar Tanggungan Negara</td><td class="ctr">' + chk(J("Di Luar Tanggungan Negara")) + "</td></tr>";

    var decRow =
      '<tr><td class="ctr b">DISETUJUI<br>' + chk(dec === "ok") + "</td>"
      + '<td class="ctr b">PERUBAHAN<br></td><td class="ctr b">DITANGGUHKAN<br></td>'
      + '<td class="ctr b">TIDAK DISETUJUI<br>' + chk(dec === "no") + "</td></tr>";

    function sigArea(pej, tinggi) {
      var stamp = "";
      if (legal) {
        if (cfg.cap_path) stamp += '<img alt="Cap" src="' + esc(cfg.cap_path) + '" style="position:absolute;left:-44px;top:-4px;width:118px;opacity:.82">';
        if (cfg.ttd_path) stamp += '<img alt="TTD" src="' + esc(cfg.ttd_path) + '" style="position:absolute;left:8px;top:2px;width:128px">';
      }
      var gap = legal ? '<div style="position:relative;height:' + (tinggi - 30) + 'px;width:230px">' + stamp + "</div>" : "<br><br><br>";
      return esc(pej.jabatan || "") + ",<br>" + gap + "(" + esc(pej.nama || "..............................") + ")<br>NIP. " + esc(pej.nip || "..............................");
    }

    var dok = (p.dokumen && p.dokumen.length)
      ? "<br><br>Dokumen pendukung: " + esc(p.dokumen.map(function (d) { return d.name || d; }).join(", "))
      : "";

    return '<div class="paper">'
      + kop
      + '<table class="nb" style="margin-bottom:10px"><tr><td style="width:55%"></td>'
      + "<td>" + esc(T.kota) + ", " + (p.tgl_ajukan ? fmtID(p.tgl_ajukan) : "........................") + "<br>Kepada<br>" + esc(T.ditujukan) + "<br>di -<br>&nbsp;&nbsp;&nbsp;&nbsp;" + esc(T.kota) + "</td></tr></table>"
      + '<div class="ctr b" style="text-decoration:underline;font-size:14px">' + esc(T.judul) + "</div>"
      + '<div class="ctr" style="margin-bottom:10px">Nomor : ' + esc(p.nomor || ".................../Diskominfo") + "</div>"

      + '<table><tr><td colspan="4" class="st">' + esc(T.sec["1"]) + "</td></tr>"
      + '<tr><td style="width:22%">Nama</td><td style="width:38%">' + esc(m.nama) + '</td><td style="width:15%">NIP</td><td class="tnum">' + esc(m.nip) + "</td></tr>"
      + "<tr><td>Jabatan</td><td>" + esc(m.jabatan) + "</td><td>Masa Kerja</td><td>" + esc(m.masa_kerja || "-") + "</td></tr>"
      + '<tr><td>Unit Kerja</td><td colspan="3">' + esc(m.unit) + "</td></tr></table>"

      + '<table style="border-top:0"><tr><td colspan="4" class="st">' + esc(T.sec["2"]) + "</td></tr>" + jenisRows + "</table>"
      + '<table style="border-top:0"><tr><td class="st">' + esc(T.sec["3"]) + "</td></tr><tr><td>" + esc(p.alasan) + "</td></tr></table>"
      + '<table style="border-top:0"><tr><td colspan="4" class="st">' + esc(T.sec["4"]) + "</td></tr>"
      + '<tr><td style="width:12%">Selama</td><td style="width:20%">' + hari(p.mulai, p.selesai) + " (hari)</td>"
      + '<td style="width:16%">Mulai Tanggal</td><td>' + fmtID(p.mulai) + " s/d " + fmtID(p.selesai) + "</td></tr></table>"

      + '<table style="border-top:0"><tr><td colspan="2" class="st">' + esc(T.sec["5"]) + "</td></tr>"
      + '<tr><td style="width:60%">1. Cuti Tahunan &mdash; sisa tahun berjalan (N)</td><td class="tnum">' + esc(p.sisa_n) + "</td></tr>"
      + '<tr><td>2. Cuti Besar</td><td class="tnum">0</td></tr><tr><td>3. Cuti Sakit</td><td class="tnum">0</td></tr>'
      + '<tr><td>4. Cuti Melahirkan</td><td class="tnum">0</td></tr><tr><td>5. Cuti Karena Alasan Penting</td><td class="tnum">0</td></tr>'
      + '<tr><td>6. Cuti di Luar Tanggungan Negara</td><td class="tnum">0</td></tr></table>'

      + '<table style="border-top:0"><tr><td colspan="2" class="st">' + esc(T.sec["6"]) + "</td></tr>"
      + '<tr><td style="width:70%">' + esc(p.alamat || "(sesuai alamat domisili pada data kepegawaian)") + dok + "</td>"
      + "<td>No. HP / TELP<br>" + esc(p.telp) + "<br><br>" + esc(T.penutup_pemohon) + "<br><br><br>(" + esc(m.nama) + ")<br>NIP. " + esc(m.nip) + "</td></tr></table>"

      + '<table style="border-top:0"><tr><td colspan="4" class="st">' + esc(T.sec["7"]) + "</td></tr>" + decRow
      + '<tr><td colspan="4" style="height:96px;position:relative">' + (dec ? sigArea(pa, 70) : "") + "</td></tr></table>"

      + '<table style="border-top:0"><tr><td colspan="4" class="st">' + esc(T.sec["8"]) + "</td></tr>" + decRow
      + '<tr><td colspan="4" style="height:110px;position:relative">' + (dec ? sigArea(pk, 90) : "") + "</td></tr></table>"

      + (T.catatan_kaki ? '<div style="margin-top:8px;font-size:11px">' + esc(T.catatan_kaki) + "</div>" : "")
      + '<div style="margin-top:8px;font-size:11px;color:#555">' + catatanStatus(p) + "</div>"
      + "</div>";
  }

  function cetak() { window.print(); }

  // Skala dokumen A4 (lebar tetap 820px) agar utuh di layar sempit — tanpa scroll,
  // tanpa terpotong. Cetak tetap ukuran penuh (transform di-reset di @media print).
  function fit() {
    var pa = document.getElementById("printArea");
    var paper = pa && pa.querySelector(".paper");
    if (!paper) return;
    paper.style.transform = "none";
    paper.style.transformOrigin = "top left";
    var avail = pa.clientWidth;
    var natural = paper.offsetWidth || 820;
    var scale = Math.min(1, avail / natural);
    if (scale >= 0.999) { pa.style.height = ""; return; }
    paper.style.transform = "scale(" + scale + ")";
    pa.style.height = (paper.offsetHeight * scale) + "px";
  }
  var _t;
  window.addEventListener("resize", function () { clearTimeout(_t); _t = setTimeout(fit, 120); });

  // render + pas-kan setelah modal tampil (dua frame)
  function render(html) {
    var pa = document.getElementById("printArea");
    if (!pa) return;
    pa.style.height = "";
    pa.innerHTML = html;
    requestAnimationFrame(function () { requestAnimationFrame(fit); });
  }

  window.SURAT = { html: suratHTML, render: render, fit: fit, cetak: cetak, DEFAULT_TPL: DEFAULT_TPL, mergeTpl: mergeTpl };
})();
