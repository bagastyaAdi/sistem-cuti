(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  function go(role) { location.replace(role === "admin" ? "admin.html" : "pegawai.html"); }

  if (!DB.configured) {
    $("cfgWarn").hidden = false;
    document.querySelectorAll("form button[type=submit]").forEach(function (b) { b.disabled = true; });
    return;
  }

  DB.currentProfile().then(function (p) { if (p) go(p.role); });

  var forms = { masuk: $("formMasuk"), lupa: $("formLupa"), daftar: $("formDaftar") };
  function show(name) {
    for (var k in forms) forms[k].hidden = k !== name;
    $("tabMasuk").classList.toggle("active", name === "masuk" || name === "lupa");
    $("tabDaftar").classList.toggle("active", name === "daftar");
  }
  $("tabMasuk").onclick = function () { show("masuk"); };
  $("tabDaftar").onclick = function () { show("daftar"); };
  $("lnkLupa").onclick = function (e) { e.preventDefault(); show("lupa"); };
  $("lnkKembali").onclick = function (e) { e.preventDefault(); show("masuk"); };

  function busy(form, on, label) {
    var b = form.querySelector("button[type=submit]");
    b.disabled = on; b.textContent = on ? "Memproses…" : label;
  }

  $("formMasuk").addEventListener("submit", async function (e) {
    e.preventDefault();
    var err = $("mErr"); err.hidden = true; busy(this, true);
    try {
      var prof = await DB.login($("mEmail").value, $("mPass").value);
      go(prof.role);
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false; busy(this, false, "Masuk");
    }
  });

  $("formLupa").addEventListener("submit", async function (e) {
    e.preventDefault();
    var msg = $("lMsg"); msg.hidden = true; busy(this, true);
    var r = await DB.lupaSandi($("lEmail").value);
    if (r.error) { msg.className = "alert alert-bad"; msg.textContent = r.error.message; }
    else { msg.className = "alert alert-ok"; msg.textContent = "Tautan terkirim. Cek email Anda (termasuk folder spam)."; }
    msg.hidden = false; busy(this, false, "Kirim Tautan");
  });

  $("formDaftar").addEventListener("submit", async function (e) {
    e.preventDefault();
    var msg = $("dMsg"); msg.hidden = true; busy(this, true);
    try {
      var res = await DB.daftarPegawai({
        email: $("dEmail").value, nip: $("dNip").value, nama: $("dNama").value,
        jabatan: $("dJab").value, unit: $("dUnit").value, hp: $("dHp").value,
        masa_kerja: $("dMasa").value, password: $("dPass").value,
      });
      msg.className = "alert alert-ok";
      msg.textContent = res.needConfirm
        ? "Pendaftaran diterima. Konfirmasi email Anda dahulu, lalu masuk."
        : "Pendaftaran berhasil. Silakan masuk dengan email dan kata sandi Anda.";
      msg.hidden = false;
      this.reset(); $("dUnit").value = "Dinas Komunikasi dan Informatika";
      setTimeout(function () { show("masuk"); }, 1600);
    } catch (ex) {
      msg.className = "alert alert-bad"; msg.textContent = ex.message; msg.hidden = false;
    }
    busy(this, false, "Daftar");
  });
})();
