/* Ikon garis (gaya Hugeicons) — inline, tanpa pustaka luar.
   Elemen dengan atribut data-ic="nama" otomatis disisipi <svg> di depannya. */
(function () {
  "use strict";
  var I = {
    home: '<path d="M4 10.8 12 4l8 6.8"/><path d="M6 9.6V20h12V9.6"/>',
    inbox: '<path d="M4 13h3.6l1.4 2.6h6L16.4 13H20"/><path d="M4.6 12.4 7 5.4A2 2 0 0 1 8.9 4h6.2a2 2 0 0 1 1.9 1.4l2.4 7"/><path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
    docs: '<path d="M8 3h6l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M9.5 13h6M9.5 16.5h4"/>',
    users: '<circle cx="9.5" cy="8" r="3.2"/><path d="M4 19c0-3 2.5-5.2 5.5-5.2S15 16 15 19"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6M20 19c0-2.3-1.3-4.2-3.2-4.9"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.4 2.4 0 1 1 3.4 2.4c-.8.4-1.4 1-1.4 1.9v.4"/><path d="M12 17h.01"/>',
    filePlus: '<path d="M8 3h6l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M12 11.5v5M9.5 14h5"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 1 2.9 6.4"/><path d="M3.5 12H2m1.5 0V9.5"/><path d="M12 7.5V12l3.5 2"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.4 3.1-6.2 7-6.2s7 2.8 7 6.2"/>',
    book: '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H18a1 1 0 0 1 1 1v13.5"/><path d="M5 5.5v12A2.5 2.5 0 0 0 7.5 20H19"/><path d="M19 20a2.5 2.5 0 0 1-2.5-2.5H7.5"/><path d="M9 8h6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/>',
    edit: '<path d="M4 20.5 3.5 21l.5-4L16 4.5a2.1 2.1 0 0 1 3 3L6.5 20z"/><path d="M14 6.5 17.5 10"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5 10.8 15.3 16.2 9"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3.5v4M15 3.5v4"/>',
  };
  function svg(name) {
    return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[name] || "") + "</svg>";
  }
  document.querySelectorAll("[data-ic]").forEach(function (el) {
    el.insertAdjacentHTML("afterbegin", svg(el.getAttribute("data-ic")));
  });
  window.ICONS = { svg: svg };
})();
