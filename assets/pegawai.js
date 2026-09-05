(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var S = DB.STATUS, esc = DB.esc, fmtID = DB.fmtID, hari = DB.hariCuti;

  if (!DB.configured) { document.body.innerHTML = '<div class="wrap"><p class="alert alert-bad">Server belum dikonfigurasi. Isi assets/config.js.</p></div>'; return; }

  var me = null, pengaturan = null, rows = [], editId = null, draft = null;

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

  // ---- tabs ----
  function tab(name) {
    document.querySelectorAll("[data-pane]").forEach(function (s) { s.hidden = s.dataset.pane !== name; });
    document.querySelectorAll("[data-tab]").forEach(function (a) { a.classList.toggle("active", a.dataset.tab === name); });
    if (name === "ajukan" && !editId) resetForm();
  }
  document.querySelectorAll("[data-tab]").forEach(function (a) {
    a.addEventListener("click", function () { if (a.dataset.tab !== "ajukan") editId = null; tab(a.dataset.tab); });
  });
  $("btnAjukan1").onclick = function () { editId = null; tab("ajukan"); };
  $("btnAjukan2").onclick = function () { editId = null; tab("ajukan"); };

  // ---- init ----
  (async function init() {
    me = await DB.currentProfile();
    if (!me) { location.replace("index.html"); return; }
    if (me.role === "admin") { location.replace("admin.html"); return; }
    try { pengaturan = await DB.getPengaturan(); } catch (e) { pengaturan = {}; }

    $("avatar").textContent = DB.initials(me.nama);
    $("hiNama").textContent = me.nama;
    $("hiMeta").textContent = me.jabatan + " · " + me.unit;
    fillProfil();
    await reload();
    $("loading").hidden = true;
    tab("beranda");
  })();

  async function reload() {
    rows = await DB.pengajuanSaya();
    renderRecent(); renderRiwayat(); renderStats();
  }

  function renderStats() {
    var proses = rows.filter(function (r) { return r.status === S.MENUNGGU; }).length;
    var selesai = rows.filter(function (r) { return r.status === S.SETUJU; }).length;
    var revisi = rows.filter(function (r) { return r.status === S.REVISI; }).length;
    var pakai = rows.filter(function (r) { return r.status === S.SETUJU && r.jenis === "Tahunan"; })
      .reduce(function (s, r) { return s + hari(r.mulai, r.selesai); }, 0);
    $("stProses").textContent = proses;
    $("stSelesai").textContent = selesai;
    $("stRevisi").textContent = revisi;
    $("stSisa").textContent = Math.max(0, 12 - pakai);
  }

  function renderRecent() {
    var el = $("recent");
    if (!rows.length) { el.innerHTML = '<div class="item m">Belum ada aktivitas.</div>'; return; }
    el.innerHTML = rows.slice(0, 5).map(function (r) {
      return '<div class="item"><div class="spread"><span class="t">Cuti ' + esc(r.jenis) + ' · ' + hari(r.mulai, r.selesai) + ' hari</span>' + DB.badge(r.status) + '</div>'
        + '<div class="m">Diajukan ' + fmtID(r.tgl_ajukan) + (r.nomor ? ' · ' + esc(r.nomor) : '') + '</div></div>';
    }).join("");
  }

  function renderRiwayat() {
    var el = $("riwayat");
    $("riwayatEmpty").hidden = rows.length > 0;
    el.innerHTML = rows.map(function (r) {
      var act = '<button class="btn btn-ghost btn-sm" data-act="lihat" data-id="' + r.id + '">Lihat</button>';
      if (r.status === S.SETUJU) act += ' <button class="btn btn-primary btn-sm" data-act="pdf" data-id="' + r.id + '">Unduh PDF</button>';
      if (r.status === S.REVISI) act += ' <button class="btn btn-danger btn-sm" data-act="perbaiki" data-id="' + r.id + '">Perbaiki</button>';
      return '<div class="item">'
        + '<div class="spread"><span class="t">Cuti ' + esc(r.jenis) + '</span>' + DB.badge(r.status) + '</div>'
        + '<div class="m">' + fmtID(r.mulai) + ' – ' + fmtID(r.selesai) + ' (' + hari(r.mulai, r.selesai) + ' hari) · diajukan ' + fmtID(r.tgl_ajukan) + '</div>'
        + (r.nomor ? '<div class="m">Nomor: ' + esc(r.nomor) + '</div>' : '')
        + (r.status === S.REVISI && r.catatan_revisi ? '<div class="m" style="color:var(--rev)">Catatan: ' + esc(r.catatan_revisi) + '</div>' : '')
        + '<div class="row" style="margin-top:6px">' + act + '</div></div>';
    }).join("");
  }

  $("riwayat").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-act]"); if (!b) return;
    var r = rows.find(function (x) { return x.id === b.dataset.id; }); if (!r) return;
    if (b.dataset.act === "perbaiki") { editId = r.id; fillForm(r); tab("ajukan"); return; }
    openLetter(r, b.dataset.act === "pdf");
  });

  // ---- form cuti ----
  function fillProfil() {
    $("fNip").value = me.nip; $("fNama").value = me.nama; $("fJab").value = me.jabatan; $("fUnit").value = me.unit;
    $("pNip").value = me.nip; $("pNama").value = me.nama; $("pJab").value = me.jabatan;
    $("pUnit").value = me.unit; $("pHp").value = me.hp; $("pMasa").value = me.masa_kerja || "";
  }
  function resetForm() {
    $("formCuti").reset();
    $("fNip").value = me.nip; $("fNama").value = me.nama; $("fJab").value = me.jabatan; $("fUnit").value = me.unit;
    $("fTelp").value = me.hp;
    $("fMulai").value = DB.addDays(DB.todayISO(), 10);
    $("fSelesai").value = DB.addDays(DB.todayISO(), 12);
    $("fAlasan").value = "";
    updHari(); $("dokList").innerHTML = ""; $("cutiErr").hidden = true;
    $("revBanner").hidden = true; $("ajukanTitle").textContent = "Formulir Permohonan Cuti";
  }
  function fillForm(r) {
    $("fNip").value = r.pemohon.nip; $("fNama").value = r.pemohon.nama;
    $("fJab").value = r.pemohon.jabatan; $("fUnit").value = r.pemohon.unit;
    $("fTelp").value = r.telp; $("fJenis").value = r.jenis;
    $("fMulai").value = r.mulai; $("fSelesai").value = r.selesai;
    $("fAlasan").value = r.alasan; $("fAlamat").value = r.alamat || "";
    updHari(); $("dokList").innerHTML = ""; $("cutiErr").hidden = true;
    $("ajukanTitle").textContent = "Perbaikan Permohonan Cuti";
    if (r.catatan_revisi) { $("revBanner").textContent = "Catatan revisi dari Kepegawaian: " + r.catatan_revisi; $("revBanner").hidden = false; }
  }
  function updHari() {
    var a = $("fMulai").value, b = $("fSelesai").value;
    $("fHari").value = (a && b) ? (hari(a, b) + " hari") : "—";
  }
  $("fMulai").addEventListener("change", updHari);
  $("fSelesai").addEventListener("change", updHari);
  $("fDok").addEventListener("change", function () {
    $("dokList").innerHTML = Array.prototype.map.call(this.files, function (f) {
      return "<li>" + esc(f.name) + " (" + Math.ceil(f.size / 1024) + " KB)</li>";
    }).join("");
  });

  $("formCuti").addEventListener("submit", async function (e) {
    e.preventDefault();
    var err = $("cutiErr"); err.hidden = true;
    var mulai = $("fMulai").value, selesai = $("fSelesai").value;
    if (!$("fTelp").value.trim()) return fail("Nomor HP wajib diisi.");
    if (!$("fAlasan").value.trim()) return fail("Alasan cuti wajib diisi.");
    if (hari(mulai, selesai) <= 0) return fail("Tanggal selesai harus sama atau setelah tanggal mulai.");
    for (var i = 0; i < $("fDok").files.length; i++) if ($("fDok").files[i].size > 5 * 1024 * 1024) return fail("Berkas \"" + $("fDok").files[i].name + "\" melebihi 5 MB.");

    var btn = e.target.querySelector("button"); btn.disabled = true; btn.textContent = "Mengunggah…";
    try {
      var docs = [];
      for (var j = 0; j < $("fDok").files.length; j++) docs.push(await DB.uploadDokumen(me.id, $("fDok").files[j]));
      draft = {
        edit: editId, jenis: $("fJenis").value, alasan: $("fAlasan").value,
        mulai: mulai, selesai: selesai, alamat: $("fAlamat").value, telp: $("fTelp").value,
        sisa_n: 12 - rows.filter(function (r) { return r.status === S.SETUJU && r.jenis === "Tahunan"; }).reduce(function (s, r) { return s + hari(r.mulai, r.selesai); }, 0),
        dokumen: docs,
        pemohon: { nip: me.nip, nama: me.nama, jabatan: me.jabatan, unit: me.unit, masa_kerja: me.masa_kerja },
        tgl_ajukan: editId ? (rows.find(function (r) { return r.id === editId; }) || {}).tgl_ajukan : DB.todayISO(),
        status: S.MENUNGGU, nomor: "", tgl_surat: null,
      };
      openLetter(draft, false, true);
    } catch (ex) { fail("Gagal mengunggah dokumen: " + ex.message); }
    btn.disabled = false; btn.textContent = "Preview Surat";

    function fail(m) { err.textContent = m; err.hidden = false; }
  });

  // ---- letter modal ----
  function openLetter(row, canPrint, isPreview) {
    $("printArea").innerHTML = SURAT.html(row, pengaturan);
    $("modalTitle").textContent = isPreview ? "Preview Surat" : "Formulir Permohonan Cuti";
    var act = $("modalActions"); act.innerHTML = "";
    if (isPreview) {
      var ok = mk("Ajukan Surat", "btn-primary", async function () {
        ok.disabled = true; ok.textContent = "Mengirim…";
        try {
          if (draft.edit) await DB.revisiKirimUlang(draft.edit, draft);
          else await DB.buatPengajuan(me.id, draft);
          close(); editId = null; draft = null;
          await reload(); tab("riwayat");
        } catch (ex) { alert("Gagal mengirim: " + ex.message); ok.disabled = false; ok.textContent = "Ajukan Surat"; }
      });
      mk("Edit", "btn-ghost", function () { close(); });
    } else if (canPrint || row.status === S.SETUJU) {
      mk("Cetak / Unduh PDF", "btn-primary", SURAT.cetak);
    }
    $("modal").hidden = false;
    function mk(t, c, fn) { var b = document.createElement("button"); b.className = "btn btn-sm " + c; b.textContent = t; b.onclick = fn; act.appendChild(b); return b; }
  }
  function close() { $("modal").hidden = true; }
  document.querySelectorAll("[data-close]").forEach(function (b) { b.onclick = close; });
  $("modal").addEventListener("click", function (e) { if (e.target === $("modal")) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  // ---- profil ----
  $("formProfil").addEventListener("submit", async function (e) {
    e.preventDefault();
    var btn = e.target.querySelector("button"); btn.disabled = true;
    var r = await DB.updateProfil(me.id, {
      nama: $("pNama").value.trim(), jabatan: $("pJab").value.trim(), unit: $("pUnit").value.trim(),
      hp: $("pHp").value.trim(), masa_kerja: $("pMasa").value.trim(),
    });
    btn.disabled = false;
    if (r.error) { alert("Gagal menyimpan: " + r.error.message); return; }
    me = await DB.currentProfile();
    $("avatar").textContent = DB.initials(me.nama);
    $("hiNama").textContent = me.nama; $("hiMeta").textContent = me.jabatan + " · " + me.unit;
    fillProfil();
    $("profilMsg").hidden = false; setTimeout(function () { $("profilMsg").hidden = true; }, 2500);
  });
})();
