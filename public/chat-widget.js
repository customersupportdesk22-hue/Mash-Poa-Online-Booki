/* Floating chat button: opens the full-screen live chat page. */
(function () {
  if (window.MashPoaChat) return;
  var css = document.createElement("style");
  css.textContent = "#mp-chat-launch{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:60;width:54px;height:54px;border-radius:50%;background:#e3221c;color:#fff;display:grid;place-items:center;box-shadow:0 8px 22px #e3221c55;text-decoration:none;-webkit-tap-highlight-color:transparent}#mp-chat-launch[hidden]{display:none}#mp-chat-launch svg{width:26px;height:26px}";
  document.head.appendChild(css);
  var a = document.createElement("a");
  a.id = "mp-chat-launch"; a.href = "/chat.html"; a.setAttribute("aria-label", "Live chat support");
  a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/></svg>';
  document.body.appendChild(a);
  function sync() { a.hidden = /^\/(checkout|chat)/.test(location.pathname) || !!document.querySelector(".sheet-back"); }
  ["pushState", "replaceState"].forEach(function (k) {
    var o = history[k];
    history[k] = function () { var r = o.apply(this, arguments); sync(); return r; };
  });
  window.addEventListener("popstate", sync);
  new MutationObserver(sync).observe(document.body, { childList: true });
  sync();
})();
