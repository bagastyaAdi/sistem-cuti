(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var S = DB.STATUS, esc = DB.esc, fmtID = DB.fmtID, hari = DB.hariCuti;
  var ROMAWI = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

  if (!DB.configured) { document.body.innerHTML = '<div class="wrap"><p class="alert alert-bad">Server belum dikonfigurasi. Isi assets/config.js.</p></div>'; return; }

  var me = null, pengaturan = null, rows = [], pegawai = [];

  // ---- tema ----
  (function () {
    var t = null; try { t = localStorage.getItem("cuti-theme"); } catch (e) {}
    if (t) document.documentElement.dataset.theme = t;
    $("themeIco").innerHTML = (document.documentElement.dataset.theme === "dark") ? "&#9789;" : "&#9788;";
    $("btnTheme").onclick = function () {
      var cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("cuti-theme", next); } catch (e) {}
      $("themeIco").innerHTML = next === "dark" ? "&#9789;" : "&#9788;";
    };
  })();
  $("btnLogout").onclick = async function () { await DB.logout(); location.replace("index.html"); };

  function tab(name) {
    document.querySelectorAll("[data-pane]").forEach(function (s) { s.hidden = s.dataset.pane !== name; });
    document.querySelectorAll("[data-tab]").forEach(function (a) { a.classList.toggle("active", a.dataset.tab === name); });
  }
  document.querySelectorAll("[data-tab]").forEach(function (a) {
    a.addEventListener("click", function () { tab(a.dataset.tab); });
  });

  (async function init() {
    me = await DB.currentProfile();
    if (!me) { location.replace("index.html"); return; }
    if (me.role !== "admin") { location.replace("pegawai.html"); return; }
    pengaturan = await DB.getPengaturan();
    $("avatar").textContent = DB.initials(me.nama);
    $("hiNama").textContent = me.nama;
    fillPengaturan();
    await reload();
    $("loading").hidden = true;
    tab("beranda");
  })();

  async function reload() {
    rows = await DB.semuaPengajuan();
    try { pegawai = await DB.listPegawai(); } catch (e) { pegawai = []; }
    renderStats(); renderAntrean(); renderSemua(); renderPegawai();
  }

  function renderStats() {
    var thisMonth = new Date().getMonth();
    $("stPeriksa").textContent = rows.filter(function (r) { return r.status === S.MENUNGGU; }).length;
    $("stRevisi").textContent = rows.filter(function (r) { return r.status === S.REVISI; }).length;
    $("stSetuju").textContent = rows.filter(function (r) { return r.status === S.SETUJU && r.tgl_surat && new Date(r.tgl_surat).getMonth() === thisMonth; }).length;
    $("stPeg").textContent = pegawai.length;
  }

  function itemHTML(r, ringkas) {
    var act = '<button class="btn btn-ghost btn-sm" data-act="lihat" data-id="' + r.id + '">Lihat</button>';
    if (r.status === S.MENUNGGU) act = '<button class="btn btn-primary btn-sm" data-act="periksa" data-id="' + r.id + '">Periksa</button>';
    return '<div class="item">'
      + '<div class="spread"><span class="t">' + esc(r.pemohon.nama) + ' · Cuti ' + esc(r.jenis) + '</span>' + DB.badge(r.status) + '</div>'
      + '<div class="m">NIP ' + esc(r.pemohon.nip) + ' · ' + fmtID(r.mulai) + ' – ' + fmtID(r.selesai) + ' (' + hari(r.mulai, r.selesai) + ' hari)</div>'
      + '<div class="m">Diajukan ' + fmtID(r.tgl_ajukan) + (r.nomor ? ' · ' + esc(r.nomor) : '') + (r.dokumen && r.dokumen.length ? ' · ' + r.dokumen.length + ' dokumen' : '') + '</div>'
      + '<div class="row" style="margin-top:6px">' + act + '</div></div>';
  }

  function renderAntrean() {
    var q = rows.filter(function (r) { return r.status === S.MENUNGGU; });
    $("antreanEmpty").hidden = q.length > 0;
    $("antrean").innerHTML = q.map(function (r) { return itemHTML(r); }).join("");
    var pending = rows.filter(function (r) { return r.status === S.MENUNGGU || r.status === S.REVISI; }).slice(0, 6);
    $("antreanRingkas").innerHTML = pending.length ? pending.map(function (r) { return itemHTML(r); }).join("")
      : '<div class="item m">Tidak ada yang menunggu.</div>';
  }

  function renderSemua() {
    var f = $("filterStatus").value;
    var list = f ? rows.filter(function (r) { return r.status === f; }) : rows;
    $("semuaBody").innerHTML = list.map(function (r) {
      return '<tr>'
        + '<td>' + esc(r.pemohon.nama) + '<div class="m muted" style="font-size:11px">NIP ' + esc(r.pemohon.nip) + '</div></td>'
        + '<td>Cuti ' + esc(r.jenis) + '</td>'
        + '<td class="tnum">' + fmtID(r.tgl_ajukan) + '</td>'
        + '<td class="tnum">' + fmtID(r.mulai) + ' – ' + fmtID(r.selesai) + '</td>'
        + '<td class="tnum">' + (r.nomor || '—') + '</td>'
        + '<td>' + DB.badge(r.status) + '</td>'
        + '<td><button class="btn btn-ghost btn-sm" data-act="lihat" data-id="' + r.id + '">Lihat</button></td>'
        + '</tr>';
    }).join("") || '<tr><td colspan="7" class="muted center" style="padding:24px">Tidak ada data.</td></tr>';
  }
  $("filterStatus").addEventListener("change", renderSemua);

  function renderPegawai() {
    $("pegBody").innerHTML = pegawai.map(function (p) {
      var toggle = p.id === me.id ? '<span class="muted">(Anda)</span>'
        : '<button class="btn btn-ghost btn-sm" data-role="' + (p.role === "admin" ? "pegawai" : "admin") + '" data-id="' + p.id + '">'
          + (p.role === "admin" ? "Jadikan Pegawai" : "Jadikan Admin") + '</button>';
      return '<tr><td class="tnum">' + esc(p.nip) + '</td><td>' + esc(p.nama) + '</td><td>' + esc(p.jabatan) + '</td>'
        + '<td>' + (p.role === "admin" ? '<span class="badge b-rev">Admin</span>' : '<span class="badge b-ok">Pegawai</span>') + '</td>'
        + '<td>' + toggle + '</td></tr>';
    }).join("") || '<tr><td colspan="5" class="muted center" style="padding:24px">Belum ada pegawai terdaftar.</td></tr>';
  }
  $("pegBody").addEventListener("click", async function (e) {
    var b = e.target.closest("button[data-role]"); if (!b) return;
    if (!confirm("Ubah peran pegawai ini menjadi " + b.dataset.role + "?")) return;
    var r = await DB.updateProfil(b.dataset.id, { role: b.dataset.role });
    if (r.error) return alert("Gagal: " + r.error.message);
    await reload();
  });

  // ---- verifikasi / letter ----
  document.body.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-act]"); if (!b) return;
    var r = rows.find(function (x) { return x.id === b.dataset.id; }); if (!r) return;
    openLetter(r, b.dataset.act === "periksa");
  });

  function openLetter(r, review) {
    $("printArea").innerHTML = SURAT.html(r, pengaturan);
    $("modalTitle").textContent = "Formulir Cuti — " + r.pemohon.nama;
    var bar = $("dokBar");
    if (r.dokumen && r.dokumen.length) {
      bar.innerHTML = "Dokumen pendukung: " + r.dokumen.map(function (d) {
        return '<a href="' + DB.docUrl(d.path) + '" target="_blank" rel="noopener">' + esc(d.name) + '</a>';
      }).join(" · ");
      bar.hidden = false;
    } else bar.hidden = true;

    var act = $("modalActions"); act.innerHTML = "";
    if (review && r.status === S.MENUNGGU) {
      mk("Setujui &amp; Terbitkan Nomor", "btn-primary", async function (btn) {
        btn.disabled = true; btn.textContent = "Memproses…";
        try { await DB.setujuiTerbitkan(r.id); close(); await reload(); }
        catch (ex) { alert("Gagal: " + ex.message); btn.disabled = false; }
      });
      mk("Minta Revisi", "btn-ghost", function () {
        act.innerHTML = "";
        var ta = document.createElement("textarea"); ta.placeholder = "Tulis catatan revisi untuk pegawai…"; ta.style.width = "260px"; ta.style.minHeight = "44px";
        var send = mkRaw("Kirim", "btn-primary", async function () {
          try { await DB.mintaRevisi(r.id, ta.value.trim()); close(); await reload(); }
          catch (ex) { alert("Gagal: " + ex.message); }
        });
        var batal = mkRaw("Batal", "btn-ghost", function () { openLetter(r, true); });
        act.appendChild(ta); act.appendChild(send); act.appendChild(batal); ta.focus();
      });
      mk("Tolak", "btn-danger", async function (btn) {
        if (!confirm("Tolak pengajuan ini?")) return;
        btn.disabled = true;
        try { await DB.tolak(r.id); close(); await reload(); } catch (ex) { alert("Gagal: " + ex.message); btn.disabled = false; }
      });
    } else if (r.status === S.SETUJU) {
      mk("Cetak / Unduh PDF", "btn-primary", function () { SURAT.cetak(); });
    }
    $("modal").hidden = false;

    function mk(t, c, fn) { var b = mkRaw(t, c, function () { fn(b); }); act.appendChild(b); return b; }
    function mkRaw(t, c, fn) { var b = document.createElement("button"); b.className = "btn btn-sm " + c; b.innerHTML = t; b.onclick = fn; return b; }
  }
  function close() { $("modal").hidden = true; }
  document.querySelectorAll("[data-close]").forEach(function (b) { b.onclick = close; });
  $("modal").addEventListener("click", function (e) { if (e.target === $("modal")) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  // ---- pengaturan ----
  function fillPengaturan() {
    var s = pengaturan, k = s.pejabat_kepala || {}, a = s.pejabat_atasan || {};
    $("nmFormat").value = s.nomor_format || ""; $("nmNext").value = s.counter || 1; nmPrev();
    $("kJab").value = k.jabatan || ""; $("kNama").value = k.nama || ""; $("kNip").value = k.nip || "";
    $("aJab").value = a.jabatan || ""; $("aNama").value = a.nama || ""; $("aNip").value = a.nip || "";
    $("chkLegal").checked = s.show_legal !== false;
    paintImg("ttdPrev", s.ttd_path); paintImg("capPrev", s.cap_path);
    fillTemplate(s.template || {});
  }

  // ---- template surat ----
  var D = SURAT.DEFAULT_TPL;
  function fillTemplate(t) {
    $("tKopBaris").value = (t.kop_baris || D.kop_baris).join("\n");
    $("tKopSub").value = (t.kop_sub || D.kop_sub).join("\n");
    $("tLogo").value = t.logo_url || "";
    $("tJudul").value = t.judul || D.judul;
    $("tDitujukan").value = t.ditujukan || D.ditujukan;
    $("tKota").value = t.kota || D.kota;
    $("tPenutup").value = t.penutup_pemohon || D.penutup_pemohon;
    $("tCatatan").value = t.catatan_kaki || "";
    var sec = Object.assign({}, D.sec, t.sec || {});
    for (var i = 1; i <= 8; i++) $("tSec" + i).value = sec[i] || "";
  }
  function collectTemplate() {
    var lines = function (id) { return $(id).value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean); };
    var sec = {};
    for (var i = 1; i <= 8; i++) { var v = $("tSec" + i).value.trim(); if (v) sec[i] = v; }
    var t = {};
    var kb = lines("tKopBaris"); if (kb.length) t.kop_baris = kb;
    var ks = lines("tKopSub"); if (ks.length) t.kop_sub = ks;
    if ($("tLogo").value.trim()) t.logo_url = $("tLogo").value.trim();
    if ($("tJudul").value.trim()) t.judul = $("tJudul").value.trim();
    if ($("tDitujukan").value.trim()) t.ditujukan = $("tDitujukan").value.trim();
    if ($("tKota").value.trim()) t.kota = $("tKota").value.trim();
    if ($("tPenutup").value.trim()) t.penutup_pemohon = $("tPenutup").value.trim();
    if ($("tCatatan").value.trim()) t.catatan_kaki = $("tCatatan").value.trim();
    if (Object.keys(sec).length) t.sec = sec;
    return t;
  }
  function contohPengajuan() {
    return {
      pemohon: { nama: "Nama Pegawai, S.Kom", nip: "199001012015011001", jabatan: "Pranata Komputer",
                 unit: "Dinas Komunikasi dan Informatika", masa_kerja: "10 Tahun" },
      jenis: "Tahunan", alasan: "Keperluan keluarga.", mulai: DB.todayISO(), selesai: DB.addDays(DB.todayISO(), 2),
      alamat: "", telp: "08123456789", sisa_n: 12, dokumen: [], status: DB.STATUS.MENUNGGU,
      nomor: "", tgl_ajukan: DB.todayISO(), tgl_surat: null,
    };
  }
  $("formTemplate").addEventListener("submit", async function (e) {
    e.preventDefault();
    var r = await DB.simpanPengaturan({ template: collectTemplate() });
    if (r.error) return alert("Gagal: " + r.error.message);
    pengaturan = await DB.getPengaturan(true); flash(e.target);
  });
  $("tReset").onclick = async function () {
    if (!confirm("Kembalikan semua teks surat ke bawaan?")) return;
    var r = await DB.simpanPengaturan({ template: {} });
    if (r.error) return alert("Gagal: " + r.error.message);
    pengaturan = await DB.getPengaturan(true); fillTemplate({});
  };
  $("tPreview").onclick = function () {
    $("printArea").innerHTML = SURAT.html(contohPengajuan(), pengaturan, collectTemplate());
    $("modalTitle").textContent = "Pratinjau Template (contoh data)";
    $("dokBar").hidden = true; $("modalActions").innerHTML = "";
    $("modal").hidden = false;
  };
  function paintImg(id, url) {
    $(id).innerHTML = url ? '<img src="' + esc(url) + '" style="max-height:80px">' : "belum ada";
  }
  function nmPrev() {
    var n = +$("nmNext").value || 0, d = new Date();
    $("nmPrev").textContent = String($("nmFormat").value)
      .replace(/\{no3\}/g, String(n).padStart(3, "0")).replace(/\{no\}/g, n)
      .replace(/\{bulan\}/g, ROMAWI[d.getMonth() + 1]).replace(/\{tahun\}/g, d.getFullYear());
  }
  $("nmFormat").addEventListener("input", nmPrev);
  $("nmNext").addEventListener("input", nmPrev);

  $("formNomor").addEventListener("submit", async function (e) {
    e.preventDefault();
    var r = await DB.simpanPengaturan({ nomor_format: $("nmFormat").value.trim() || "{no}", counter: Math.max(1, parseInt($("nmNext").value, 10) || 1) });
    if (r.error) return alert("Gagal: " + r.error.message);
    pengaturan = await DB.getPengaturan(true); flash(e.target);
  });
  $("formPejabat").addEventListener("submit", async function (e) {
    e.preventDefault();
    var r = await DB.simpanPengaturan({
      pejabat_kepala: { jabatan: $("kJab").value.trim(), nama: $("kNama").value.trim(), nip: $("kNip").value.trim() },
      pejabat_atasan: { jabatan: $("aJab").value.trim(), nama: $("aNama").value.trim(), nip: $("aNip").value.trim() },
    });
    if (r.error) return alert("Gagal: " + r.error.message);
    pengaturan = await DB.getPengaturan(true); flash(e.target);
  });
  $("chkLegal").addEventListener("change", async function () {
    await DB.simpanPengaturan({ show_legal: this.checked });
    pengaturan = await DB.getPengaturan(true);
  });
  async function upimg(input, jenis, prevId) {
    var f = input.files[0]; if (!f) return;
    if (f.size > 1.5 * 1024 * 1024) { alert("Maksimal 1,5 MB."); input.value = ""; return; }
    try {
      var url = await DB.uploadLegal(f, jenis);
      await DB.simpanPengaturan(jenis === "ttd" ? { ttd_path: url } : { cap_path: url });
      pengaturan = await DB.getPengaturan(true); paintImg(prevId, url);
    } catch (ex) { alert("Gagal unggah: " + ex.message); }
  }
  $("ttdFile").addEventListener("change", function () { upimg(this, "ttd", "ttdPrev"); });
  $("capFile").addEventListener("change", function () { upimg(this, "cap", "capPrev"); });
  $("ttdClear").onclick = async function () { await DB.simpanPengaturan({ ttd_path: "" }); pengaturan = await DB.getPengaturan(true); paintImg("ttdPrev", ""); $("ttdFile").value = ""; };
  $("capClear").onclick = async function () { await DB.simpanPengaturan({ cap_path: "" }); pengaturan = await DB.getPengaturan(true); paintImg("capPrev", ""); $("capFile").value = ""; };

  function flash(form) {
    var s = document.createElement("span"); s.className = "hint"; s.style.color = "var(--ok)"; s.textContent = "  ✓ Tersimpan";
    form.querySelector("button").after(s); setTimeout(function () { s.remove(); }, 2200);
  }
})();
