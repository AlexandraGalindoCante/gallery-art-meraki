/**
 * build.mjs — genera el sitio de Meraki (HTML estático) a partir de la carpeta content/.
 *
 *   node tools/build.mjs
 *
 * Lee:     content/site.json, content/artistas.json, content/obras.json
 * Escribe: public/meraki/  (index, artistas/, artista/<slug>/, obras/, obra/<slug>/, qr/)
 *
 * No necesita instalar nada: solo Node. Las páginas quedan ya armadas (sin esperar a que
 * cargue JavaScript), así abren rápido aunque el visitante llegue con datos móviles.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENIDO = process.env.MERAKI_CONTENIDO || join(RAIZ, "content");
const SALIDA = process.env.MERAKI_SALIDA || join(RAIZ, "public", "meraki");

const errores = [];
const avisos = [];
const falla = (msg) => errores.push(msg);

/* ------------------------------------------------------------------ utilidades */

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function leerJSON(nombre) {
  const ruta = join(CONTENIDO, nombre);
  try {
    return JSON.parse(readFileSync(ruta, "utf8"));
  } catch (e) {
    throw new Error(`No pude leer ${nombre}: ${e.message}`);
  }
}

/** Tamaño en píxeles de un JPG (lee la cabecera, sin librerías). */
function tamanoJpg(ruta) {
  const b = readFileSync(ruta);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if ((m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; }
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) {
      return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(`No pude leer el tamaño de ${ruta}`);
}

/** Solo se aceptan enlaces http(s): evita enlaces raros pegados por error. */
function urlSegura(u, donde) {
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) {
    falla(`${donde}: el enlace debe empezar con https:// (recibí "${u}")`);
    return "";
  }
  return u;
}

function proveedor(url) {
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* ignorar */ }
  if (host.includes("spotify")) return "spotify";
  if (host.includes("youtube") || host === "youtu.be") return "youtube";
  if (host.includes("vimeo")) return "vimeo";
  if (host.includes("music.apple")) return "apple";
  return "otro";
}

const recortar = (s, n) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
};

/* ------------------------------------------------------------------ contenido */

const site = leerJSON("site.json");
const base = String(site.baseUrl || "").replace(/\/+$/, "");
const todosArtistas = leerJSON("artistas.json");
const todasObras = leerJSON("obras.json");

const artistas = [];
for (const a of todosArtistas) {
  if (!SLUG.test(a.slug || "")) { falla(`Artista "${a.nombre}": el slug "${a.slug}" no es válido (minúsculas, números y guiones).`); continue; }
  if (a.publicado === false) { avisos.push(`Artista sin publicar: ${a.nombre}`); continue; }
  if (!a.nombre) falla(`Artista ${a.slug}: falta el nombre.`);
  artistas.push({ ...a, color: a.color || "#e8782b" });
}
const artistaPorSlug = new Map(artistas.map((a) => [a.slug, a]));

function infoImagen(carpeta, nombre, donde) {
  const m = join(SALIDA, "img", carpeta, `${nombre}-m.jpg`);
  const g = join(SALIDA, "img", carpeta, `${nombre}-g.jpg`);
  if (!existsSync(m) || !existsSync(g)) {
    falla(`${donde}: faltan las imágenes img/${carpeta}/${nombre}-m.jpg y ${nombre}-g.jpg (usa tools/optimizar-imagen.ps1).`);
    return null;
  }
  const dm = tamanoJpg(m);
  const dg = tamanoJpg(g);
  return {
    m: `img/${carpeta}/${nombre}-m.jpg`, mw: dm.w,
    g: `img/${carpeta}/${nombre}-g.jpg`, gw: dg.w, gh: dg.h,
  };
}

const TIPOS = { musica: "music", music: "music", video: "video", texto: "text", text: "text", imagen: "image", image: "image", enlace: "link", link: "link" };

