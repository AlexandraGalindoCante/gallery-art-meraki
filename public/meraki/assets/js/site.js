/**
 * site.js — pequeños detalles comunes a todas las páginas.
 * Todo es opcional: sin JavaScript el sitio se lee y se navega igual.
 */
(function () {
  "use strict";

  // 1. En la barra de direcciones mostramos la URL limpia (…/obra/venom/ en vez de …/obra/venom/index.html)
  try {
    if (/^https?:$/.test(location.protocol) && /\/index\.html$/.test(location.pathname)) {
      history.replaceState(history.state, "", location.pathname.replace(/index\.html$/, "") + location.search + location.hash);
    }
  } catch (e) { /* no pasa nada */ }

  // 2. "← Volver": regresa a donde estaba el visitante (si venía de este mismo sitio)
  var back = document.querySelector("[data-back]");
  if (back) {
    var vinoDeAqui = false;
    try { vinoDeAqui = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) { /* ignorar */ }
    if (vinoDeAqui && history.length > 1) {
      if (back.hasAttribute("data-back-obra") && /\/obra\//.test(document.referrer)) {
        back.textContent = "← Volver a la obra";
      }
      back.addEventListener("click", function (e) {
        e.preventDefault();
        history.back();
      });
    }
  }

  // 3. Textos largos: "Leer más"
  document.querySelectorAll("[data-more]").forEach(function (el) {
    el.classList.add("is-clamped");
    // Si el texto cabe completo, no hace falta "Leer más"
    if (el.scrollHeight <= el.clientHeight + 4) { el.classList.remove("is-clamped"); return; }
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "more-btn";
    btn.textContent = "Leer más";
    btn.setAttribute("aria-expanded", "false");
    btn.addEventListener("click", function () {
      var abierto = el.classList.toggle("is-clamped") === false;
      btn.textContent = abierto ? "Leer menos" : "Leer más";
      btn.setAttribute("aria-expanded", String(abierto));
    });
    el.insertAdjacentElement("afterend", btn);
  });

  // 4. Hoja de QR: botón de imprimir
  var imprimir = document.querySelector("[data-imprimir]");
  if (imprimir) imprimir.addEventListener("click", function () { window.print(); });
})();
