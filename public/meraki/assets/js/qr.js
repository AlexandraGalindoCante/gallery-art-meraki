/**
 * qr.js — dibuja los códigos QR de la hoja imprimible.
 *
 * Cada QR usa la dirección real desde la que abres esta hoja. Por eso hay que abrirla
 * desde la dirección FINAL del sitio (ya publicado) antes de imprimir.
 */
(function () {
  "use strict";

  // Dirección base: esta página es .../qr/ (o .../qr/index.html) → la base es la carpeta de arriba.
  var base = location.href.split("#")[0].split("?")[0].replace(/qr\/(index\.html)?$/, "");

  var esPrueba = location.protocol === "file:" || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname);
  var aviso = document.querySelector("[data-aviso]");
  if (aviso && esPrueba) {
    aviso.hidden = false;
    aviso.textContent = "Atención: estás viendo una copia de prueba (" + location.host + "). Estos QR solo funcionan aquí. " +
      "Publica el sitio, abre esta hoja desde su dirección final y recién ahí imprime.";
  }

  document.querySelectorAll(".qr-card").forEach(function (card) {
    var url = base + (card.getAttribute("data-ruta") || "");
    var qr = qrcode(0, "M");               // nivel M: aguanta pequeños daños o reflejos
    qr.addData(url);
    qr.make();
    var svg = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true })
      .replace(/<svg /, '<svg role="img" aria-label="Código QR de ' + (card.querySelector(".qr-title").textContent || "") + '" shape-rendering="crispEdges" ');
    card.querySelector("[data-qr]").innerHTML = svg;
    card.querySelector("[data-url]").textContent = url.replace(/^https?:\/\//, "");

    var dl = card.querySelector("[data-dl]");
    if (dl) {
      // Para descargarlo se le pone un fondo blanco (así se ve bien aunque la imagen se pegue sobre color).
      var archivo = svg.replace(/(<svg[^>]*>)/, '$1<rect width="100%" height="100%" fill="#ffffff"/>');
      dl.href = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(archivo);
      dl.setAttribute("download", (card.getAttribute("data-nombre") || "qr") + ".svg");
    }
  });
})();