const obras = [];
const slugsVistos = new Set();
for (const o of todasObras) {
  if (!SLUG.test(o.slug || "")) { falla(`Obra "${o.titulo}": el slug "${o.slug}" no es válido.`); continue; }
  if (slugsVistos.has(o.slug)) { falla(`El slug "${o.slug}" está repetido.`); continue; }
  slugsVistos.add(o.slug);
  if (o.publicada === false) { avisos.push(`Obra sin publicar: ${o.titulo}${o.pendiente ? " → " + o.pendiente : ""}`); continue; }
  const donde = `Obra "${o.titulo || o.slug}"`;
  const artista = artistaPorSlug.get(o.artista);
  if (!artista) { falla(`${donde}: el artista "${o.artista}" no existe o no está publicado.`); continue; }
  if (!o.titulo) falla(`${donde}: falta el título.`);
  const img = infoImagen("obras", o.imagen || o.slug, donde);
  if (!img) continue;

  const inspiraciones = (o.inspiraciones || []).map((it, n) => {
    const d = `${donde}, inspiración ${n + 1}`;
    const tipo = TIPOS[it.tipo];
    if (!tipo) { falla(`${d}: tipo "${it.tipo}" desconocido (musica, video, texto, imagen o enlace).`); return null; }
    const url = urlSegura(it.url, d);
    if ((tipo === "music" || tipo === "video" || tipo === "link") && !url) { falla(`${d}: falta el enlace (url).`); return null; }
    let imagen = null;
    if (tipo === "image") imagen = infoImagen("inspiracion", it.imagen || "", d);
    let miniatura = null;
    if (tipo === "video" && it.miniatura) miniatura = infoImagen("inspiracion", it.miniatura, d);
    return { tipo, titulo: it.titulo || "", descripcion: it.descripcion || "", texto: it.texto || "", url, imagen, miniatura, proveedor: proveedor(url) };
  }).filter(Boolean);

  let audio = "";
  if (o.audio) {
    audio = /^https?:\/\//i.test(o.audio) ? o.audio : `audio/${o.audio}`;
    if (!/^https?:\/\//i.test(audio) && !existsSync(join(SALIDA, audio))) falla(`${donde}: no encuentro el audio ${audio}.`);
  }

  obras.push({ ...o, artista, img, inspiraciones, audio });
}

/* Orden: por artista (como están en artistas.json) y luego como están en obras.json */
obras.sort((a, b) => artistas.indexOf(a.artista) - artistas.indexOf(b.artista));
const obrasDe = (artista) => obras.filter((o) => o.artista === artista);

if (errores.length) {
  console.error("\nNo se pudo generar el sitio:\n");
  errores.forEach((e) => console.error("  ✗ " + e));
  console.error("");
  process.exit(1);
}

/* ------------------------------------------------------------------ plantillas */

const FUENTES = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Caveat:wght@600&display=swap";

const ruta = {
  inicio: (r) => `${r}index.html`,
  artistas: (r) => `${r}artistas/index.html`,
  obras: (r) => `${r}obras/index.html`,
  artista: (r, s) => `${r}artista/${s}/index.html`,
  obra: (r, s) => `${r}obra/${s}/index.html`,
};

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function pagina({ titulo, descripcion, r, cuerpo, destino, scripts = [], clase = "", og, noindex = false, inicio = false, volver, acento }) {
  const url = base ? `${base}/${destino}` : "";
  const ogImagen = og && base ? `${base}/${og}` : "";
  const metas = [
    url && `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:site_name" content="${esc(site.nombre)}">`,
    `<meta property="og:title" content="${esc(titulo)}">`,
    `<meta property="og:description" content="${esc(descripcion)}">`,
    `<meta property="og:type" content="website">`,
    url && `<meta property="og:url" content="${esc(url)}">`,
    ogImagen && `<meta property="og:image" content="${esc(ogImagen)}">`,
    ogImagen && `<meta name="twitter:card" content="summary_large_image">`,
    // Protección de las obras: sin indexar imágenes sueltas ni uso para entrenar IA (petición de buena fe)
    `<meta name="robots" content="${noindex ? "noindex" : "noimageindex, noai, noimageai"}">`,
  ].filter(Boolean).join("\n  ");

  const cabecera = inicio
    ? ""
    : `<header class="top">
      <a class="brand" href="${ruta.inicio(r)}">${esc(site.nombre)}<small>${esc(site.subtitulo)}</small></a>
      <a class="back" href="${esc(volver?.href || ruta.inicio(r))}" data-back${volver?.obra ? " data-back-obra" : ""}>← Volver</a>
    </header>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(titulo)}</title>
  <meta name="description" content="${esc(descripcion)}">
  <meta name="theme-color" content="#ffffff">
  <link rel="icon" href="${r}favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${FUENTES}">
  <link rel="stylesheet" href="${r}assets/css/meraki.css">
  ${metas}
</head>
<body class="${clase}"${acento ? ` style="--accent:${esc(acento)}"` : ""}>
  <a class="skip" href="#principal">Saltar al contenido</a>
  <div class="wrap">
    ${cabecera}
    <main id="principal">
${cuerpo}
    </main>
    <footer class="foot">
      <p><strong>${esc(site.nombre)}</strong> · ${esc(site.subtitulo)}</p>
      <nav aria-label="Secciones"><a href="${ruta.artistas(r)}">Artistas</a><a href="${ruta.obras(r)}">Obras</a></nav>
      <p class="foot-rights">${esc(site.derechos || "Las obras pertenecen a sus artistas.")}</p>
      ${site.creditos ?`<p class="foot-credit">${esc(site.creditos.texto)} <a href="${esc(urlSegura(site.creditos.url, "creditos"))}" target="_blank" rel="noopener noreferrer">${esc(site.creditos.nombre)}<span class="sr"> (se abre en otra pestaña)</span></a></p>` : ""}
    </footer>
  </div>
  <script src="${r}assets/js/site.js" defer></script>
${scripts.map((s) => `  <script src="${r}${s}" defer></script>`).join("\n")}
</body>
</html>
`;
}

/** Imagen de una obra. `lazy` para listas; la principal de la página carga primero. */
function imgObra(o, r, { lazy = true, sizes = "50vw" } = {}) {
  const alt = o.alt || `${o.titulo}, obra de ${o.artista.nombre}`;
  return `<img src="${r}${o.img.m}" srcset="${r}${o.img.m} ${o.img.mw}w, ${r}${o.img.g} ${o.img.gw}w" sizes="${sizes}" width="${o.img.gw}" height="${o.img.gh}" alt="${esc(alt)}" ${lazy ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">`;
}

function tarjeta(o, r) {
  return `<a class="card" href="${ruta.obra(r, o.slug)}" style="--accent:${esc(o.artista.color)}">
        <span class="thumb" style="aspect-ratio:${o.img.gw}/${o.img.gh}">${imgObra(o, r, { sizes: "(min-width:1000px) 25vw, (min-width:640px) 33vw, 50vw" })}</span>
        <span class="card-title">${esc(o.titulo)}</span>
        <span class="card-meta">${esc(o.artista.nombre)}</span>
      </a>`;
}

const rejilla = (lista, r) => `<div class="grid">\n      ${lista.map((o) => tarjeta(o, r)).join("\n      ")}\n    </div>`;

function indiceArtistas(r) {
  return `<ol class="index">
      ${artistas.map((a, i) => {
        const n = obrasDe(a).length;
        return `<li><a href="${ruta.artista(r, a.slug)}"><span class="idx-name"><b>${String(i + 1).padStart(2, "0")}</b><i class="sw" style="background:${esc(a.color)}"></i>${esc(a.nombre)}</span><span>${n ? plural(n, "obra", "obras") : "Próximamente"}</span></a></li>`;
      }).join("\n      ")}
    </ol>`;
}

/**
 * Obras destacadas del inicio: una obra por artista (la marcada "destacada" o, si no hay, la primera),
 * escogiendo artistas repartidos a lo largo de la lista para que se mezclen y no salgan todas del mismo.
 */
function obrasDestacadas(max) {
  const porArtista = artistas
    .map((a) => { const lista = obrasDe(a); return lista.find((o) => o.destacada) || lista[0]; })
    .filter(Boolean);
  if (porArtista.length <= max) return porArtista;
  return Array.from({ length: max }, (_, i) => porArtista[Math.floor((i * porArtista.length) / max)]);
}

/* ---- Inicio ---- */
function paginaInicio() {
  const r = "";
  const letras = ["c1", "c2", "c3", "c4", "c1", "c2"];
  const logo = [...site.nombre].map((l, i) => `<span class="${letras[i % letras.length]}" aria-hidden="true">${esc(l)}</span>`).join("");
  const destacadas = obrasDestacadas(8);
  const cuerpo = `
    <h1 class="logo" aria-label="${esc(site.nombre)}. ${esc(site.tituloPortada || site.subtitulo)}"><span class="pre" aria-hidden="true">${esc(site.tituloPortada || site.subtitulo)}</span>${logo}</h1>
    <p class="lede">${esc(site.lema)}</p>
    <p class="cta">
      <a class="btn btn-solid" href="${ruta.artistas(r)}">Explorar artistas</a>
      <a class="btn" href="${ruta.obras(r)}">Explorar obras</a>
    </p>

    <section class="bloque" aria-labelledby="h-artistas">
      <h2 class="eyebrow" id="h-artistas">Artistas</h2>
      ${indiceArtistas(r)}
    </section>

    ${destacadas.length ? `<section class="bloque" aria-labelledby="h-obras">
      <h2 class="eyebrow" id="h-obras">Obras destacadas</h2>
      ${rejilla(destacadas, r)}
    </section>` : ""}`;
  return pagina({ titulo: `${site.nombre} · ${site.subtitulo}`, descripcion: site.descripcion, r, cuerpo, destino: "", inicio: true, og: destacadas[0]?.img.g });
}

/* ---- Lista de artistas ---- */
function paginaArtistas() {
  const r = "../";
  const cuerpo = `
    <h1 class="titulo-pagina">Artistas</h1>
    <p class="lede">Toca un nombre para conocer a la persona que pintó y ver todas sus obras.</p>
    <div class="bloque">${indiceArtistas(r)}</div>`;
  return pagina({ titulo: `Artistas · ${site.nombre}`, descripcion: "Conoce a los artistas de Meraki Academia Arte-Café.", r, cuerpo, destino: "artistas/" });
}

/* ---- Lista de obras ---- */
function paginaObras() {
  const r = "../";
  const cuerpo = `
    <h1 class="titulo-pagina">Obras</h1>
    <p class="lede">${plural(obras.length, "pintura", "pinturas")} para descubrir. Toca una para conocer su historia.</p>
    <div class="bloque">${obras.length ? rejilla(obras, r) : '<p class="vacio">Pronto habrá obras aquí.</p>'}</div>`;
  return pagina({ titulo: `Obras · ${site.nombre}`, descripcion: "Todas las obras de Meraki Academia Arte-Café.", r, cuerpo, destino: "obras/" });
}

/* ---- Artista ---- */
function paginaArtista(a) {
  const r = "../../";
  const lista = obrasDe(a);
  const retrato = a.retrato ? infoImagen("artistas", a.retrato, `Artista ${a.nombre}`) : null;
  const cuerpo = `
    <section class="artist-head" style="--accent:${esc(a.color)}">
      <p class="sig">Artista</p>
      <h1>${esc(a.nombre)}</h1>
      ${a.bio || retrato ? `<div class="about${retrato ? " con-retrato" : ""}">
        ${retrato ? `<img class="retrato" src="${r}${retrato.m}" srcset="${r}${retrato.m} ${retrato.mw}w, ${r}${retrato.g} ${retrato.gw}w" sizes="144px" width="144" height="144" alt="Retrato de ${esc(a.nombre)}" decoding="async">` : ""}
        <div>
          <h2 class="eyebrow">Sobre el artista</h2>
          ${a.bio ? a.bio.split(/\n+/).map((p) => `<p class="bio">${esc(p)}</p>`).join("\n          ") : ""}
        </div>
      </div>` : ""}
    </section>

    <section class="bloque" aria-labelledby="h-obras" style="--accent:${esc(a.color)}">
      <h2 class="eyebrow" id="h-obras">Obras${lista.length ? ` · ${plural(lista.length, "obra", "obras")}` : ""}</h2>
      ${lista.length ? rejilla(lista, r) : '<p class="vacio">Pronto habrá obras aquí.</p>'}
    </section>`;
  return pagina({
    titulo: `${a.nombre} · ${site.nombre}`,
    descripcion: recortar(a.bio || `Conoce a ${a.nombre} y sus obras en Meraki.`, 155),
    r, cuerpo, destino: `artista/${a.slug}/`, og: lista[0]?.img.g, acento: a.color,
    volver: { href: ruta.artistas(r), obra: true },
  });
}

/* ---- Inspiración ---- */
const ICONOS = { music: "🎵", video: "🎬", text: "📖", image: "🖼", link: "🔗" };
const PREGUNTAS = {
  music: "Una canción que acompañó esta obra",
  video: "Así nació esta obra",
  text: "Una historia detrás de la obra",
  image: "Imagen de referencia",
  link: "Para saber más",
};
const BOTONES = {
  spotify: "Escuchar en Spotify", youtube: "Ver en YouTube", vimeo: "Ver en Vimeo", apple: "Escuchar en Apple Music",
};

function inspiracion(it, r) {
  const boton = (porDefecto) => `<a class="btn" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">${BOTONES[it.proveedor] || porDefecto}<span class="sr"> (se abre en otra pestaña)</span></a>`;
  const cab = `<span class="ico" aria-hidden="true">${ICONOS[it.tipo]}</span><p class="insp-kicker">${PREGUNTAS[it.tipo]}</p>`;
  let cuerpo = "";
  if (it.tipo === "music") {
    cuerpo = `${it.titulo ? `<p class="insp-title">${esc(it.titulo)}</p>` : ""}${it.descripcion ? `<p class="insp-sub">${esc(it.descripcion)}</p>` : ""}${boton("Escuchar")}`;
  } else if (it.tipo === "video") {
    const mini = it.miniatura
      ? `<a class="video-thumb" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer" aria-hidden="true" tabindex="-1"><img src="${r}${it.miniatura.m}" width="${it.miniatura.mw}" alt="" loading="lazy" decoding="async"><span class="play"></span></a>`
      : "";
    cuerpo = `${mini}${it.titulo ? `<p class="insp-title">${esc(it.titulo)}</p>` : ""}${it.descripcion ? `<p class="insp-sub">${esc(it.descripcion)}</p>` : ""}${boton("Ver video")}`;
  } else if (it.tipo === "text") {
    const texto = it.texto || it.descripcion;
    cuerpo = `${it.titulo ? `<p class="insp-title">${esc(it.titulo)}</p>` : ""}<blockquote class="insp-text" data-more>${texto.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}</blockquote>`;
  } else if (it.tipo === "image") {
    const im = it.imagen;
    cuerpo = `${im ? `<img class="ref-img" src="${r}${im.g}" width="${im.gw}" height="${im.gh}" alt="${esc(it.titulo || "Imagen de referencia")}" loading="lazy" decoding="async">` : ""}${it.titulo ? `<p class="insp-title">${esc(it.titulo)}</p>` : ""}<p class="insp-sub">${esc(it.descripcion || "Esta imagen fue una referencia para la creación de la obra.")}</p>`;
  } else {
    cuerpo = `${it.titulo ? `<p class="insp-title">${esc(it.titulo)}</p>` : ""}${it.descripcion ? `<p class="insp-sub">${esc(it.descripcion)}</p>` : ""}${boton("Abrir enlace")}`;
  }
  return `<li class="insp-item tipo-${it.tipo}"><div class="insp-head">${cab}</div>${cuerpo}</li>`;
}

/* ---- Obra ---- */
function paginaObra(o, i) {
  const r = "../../";
  const a = o.artista;
  const anterior = obras[i - 1];
  const siguiente = obras[i + 1];
  const datos = [o.tecnica, o.anio, o.dimensiones].filter(Boolean).map(esc).join(" · ");
  const alt = o.alt || `${o.titulo}, obra de ${a.nombre}`;

  const insp = o.inspiraciones.length
    ? `<section class="insp" aria-labelledby="h-insp">
        <h2 class="eyebrow" id="h-insp">Inspiración</h2>
        <ul class="insp-list${o.inspiraciones.length === 1 ? " solo" : ""}">
          ${o.inspiraciones.map((it) => inspiracion(it, r)).join("\n          ")}
        </ul>
      </section>`
    : "";

  const audio = o.audio
    ? `<section class="audio"><h2 class="eyebrow">🎧 Escuchar al artista</h2><audio controls preload="none" src="${/^https?:/.test(o.audio) ? esc(o.audio) : r + esc(o.audio)}">Tu navegador no puede reproducir este audio.</audio></section>`
    : "";

  const pager = anterior || siguiente
    ? `<nav class="pager" aria-label="Más obras">
        ${anterior ? `<a class="prev" href="${ruta.obra(r, anterior.slug)}"><small>← Anterior</small><span>${esc(anterior.titulo)}</span></a>` : "<span></span>"}
        ${siguiente ? `<a class="next" href="${ruta.obra(r, siguiente.slug)}"><small>Siguiente →</small><span>${esc(siguiente.titulo)}</span></a>` : "<span></span>"}
      </nav>`
    : "";

  const cuerpo = `
    <article class="obra" style="--accent:${esc(a.color)}" data-titulo="${esc(o.titulo)}" data-artista="${esc(a.nombre)}">
      <div class="obra-media">
        <div class="stage">
          <div class="frame">
            <a class="canvas" href="${r}${o.img.g}" data-zoom data-alt="${esc(alt)}" style="aspect-ratio:${o.img.gw}/${o.img.gh}" aria-label="Ampliar la pintura">
              ${imgObra(o, r, { lazy: false, sizes: "(min-width:900px) 52vw, 100vw" })}
              <span class="glare"></span>
              <span class="zoom-chip" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg>Toca para ampliar</span>
            </a>
          </div>
        </div>
        <div class="tools" data-tools></div>
        <p class="hint" data-hint aria-live="polite"></p>
      </div>

      <div class="obra-info">
        <h1 class="titulo-obra">${esc(o.titulo)}</h1>
        <p class="por">de <a href="${ruta.artista(r, a.slug)}">${esc(a.nombre)}</a></p>
        ${datos ? `<p class="datos">${datos}</p>` : ""}
        <p class="copyright">© ${o.anio ? esc(o.anio) + " " : ""}${esc(a.nombre)}. Todos los derechos reservados.</p>
        ${o.descripcion ? `<p class="descripcion">${esc(o.descripcion)}</p>` : ""}
        ${insp}
        ${audio}
        <p class="ir-artista"><a class="btn btn-solid btn-block" href="${ruta.artista(r, a.slug)}">Conocer al artista</a></p>
      </div>
      ${pager}
    </article>`;

  return pagina({
    titulo: `${o.titulo} · ${a.nombre} · ${site.nombre}`,
    descripcion: recortar(o.descripcion || `${o.titulo}, obra de ${a.nombre} en Meraki ${site.subtitulo}.`, 155),
    r, cuerpo, destino: `obra/${o.slug}/`, og: o.img.g, clase: "pagina-obra", acento: a.color,
    scripts: ["assets/js/obra.js"],
    volver: { href: ruta.obras(r) },
  });
}

/* ---- Hoja de códigos QR (para imprimir) ---- */
function paginaQR() {
  const r = "../";
  const conQR = obras.filter((o) => o.expuesta !== false);
  const tarjetas = [
    `<article class="qr-card" data-ruta="" data-nombre="meraki-galeria">
        <div class="qr-code" data-qr></div>
        <p class="qr-title">Galería Meraki</p>
        <p class="qr-artist">Todas las obras y artistas</p>
        <p class="qr-cta">Escanea para visitar la galería</p>
        <p class="qr-url" data-url></p>
        <a class="qr-dl no-print" data-dl href="#" download>Descargar SVG</a>
      </article>`,
    ...conQR.map((o) => `<article class="qr-card" data-ruta="obra/${o.slug}/" data-nombre="qr-${o.slug}">
        <div class="qr-code" data-qr></div>
        <p class="qr-title">${esc(o.titulo)}</p>
        <p class="qr-artist">${esc(o.artista.nombre)}</p>
        <p class="qr-cta">Escanea para conocer esta obra</p>
        <p class="qr-url" data-url></p>
        <a class="qr-dl no-print" data-dl href="#" download>Descargar SVG</a>
      </article>`),
  ].join("\n      ");

  const cuerpo = `
    <div class="no-print">
      <h1 class="titulo-pagina">Códigos QR</h1>
      <p class="lede">Un QR por cuadro, para pegarlo al lado de cada pintura. Cada uno lleva directo a la página de esa obra.</p>
      <p class="aviso-qr" data-aviso hidden></p>
      <p class="cta"><button class="btn btn-solid" type="button" data-imprimir>Imprimir hoja</button></p>
    </div>
    <div class="qr-sheet">
      ${tarjetas}
    </div>`;
  return pagina({ titulo: `Códigos QR · ${site.nombre}`, descripcion: "Hoja imprimible de códigos QR.", r, cuerpo, destino: "qr/", noindex: true, clase: "pagina-qr", scripts: ["assets/js/vendor/qrcode.js", "assets/js/qr.js"] });
}

/* ------------------------------------------------------------------ escribir archivos */

function escribir(destino, html) {
  const ruta = join(SALIDA, destino, "index.html");
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, html);
}

