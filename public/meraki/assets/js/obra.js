/**
 * obra.js — lo que se puede hacer con una pintura:
 *   1. Ampliarla (zoom) para ver los detalles.
 *   2. Explorar movimiento (opcional): inclinar el teléfono o mover el cursor.
 *   3. Compartir el enlace de la obra.
 *
 * Nada de esto es necesario para entender la obra: sin JavaScript la página se lee igual.
 */
(function () {
  "use strict";

  var obra = document.querySelector(".obra");
  var canvas = document.querySelector("[data-zoom]");
  if (!obra || !canvas) return;

  var stage = obra.querySelector(".stage");
  var tools = obra.querySelector("[data-tools]");
  var hint = obra.querySelector("[data-hint]");
  var reducirMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ======================================================================
     1. ZOOM
     ====================================================================== */

  var lb, lbImg, lbHint, abridor;
  var z = { s: 1, x: 0, y: 0, ancho: 0, alto: 0, abierto: false };
  var punteros = new Map();
  var gesto = null;

  function crearVisor() {
    lb = document.createElement("div");
    lb.className = "lb";
    lb.hidden = true;
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Pintura ampliada");
    lb.innerHTML =
      '<img class="lb-img" alt="" draggable="false">' +
      '<p class="lb-hint">Pellizca o toca dos veces para acercar</p>' +
      '<button type="button" class="lb-btn lb-close" aria-label="Cerrar">✕</button>' +
      '<div class="lb-bar">' +
        '<button type="button" class="lb-btn" data-z="out" aria-label="Alejar">−</button>' +
        '<button type="button" class="lb-btn" data-z="in" aria-label="Acercar">+</button>' +
      "</div>";
    document.body.appendChild(lb);
    lbImg = lb.querySelector(".lb-img");
    lbHint = lb.querySelector(".lb-hint");

    lb.querySelector(".lb-close").addEventListener("click", function () { cerrar(false); });
    lb.querySelector('[data-z="in"]').addEventListener("click", function () { zoomEn(z.s * 1.6, 0, 0, true); });
    lb.querySelector('[data-z="out"]').addEventListener("click", function () { zoomEn(z.s / 1.6, 0, 0, true); });

    lb.addEventListener("pointerdown", alBajar);
    lb.addEventListener("pointermove", alMover);
    lb.addEventListener("pointerup", alSoltar);
    lb.addEventListener("pointercancel", alSoltar);
    lb.addEventListener("wheel", function (e) {
      e.preventDefault();
      var c = centro();
      zoomEn(z.s * Math.exp(-e.deltaY * 0.0016), e.clientX - c.x, e.clientY - c.y, false);
    }, { passive: false });
    lb.addEventListener("dblclick", function (e) {
      if (e.target.closest(".lb-btn")) return;
      var c = centro();
      zoomEn(z.s > 1.05 ? 1 : 2.5, e.clientX - c.x, e.clientY - c.y, true);
    });
    lb.addEventListener("keydown", teclado);
    window.addEventListener("resize", function () { if (z.abierto) ajustar(); });
    window.addEventListener("popstate", function () { if (z.abierto) cerrar(true); });
  }

  function centro() { return { x: window.innerWidth / 2, y: window.innerHeight / 2 }; }

  /** Tamaño base: la pintura entera dentro de la pantalla. */
  function ajustar() {
    var nw = lbImg.naturalWidth || 1, nh = lbImg.naturalHeight || 1;
    var f = Math.min(window.innerWidth / nw, window.innerHeight / nh) * 0.96;
    z.ancho = nw * f;
    z.alto = nh * f;
    lbImg.style.width = z.ancho + "px";
    lbImg.style.height = z.alto + "px";
    aplicar();
  }

  function limites() {
    var mx = Math.max(0, (z.ancho * z.s - window.innerWidth) / 2);
    var my = Math.max(0, (z.alto * z.s - window.innerHeight) / 2);
    return { mx: mx, my: my };
  }

  function aplicar(suave) {
    var l = limites();
    z.x = Math.max(-l.mx, Math.min(l.mx, z.x));
    z.y = Math.max(-l.my, Math.min(l.my, z.y));
    lbImg.style.transition = suave && !reducirMovimiento ? "transform .2s ease-out" : "none";
    lbImg.style.transform = "translate(-50%, -50%) translate(" + z.x + "px, " + z.y + "px) scale(" + z.s + ")";
  }

  /** Cambia el zoom manteniendo fijo el punto (px, py), medido desde el centro de la pantalla. */
  function zoomEn(nuevo, px, py, suave) {
    nuevo = Math.max(1, Math.min(6, nuevo));
    var k = nuevo / z.s;
    z.x = px - (px - z.x) * k;
    z.y = py - (py - z.y) * k;
    z.s = nuevo;
    if (nuevo === 1) { z.x = 0; z.y = 0; }
    aplicar(suave);
  }

  function alBajar(e) {
    if (e.target.closest(".lb-btn")) return;
    lb.setPointerCapture(e.pointerId);
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesto = { dist: distancia(), s: z.s };
    lbImg.classList.add("is-moving");
  }

  function distancia() {
    var p = Array.from(punteros.values());
    return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }

  function alMover(e) {
    var antes = punteros.get(e.pointerId);
    if (!antes) return;
    var ahora = { x: e.clientX, y: e.clientY };
    if (punteros.size === 1) {
      z.x += ahora.x - antes.x;
      z.y += ahora.y - antes.y;
      aplicar();
    }
    punteros.set(e.pointerId, ahora);
    if (punteros.size === 2 && gesto && gesto.dist) {
      var p = Array.from(punteros.values());
      var c = centro();
      var mx = (p[0].x + p[1].x) / 2 - c.x, my = (p[0].y + p[1].y) / 2 - c.y;
      zoomEn(gesto.s * (distancia() / gesto.dist), mx, my, false);
    }
  }

  function alSoltar(e) {
    punteros.delete(e.pointerId);
    gesto = punteros.size === 2 ? { dist: distancia(), s: z.s } : null;
    if (!punteros.size) lbImg.classList.remove("is-moving");
  }

  function teclado(e) {
    var paso = 60;
    if (e.key === "Escape") { e.preventDefault(); cerrar(false); }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomEn(z.s * 1.4, 0, 0, true); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomEn(z.s / 1.4, 0, 0, true); }
    else if (e.key === "0") { e.preventDefault(); zoomEn(1, 0, 0, true); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); z.x += paso; aplicar(true); }
    else if (e.key === "ArrowRight") { e.preventDefault(); z.x -= paso; aplicar(true); }
    else if (e.key === "ArrowUp") { e.preventDefault(); z.y += paso; aplicar(true); }
    else if (e.key === "ArrowDown") { e.preventDefault(); z.y -= paso; aplicar(true); }
    else if (e.key === "Tab") {
      // El foco se queda dentro del visor mientras está abierto
      var bs = Array.from(lb.querySelectorAll("button"));
      var i = bs.indexOf(document.activeElement);
      e.preventDefault();
      bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus();
    }
  }

  function abrir() {
    if (!lb) crearVisor();
    abridor = document.activeElement;
    lbImg.onload = ajustar;
    lbImg.alt = canvas.getAttribute("data-alt") || "";
    lbImg.src = canvas.getAttribute("href");
    z.s = 1; z.x = 0; z.y = 0; z.abierto = true;
    lb.hidden = false;
    document.documentElement.classList.add("lb-open");
    if (lbImg.complete && lbImg.naturalWidth) ajustar();
    lb.querySelector(".lb-close").focus();
    try { history.pushState({ lb: 1 }, ""); } catch (e) { /* ignorar */ }
    lbHint.style.opacity = "1";
    setTimeout(function () { lbHint.style.transition = "opacity .6s"; lbHint.style.opacity = "0"; }, 2600);
  }

  function cerrar(desdeAtras) {
    if (!z.abierto) return;
    z.abierto = false;
    lb.hidden = true;
    punteros.clear();
    document.documentElement.classList.remove("lb-open");
    if (!desdeAtras && history.state && history.state.lb) history.back();
    if (abridor && abridor.focus) abridor.focus();
  }

  /* Tocar la pintura abre el zoom (pero no si el dedo la estaba arrastrando para moverla). */
  var arrastro = false, inicio = null;
  canvas.addEventListener("pointerdown", function (e) { arrastro = false; inicio = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener("pointermove", function (e) {
    if (inicio && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 9) arrastro = true;
  });
  canvas.addEventListener("click", function (e) {
    e.preventDefault();
    if (arrastro) { arrastro = false; return; }
    abrir();
  });

  /* ======================================================================
     2. EXPLORAR MOVIMIENTO (opcional)
     ====================================================================== */

  var movimiento = { activo: false, sensor: false, base: null, tx: 0, ty: 0, cx: 0, cy: 0, corriendo: false, balanceo: 0, balanceando: false, tocando: false, t: null };
  var MAX = 12;
  var boton = null;

  function poner(nx, ny) {
    movimiento.tx = Math.max(-1, Math.min(1, nx));
    movimiento.ty = Math.max(-1, Math.min(1, ny));
    if (!movimiento.corriendo) { movimiento.corriendo = true; requestAnimationFrame(bucle); }
  }

  function bucle() {
    var m = movimiento;
    m.cx += (m.tx - m.cx) * 0.15;
    m.cy += (m.ty - m.cy) * 0.15;
    var s = stage.style;
    s.setProperty("--ry", (m.cx * MAX).toFixed(2) + "deg");
    s.setProperty("--rx", (-m.cy * MAX).toFixed(2) + "deg");
    s.setProperty("--px", (-m.cx * 16).toFixed(1) + "px");
    s.setProperty("--py", (-m.cy * 16).toFixed(1) + "px");
    s.setProperty("--gx", (50 + m.cx * 45).toFixed(1) + "%");
    s.setProperty("--gy", (30 + m.cy * 45).toFixed(1) + "%");
    if (m.activo && (Math.abs(m.tx - m.cx) > 0.001 || Math.abs(m.ty - m.cy) > 0.001)) requestAnimationFrame(bucle);
    else m.corriendo = false;
  }

  function alInclinar(e) {
    if (!movimiento.activo || e.beta == null) return;
    if (!movimiento.sensor) {
      movimiento.sensor = true;
      movimiento.balanceando = false;
      decir("Inclina tu teléfono para explorar la pintura.");
    }
    if (!movimiento.base) movimiento.base = { b: e.beta, g: e.gamma };
    poner((e.gamma - movimiento.base.g) / 25, (e.beta - movimiento.base.b) / 25);
  }

  function balancear() {
    var m = movimiento;
    if (!m.balanceando || !m.activo) return;
    if (!m.tocando) {
      m.balanceo += 0.012;
      poner(Math.sin(m.balanceo) * 0.6, Math.sin(m.balanceo * 0.7) * 0.35);
    }
    requestAnimationFrame(balancear);
  }

  function decir(texto) { hint.textContent = texto; }

  function aPuntero(e) {
    var r = canvas.getBoundingClientRect();
    poner(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  }
  function alPunteroMouse(e) { if (e.pointerType === "mouse") aPuntero(e); }
  function alTocar(e) { if (e.pointerType !== "mouse") { movimiento.tocando = true; aPuntero(e); } }
  function alTocarMover(e) { if (movimiento.tocando && e.pointerType !== "mouse") aPuntero(e); }
  function alSoltarToque() { movimiento.tocando = false; }

  function esTactil() { return window.matchMedia("(pointer: coarse)").matches; }

  function conSensorOpcional() {
    // iPhone/iPad piden permiso; Android y la mayoría de los demás no.
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      return DeviceOrientationEvent.requestPermission().then(function (r) { return r === "granted"; });
    }
    return Promise.resolve(typeof DeviceOrientationEvent !== "undefined");
  }

  function activar() {
    var m = movimiento;
    m.activo = true; m.sensor = false; m.base = null;
    obra.classList.add("motion-on");
    boton.setAttribute("aria-pressed", "true");
    boton.lastChild.textContent = "Detener movimiento";

    window.addEventListener("pointermove", alPunteroMouse);
    canvas.addEventListener("pointerdown", alTocar);
    canvas.addEventListener("pointermove", alTocarMover);
    window.addEventListener("pointerup", alSoltarToque);
    window.addEventListener("pointercancel", alSoltarToque);

    if (!esTactil()) { decir("Mueve el cursor sobre la pintura."); return; }

    decir("Desliza el dedo sobre la pintura para explorarla.");
    conSensorOpcional().then(function (ok) {
      if (!ok || !m.activo) return;
      window.addEventListener("deviceorientation", alInclinar);
      // Si el teléfono no tiene sensor, queda el deslizar con el dedo (más un suave balanceo).
      m.t = setTimeout(function () {
        if (m.activo && !m.sensor && !reducirMovimiento) { m.balanceando = true; requestAnimationFrame(balancear); }
      }, 1500);
    }).catch(function () { /* queda el deslizar con el dedo */ });
  }

  function detener() {
    var m = movimiento;
    m.activo = false; m.balanceando = false; m.tocando = false;
    clearTimeout(m.t);
    obra.classList.remove("motion-on");
    boton.setAttribute("aria-pressed", "false");
    boton.lastChild.textContent = "Explorar movimiento";
    decir("");
    window.removeEventListener("deviceorientation", alInclinar);
    window.removeEventListener("pointermove", alPunteroMouse);
    canvas.removeEventListener("pointerdown", alTocar);
    canvas.removeEventListener("pointermove", alTocarMover);
    window.removeEventListener("pointerup", alSoltarToque);
    window.removeEventListener("pointercancel", alSoltarToque);
    ["--rx", "--ry", "--px", "--py", "--gx", "--gy"].forEach(function (v) { stage.style.removeProperty(v); });
    m.tx = m.ty = m.cx = m.cy = 0;
  }

  // Si la persona pidió "reducir movimiento" en su teléfono, ni siquiera ofrecemos el botón.
  if (!reducirMovimiento) {
    boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn";
    boton.setAttribute("aria-pressed", "false");
    boton.innerHTML = '<span class="dot" aria-hidden="true"></span><span>Explorar movimiento</span>';
    boton.addEventListener("click", function () { movimiento.activo ? detener() : activar(); });
    tools.appendChild(boton);
  }

  /* ======================================================================
     3. COMPARTIR (con el menú del propio teléfono; no es una red social)
     ====================================================================== */

  if (navigator.share || (navigator.clipboard && navigator.clipboard.writeText)) {
    var compartir = document.createElement("button");
    compartir.type = "button";
    compartir.className = "btn";
    compartir.textContent = "Compartir obra";
    compartir.addEventListener("click", function () {
      var datos = {
        title: obra.getAttribute("data-titulo") + " — " + obra.getAttribute("data-artista"),
        text: "Mira esta obra en Meraki",
        url: location.href.split("#")[0],
      };
      if (navigator.share) {
        navigator.share(datos).catch(function () { /* la persona canceló */ });
      } else {
        navigator.clipboard.writeText(datos.url).then(function () {
          compartir.textContent = "Enlace copiado";
          setTimeout(function () { compartir.textContent = "Compartir obra"; }, 2200);
        });
      }
    });
    tools.appendChild(compartir);
  }
})();
