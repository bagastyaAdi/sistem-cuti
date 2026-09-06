/* Pemotong gambar sederhana (tanpa pustaka luar).
   Pakai: CROP.open(file, function (fileHasilPotong) { ... }); batal -> callback tak dipanggil. */
(function () {
  "use strict";
  var ov, stage, img, box, cb, srcType, srcName;

  function build() {
    ov = document.createElement("div");
    ov.className = "crop-ov";
    ov.innerHTML =
      '<div class="crop-modal">' +
      '  <div class="crop-head"><b>Sesuaikan Gambar</b>' +
      '    <span class="crop-hint">Seret kotak / sudutnya untuk memilih area yang dipakai</span></div>' +
      '  <div class="crop-stage" id="_cStage"><img id="_cImg" alt="">' +
      '    <div class="crop-box" id="_cBox"><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div>' +
      '  </div>' +
      '  <div class="crop-foot">' +
      '    <button type="button" class="btn btn-ghost btn-sm" id="_cCancel">Batal</button>' +
      '    <button type="button" class="btn btn-primary btn-sm" id="_cOk">Pakai</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(ov);
    stage = ov.querySelector("#_cStage");
    img = ov.querySelector("#_cImg");
    box = ov.querySelector("#_cBox");
    ov.querySelector("#_cCancel").onclick = close;
    ov.querySelector("#_cOk").onclick = apply;
    ov.addEventListener("pointerdown", onDown);
    ov.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  var drag = null; // {mode:'move'|'nw'|..., x0,y0, b0:{l,t,w,h}}

  function imgRect() {
    // area gambar sebenarnya di dalam stage (object-fit: contain)
    var sr = stage.getBoundingClientRect();
    var nr = img.naturalWidth / img.naturalHeight;
    var srr = sr.width / sr.height;
    var w, h;
    if (nr > srr) { w = sr.width; h = w / nr; } else { h = sr.height; w = h * nr; }
    return { left: (sr.width - w) / 2, top: (sr.height - h) / 2, width: w, height: h };
  }

  function setBox(l, t, w, h) {
    box.style.left = l + "px"; box.style.top = t + "px";
    box.style.width = w + "px"; box.style.height = h + "px";
  }

  function initBox() {
    var r = imgRect();
    var m = Math.min(r.width, r.height) * 0.08;
    setBox(r.left + m, r.top + m, r.width - 2 * m, r.height - 2 * m);
  }

  function onDown(e) {
    var h = e.target.getAttribute && e.target.getAttribute("data-h");
    if (!h && e.target !== box) return;
    e.preventDefault();
    var b = { l: box.offsetLeft, t: box.offsetTop, w: box.offsetWidth, h: box.offsetHeight };
    drag = { mode: h || "move", x0: e.clientX, y0: e.clientY, b0: b };
  }
  function onMove(e) {
    if (!drag) return;
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    var r = imgRect(), b = drag.b0, l = b.l, t = b.t, w = b.w, hh = b.h, min = 24;
    if (drag.mode === "move") {
      l = b.l + dx; t = b.t + dy;
    } else {
      if (drag.mode.indexOf("w") >= 0) { l = b.l + dx; w = b.w - dx; }
      if (drag.mode.indexOf("e") >= 0) { w = b.w + dx; }
      if (drag.mode.indexOf("n") >= 0) { t = b.t + dy; hh = b.h - dy; }
      if (drag.mode.indexOf("s") >= 0) { hh = b.h + dy; }
      if (w < min) { if (drag.mode.indexOf("w") >= 0) l -= (min - w); w = min; }
      if (hh < min) { if (drag.mode.indexOf("n") >= 0) t -= (min - hh); hh = min; }
    }
    // batasi dalam area gambar
    if (l < r.left) { if (drag.mode === "move") l = r.left; else { w += l - r.left; l = r.left; } }
    if (t < r.top) { if (drag.mode === "move") t = r.top; else { hh += t - r.top; t = r.top; } }
    if (l + w > r.left + r.width) { if (drag.mode === "move") l = r.left + r.width - w; else w = r.left + r.width - l; }
    if (t + hh > r.top + r.height) { if (drag.mode === "move") t = r.top + r.height - hh; else hh = r.top + r.height - t; }
    setBox(l, t, Math.max(min, w), Math.max(min, hh));
  }
  function onUp() { drag = null; }

  function apply() {
    var r = imgRect();
    var sx = (box.offsetLeft - r.left) / r.width * img.naturalWidth;
    var sy = (box.offsetTop - r.top) / r.height * img.naturalHeight;
    var sw = box.offsetWidth / r.width * img.naturalWidth;
    var sh = box.offsetHeight / r.height * img.naturalHeight;
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(sw)); c.height = Math.max(1, Math.round(sh));
    c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    var out = srcType === "image/jpeg" ? "image/jpeg" : "image/png";
    c.toBlob(function (blob) {
      if (!blob) { close(); return; }
      var name = (srcName || "gambar").replace(/\.[^.]+$/, "") + (out === "image/jpeg" ? ".jpg" : ".png");
      var file = new File([blob], name, { type: out });
      var done = cb; close();
      if (done) done(file);
    }, out, 0.92);
  }

  function close() {
    if (ov) ov.classList.remove("open");
    if (img) { URL.revokeObjectURL(img.src); img.removeAttribute("src"); }
    cb = null; drag = null;
  }

  function open(file, callback) {
    if (!file || !/^image\//.test(file.type)) { callback && callback(file); return; }
    if (!ov) build();
    cb = callback; srcType = file.type; srcName = file.name;
    img.onload = function () { ov.classList.add("open"); initBox(); };
    img.src = URL.createObjectURL(file);
  }

  window.CROP = { open: open };
})();