// Se borran solo las páginas generadas (nunca assets/ ni img/) y se vuelven a crear.
for (const carpeta of ["artistas", "artista", "obras", "obra", "qr"]) rmSync(join(SALIDA, carpeta), { recursive: true, force: true });
mkdirSync(SALIDA, { recursive: true });

writeFileSync(join(SALIDA, "index.html"), paginaInicio());
escribir("artistas", paginaArtistas());
escribir("obras", paginaObras());
escribir("qr", paginaQR());
artistas.forEach((a) => escribir(`artista/${a.slug}`, paginaArtista(a)));
obras.forEach((o, i) => escribir(`obra/${o.slug}`, paginaObra(o, i)));

if (base) {
  const urls = ["", "artistas/", "obras/", ...artistas.map((a) => `artista/${a.slug}/`), ...obras.map((o) => `obra/${o.slug}/`)];
  writeFileSync(join(SALIDA, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(base + "/" + u)}</loc></url>`).join("\n")}\n</urlset>\n`);
}

console.log(`\nSitio de ${site.nombre} generado en ${SALIDA}`);
console.log(`  ${artistas.length} artista(s), ${obras.length} obra(s) publicadas`);
if (avisos.length) {
  console.log("\nPendiente / sin publicar:");
  avisos.forEach((a) => console.log("  · " + a));
}
console.log("");
