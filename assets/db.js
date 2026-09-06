/* Lapisan data — Supabase. Dipakai bersama portal Pegawai & Admin. */
(function () {
  "use strict";
  var C = window.CUTI_CONFIG || {};
  var configured = C.SUPABASE_URL && C.SUPABASE_URL.indexOf("GANTI") < 0;

  var sb = configured
    ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY)
    : null;

  var BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  function parseD(s){ var p=String(s).split("-"); return new Date(+p[0], +p[1]-1, +p[2]); }
  function fmtID(s){ if(!s) return "-"; var d=parseD(s); return d.getDate()+" "+BULAN[d.getMonth()]+" "+d.getFullYear(); }
  function todayISO(){ var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function addDays(iso,n){ var p=iso.split("-"),d=new Date(+p[0],+p[1]-1,+p[2]+n); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function hariCuti(a,b){ if(!a||!b) return 0; var d=Math.round((parseD(b)-parseD(a))/86400000)+1; return d>0?d:0; }
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
  function initials(n){ return String(n||"?").replace(/,.*$/,"").split(/\s+/).slice(0,2).map(function(w){return w[0];}).join("").toUpperCase(); }
  function rupiah(v){ v=String(v||"").replace(/[^\d]/g,""); return v ? v.replace(/\B(?=(\d{3})+(?!\d))/g,".") : ""; }

  var STATUS = {
    MENUNGGU: "Menunggu Verifikasi",
    REVISI: "Perlu Revisi",
    SETUJU: "Disetujui",
    TOLAK: "Tidak Disetujui",
  };
  function badge(st){
    if(st===STATUS.SETUJU) return '<span class="badge b-ok">Disetujui</span>';
    if(st===STATUS.TOLAK)  return '<span class="badge b-bad">Tidak Disetujui</span>';
    if(st===STATUS.REVISI) return '<span class="badge b-rev">Perlu Revisi</span>';
    return '<span class="badge b-warn">Menunggu Verifikasi</span>';
  }

  // ---- auth ----
  async function currentProfile(){
    var u = (await sb.auth.getUser()).data.user;
    if(!u) return null;
    var r = await sb.from("profiles").select("*").eq("id", u.id).single();
    return r.data || null;
  }
  var normEmail = function (e) { return String(e || "").trim().toLowerCase(); };

  async function login(email, password){
    var r = await sb.auth.signInWithPassword({ email: normEmail(email), password: password });
    if(r.error) throw new Error(pesanAuth(r.error.message));
    var prof = await currentProfile();
    if(!prof){ await sb.auth.signOut(); throw new Error("Akun belum memiliki data pegawai. Hubungi admin kepegawaian."); }
    return prof;
  }
  async function daftarPegawai(data){
    var r = await sb.auth.signUp({ email: normEmail(data.email), password: data.password });
    if(r.error) throw new Error(pesanAuth(r.error.message));
    var uid = r.data.user && r.data.user.id;
    if(!uid) throw new Error("Pendaftaran gagal. Coba lagi.");
    if(!r.data.session){
      // "Confirm email" masih ON di Supabase — profil belum bisa disimpan
      return { needConfirm: true };
    }
    var ins = await sb.from("profiles").insert({
      id: uid, nip: String(data.nip).trim(), nama: data.nama.trim(),
      jabatan: data.jabatan.trim(), unit: data.unit.trim(), hp: data.hp.trim(),
      masa_kerja: (data.masa_kerja||"").trim(), role: "pegawai",
    });
    if(ins.error){ throw new Error("Data pegawai gagal disimpan: "+ins.error.message); }
    return { ok: true };
  }
  function lupaSandi(email){
    return sb.auth.resetPasswordForEmail(normEmail(email), { redirectTo: location.origin + location.pathname.replace(/[^/]*$/, "") + "reset.html" });
  }
  async function gantiSandiPemulihan(sandiBaru){
    var r = await sb.auth.updateUser({ password: sandiBaru });
    if(r.error) throw new Error(pesanAuth(r.error.message));
    return true;
  }
  function logout(){ return sb.auth.signOut(); }
  function onAuth(cb){ return sb.auth.onAuthStateChange(cb); }
  function pesanAuth(m){
    m = String(m||"");
    if(/invalid login/i.test(m)) return "Email atau kata sandi salah.";
    if(/already registered/i.test(m)) return "Email sudah terdaftar. Silakan masuk atau pakai “Lupa kata sandi”.";
    if(/password should be at least/i.test(m)) return "Kata sandi terlalu pendek. Minta admin menurunkan batas minimum di pengaturan Supabase.";
    if(/email.*invalid|invalid.*email/i.test(m)) return "Alamat email tidak valid.";
    if(/rate limit/i.test(m)) return "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.";
    return m;
  }

  // ---- profil ----
  function updateProfil(id, patch){ return sb.from("profiles").update(patch).eq("id", id); }
  async function listPegawai(){
    var r = await sb.from("profiles").select("*").order("nama");
    if(r.error) throw r.error; return r.data;
  }

  // ---- pengaturan ----
  var _pengaturan = null;
  async function getPengaturan(force){
    if(_pengaturan && !force) return _pengaturan;
    var r = await sb.from("pengaturan").select("*").eq("id",1).single();
    if(r.error) throw r.error;
    _pengaturan = r.data; return _pengaturan;
  }
  function simpanPengaturan(patch){ _pengaturan=null; return sb.from("pengaturan").update(patch).eq("id",1); }

  async function uploadLegal(file, jenis){ // jenis: 'ttd' | 'cap'
    var ext = (file.name.split(".").pop()||"png").toLowerCase();
    var path = jenis + "-" + Date.now() + "." + ext;
    var up = await sb.storage.from("legalitas").upload(path, file, { upsert:true });
    if(up.error) throw up.error;
    return sb.storage.from("legalitas").getPublicUrl(path).data.publicUrl;
  }

  // ---- pengajuan ----
  var SEL = "*, pemohon:profiles!pengajuan_pemohon_fkey(nip,nama,jabatan,unit,masa_kerja,ttd_path,ttd_pos)";
  async function pengajuanSaya(){
    var r = await sb.from("pengajuan").select(SEL).order("created_at",{ascending:false});
    if(r.error) throw r.error; return r.data;
  }
  async function semuaPengajuan(){
    var r = await sb.from("pengajuan").select(SEL).order("created_at",{ascending:false});
    if(r.error) throw r.error; return r.data;
  }
  async function buatPengajuan(uid, f){
    var row = {
      pemohon: uid, jenis: f.jenis, alasan: f.alasan.trim(),
      mulai: f.mulai, selesai: f.selesai, alamat: (f.alamat||"").trim(),
      telp: f.telp.trim(), sisa_n: +f.sisa_n||6, dokumen: f.dokumen||[],
      status: STATUS.MENUNGGU, tgl_ajukan: todayISO(),
    };
    var r = await sb.from("pengajuan").insert(row).select(SEL).single();
    if(r.error) throw r.error; return r.data;
  }
  async function revisiKirimUlang(id, f){
    var r = await sb.from("pengajuan").update({
      jenis:f.jenis, alasan:f.alasan.trim(), mulai:f.mulai, selesai:f.selesai,
      alamat:(f.alamat||"").trim(), telp:f.telp.trim(), dokumen:f.dokumen||[],
      status: STATUS.MENUNGGU, catatan_revisi: "", updated_at: new Date().toISOString(),
    }).eq("id", id).select(SEL).single();
    if(r.error) throw r.error; return r.data;
  }
  async function mintaRevisi(id, catatan){
    var r = await sb.from("pengajuan").update({
      status: STATUS.REVISI, catatan_revisi: catatan || "Data belum sesuai, mohon diperiksa kembali.",
      updated_at: new Date().toISOString(),
    }).eq("id", id).select(SEL).single();
    if(r.error) throw r.error; return r.data;
  }
  async function tolak(id){
    var r = await sb.from("pengajuan").update({ status: STATUS.TOLAK, updated_at:new Date().toISOString() })
      .eq("id", id).select(SEL).single();
    if(r.error) throw r.error; return r.data;
  }
  async function hapusPengajuan(id){
    var r = await sb.from("pengajuan").delete().eq("id", id);
    if(r.error) throw r.error; return true;
  }
  async function setujuiTerbitkan(id){ // RPC atomik: naikkan counter + set nomor
    var r = await sb.rpc("terbitkan_cuti", { p_id: id });
    if(r.error) throw r.error;
    var d = await sb.from("pengajuan").select(SEL).eq("id", id).single();
    return d.data;
  }
  function docUrl(path){ return sb.storage.from("dokumen").getPublicUrl(path).data.publicUrl; }
  async function uploadDokumen(uid, file){
    var ext=(file.name.split(".").pop()||"pdf").toLowerCase();
    var path = uid + "/" + Date.now() + "-" + Math.random().toString(36).slice(2,7) + "." + ext;
    var up = await sb.storage.from("dokumen").upload(path, file);
    if(up.error) throw up.error;
    return { name: file.name, path: path };
  }
  async function uploadTtdPegawai(uid, file){
    var ext=(file.name.split(".").pop()||"png").toLowerCase();
    var path = uid + "/ttd-" + Date.now() + "." + ext;
    var up = await sb.storage.from("dokumen").upload(path, file, { upsert:true });
    if(up.error) throw up.error;
    return sb.storage.from("dokumen").getPublicUrl(path).data.publicUrl;
  }

  window.DB = {
    configured: configured, sb: sb, STATUS: STATUS, badge: badge,
    fmtID:fmtID, todayISO:todayISO, addDays:addDays, hariCuti:hariCuti, esc:esc, initials:initials, rupiah:rupiah, BULAN:BULAN,
    login:login, logout:logout, daftarPegawai:daftarPegawai, currentProfile:currentProfile, onAuth:onAuth,
    lupaSandi:lupaSandi, gantiSandiPemulihan:gantiSandiPemulihan,
    updateProfil:updateProfil, listPegawai:listPegawai,
    getPengaturan:getPengaturan, simpanPengaturan:simpanPengaturan, uploadLegal:uploadLegal,
    pengajuanSaya:pengajuanSaya, semuaPengajuan:semuaPengajuan, buatPengajuan:buatPengajuan,
    revisiKirimUlang:revisiKirimUlang, mintaRevisi:mintaRevisi, tolak:tolak, hapusPengajuan:hapusPengajuan, setujuiTerbitkan:setujuiTerbitkan,
    uploadDokumen:uploadDokumen, uploadTtdPegawai:uploadTtdPegawai, docUrl:docUrl,
  };
})();
