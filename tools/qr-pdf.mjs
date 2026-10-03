/**
 * qr-pdf.mjs — genera un PDF (vectorial, A4) con los códigos QR de la galería.
 *
 *   node tools/qr-pdf.mjs --base https://tu-direccion.vercel.app --salida QR.pdf
 *   node tools/qr-pdf.mjs --base https://tu-direccion.vercel.app --obras venom,limones
 *   node tools/qr-pdf.mjs --base https://tu-direccion.vercel.app --obras todas --sin-artistas
 *
 * Seis QR por hoja, con borde punteado para recortar. Cada QR de artista lleva arriba el texto
 * "Escanea este QR para ver más sobre el artista" y abajo el nombre. No necesita instalar nada.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const BASE = String(opt("base", "https://gallery-art-meraki-coral.vercel.app")).replace(/\/+$/, "");
const SALIDA = opt("salida", join(RAIZ, "QR-Meraki.pdf"));
const OBRAS = opt("obras", "");
const CON_ARTISTAS = !args.includes("--sin-artistas");
const TEXTO_ARTISTA = "Escanea este QR para ver más sobre el artista";
const TEXTO_OBRA = "Escanea este QR para ver más sobre la obra";

const qrcode = vm.runInNewContext(readFileSync(join(RAIZ, "public/meraki/assets/js/vendor/qrcode.js"), "utf8") + ";qrcode");
const leer = (f) => JSON.parse(readFileSync(join(RAIZ, "content", f), "utf8"));
const artistas = leer("artistas.json").filter((a) => a.publicado !== false);
const obras = leer("obras.json").filter((o) => o.publicada !== false);

function matriz(url) {
  const q = qrcode(0, "M"); q.addData(url); q.make();
  const n = q.getModuleCount();
  const filas = [];
  for (let r = 0; r < n; r++) { let s = ""; for (let c = 0; c < n; c++) s += q.isDark(r, c) ? "1" : "0"; filas.push(s); }
  return { n, filas };
}

const items = [];
if (CON_ARTISTAS) for (const a of artistas) items.push({ texto: TEXTO_ARTISTA, nombre: a.nombre, m: matriz(`${BASE}/artista/${a.slug}/`) });
const slugsObras = OBRAS === "todas" ? obras.filter((o) => o.expuesta !== false).map((o) => o.slug) : OBRAS.split(",").map((s) => s.trim()).filter(Boolean);
for (const slug of slugsObras) {
  const o = obras.find((x) => x.slug === slug);
  if (!o) { console.error(`No encuentro la obra "${slug}"`); process.exit(1); }
  const a = artistas.find((x) => x.slug === o.artista);
  items.push({ texto: TEXTO_OBRA, nombre: `${o.titulo}${a ? " · " + a.nombre : ""}`, m: matriz(`${BASE}/obra/${o.slug}/`) });
}
if (!items.length) { console.error("No hay nada que generar."); process.exit(1); }

/* Anchos de Helvetica y Helvetica-Bold (ASCII 32..126, milésimas de em) para centrar el texto */
const WR = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const WB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const sinTilde = (c) => c.normalize("NFD").replace(/[̀-ͯ]/g, "");
const ancho = (t, W, sz) => [...t].reduce((a, c) => { const b = sinTilde(c).charCodeAt(0); return a + ((b >= 32 && b <= 126) ? W[b - 32] : 600) * sz / 1000; }, 0);
const esc = (t) => t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const f = (n) => n.toFixed(2);

const PW = 595.28, PH = 841.89, M = 30, G = 14, COLS = 2, ROWS = 3;
const CW = (PW - 2 * M - G) / COLS, CH = (PH - 2 * M - G * (ROWS - 1)) / ROWS;
const quiet = 4;

const paginas = [];
for (let i = 0; i < items.length; i += COLS * ROWS) {
  let s = "";
  items.slice(i, i + COLS * ROWS).forEach((it, k) => {
    const col = k % COLS, row = Math.floor(k / COLS);
    const x0 = M + col * (CW + G), yTop = PH - M - row * (CH + G);
    s += `q 0.62 0.60 0.56 RG 0.8 w [4 3] 0 d ${f(x0)} ${f(yTop - CH)} ${f(CW)} ${f(CH)} re S Q\n`;
    const sz = 9.5;
    s += `BT /F2 ${sz} Tf 0.11 0.15 0.16 rg ${f(x0 + (CW - ancho(it.texto, WB, sz)) / 2)} ${f(yTop - 24)} Td (${esc(it.texto)}) Tj ET\n`;
    const Q = 170, mod = Q / (it.m.n + 2 * quiet), qx = x0 + (CW - Q) / 2, qy = yTop - 36 - Q;
    s += `q 1 1 1 rg ${f(qx)} ${f(qy)} ${f(Q)} ${f(Q)} re f 0 0 0 rg\n`;
    it.m.filas.forEach((fila, r) => {
      let c = 0;
      while (c < it.m.n) {
        if (fila[c] === "1") { const st = c; while (c < it.m.n && fila[c] === "1") c++; s += `${f(qx + (st + quiet) * mod)} ${f(qy + Q - (r + quiet + 1) * mod)} ${f((c - st) * mod)} ${f(mod)} re\n`; }
        else c++;
      }
    });
    s += "f Q\n";
    const sn = 11;
    s += `BT /F2 ${sn} Tf 0.11 0.15 0.16 rg ${f(x0 + (CW - ancho(it.nombre, WB, sn)) / 2)} ${f(qy - 20)} Td (${esc(it.nombre)}) Tj ET\n`;
  });
  paginas.push(s);
}

/* Ensamblado del PDF (texto en WinAnsi/latin1: sirve para tildes y ñ) */
const objs = [];
const add = (b) => { objs.push(b); return objs.length; };
const cat = add(null), pgs = add(null);
const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
const kids = [];
for (const c of paginas) {
  const cs = add(`<< /Length ${Buffer.byteLength(c, "latin1")} >>\nstream\n${c}endstream`);
  const pg = add(`<< /Type /Page /Parent ${pgs} 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${cs} 0 R >>`);
  kids.push(`${pg} 0 R`);
}
objs[cat - 1] = `<< /Type /Catalog /Pages ${pgs} 0 R >>`;
objs[pgs - 1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${kids.length} >>`;
let out = "%PDF-1.4\n";
const off = [];
objs.forEach((o, i) => { off.push(Buffer.byteLength(out, "latin1")); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
const xr = Buffer.byteLength(out, "latin1");
out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${off.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R >>\nstartxref\n${xr}\n%%EOF\n`;
writeFileSync(SALIDA, Buffer.from(out, "latin1"));
console.log(`PDF creado: ${SALIDA}\n  ${items.length} QR en ${paginas.length} hoja(s) · dirección base: ${BASE}`);
