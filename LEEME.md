# Meraki — Galería digital conectada por QR

Cada pintura de la exposición tiene un QR al lado. Al escanearlo, el visitante llega **directo a la página de esa obra**
y desde ahí puede seguir: **obra → inspiración → artista → todas sus obras**.

- Sin cuentas, sin app, sin redes sociales, sin likes ni comentarios.
- Pensada primero para el celular (y también se ve bien en tablet y computador).
- No muestra fechas ni horarios de la exposición.

## Cómo está armado

```
content/                 ← AQUÍ se edita el contenido (artistas y obras)
  site.json              nombre, lema y (cuando se sepa) la dirección del sitio
  artistas.json          los artistas
  obras.json             las obras y sus inspiraciones
tools/
  build.mjs              arma las páginas a partir de content/
  optimizar-imagen.ps1   prepara una foto para la web (Windows)
public/meraki/           ← el sitio ya armado (no se edita a mano las páginas)
  index.html, artistas/, artista/<nombre>/, obras/, obra/<nombre>/, qr/
  assets/css/meraki.css  los estilos
  assets/js/             zoom, movimiento, QR
  img/                   las fotos
```

Las páginas de `artista/`, `obra/`, `obras/`, `artistas/`, `qr/` y el `index.html` **se generan solas**: si las editas a mano, se borran la próxima vez que se arme el sitio.
Lo que sí se puede editar a mano: `assets/css/meraki.css` (cómo se ve) y `assets/js/` (cómo se comporta).

## Agregar una obra (paso a paso)

1. **Prepara la foto.** Desde la carpeta del proyecto, en PowerShell:

   ```powershell
   .\tools\optimizar-imagen.ps1 -Entrada "C:\fotos\mi-pintura.jpg" -Nombre el-mundo-de-colores
   ```

   El nombre va en minúsculas, sin tildes ni espacios (usa guiones). Esto crea `…-m.jpg` (miniatura) y `…-g.jpg` (grande) en `public/meraki/img/obras/`.
   Tip: fotografía la pintura de frente, con luz pareja y sin reflejos.

2. **Agrega la obra** en `content/obras.json` (copia una existente y cambia los datos):

   ```json
   {
     "slug": "el-mundo-de-colores",
     "artista": "alana-cortes",
     "titulo": "El mundo de colores",
     "imagen": "el-mundo-de-colores",
     "tecnica": "Óleo sobre lienzo",
     "anio": "2026",
     "dimensiones": "40 × 50 cm",
     "descripcion": "Texto corto sobre la obra.",
     "destacada": false,
     "expuesta": true,
     "publicada": true
   }
   ```

   - `slug`: el nombre que irá en la dirección (`…/obra/el-mundo-de-colores/`). **No lo cambies después de imprimir el QR.**
   - `artista`: el `slug` del artista (está en `artistas.json`).
   - `tecnica`, `anio`, `dimensiones`, `descripcion`: son opcionales; los que no existan simplemente no se muestran.
   - `expuesta`: `true` si el cuadro estará físicamente con su QR. Con `false` la obra solo vive en la galería digital.
   - `publicada`: `false` la deja guardada pero oculta.

3. **Arma el sitio:**

   ```powershell
   node tools/build.mjs
   ```

   Si algo falta (una foto, un enlace mal escrito…), el script te dice exactamente qué.

## Agregar un artista

En `content/artistas.json`:

```json
{
  "slug": "alana-cortes",
  "nombre": "Alana Cortes",
  "color": "#b3263a",
  "bio": "Una o dos frases sobre el artista.",
  "retrato": "alana-cortes",
  "publicado": true
}
```

- `color`: el color que identifica al artista en su página.
- `retrato` (opcional): prepáralo con `.\tools\optimizar-imagen.ps1 -Entrada foto.jpg -Nombre alana-cortes -Tipo artistas`.
- Un artista puede tener más obras que las que están en la exposición.

## Inspiración

Cada obra puede tener una o varias inspiraciones (`"inspiraciones": [ … ]`). Tipos:

```json
{ "tipo": "musica", "titulo": "Nombre de la canción", "descripcion": "Nombre del artista musical", "url": "https://open.spotify.com/track/…" },
{ "tipo": "video",  "titulo": "Así nació esta obra", "url": "https://www.youtube.com/watch?v=…", "miniatura": "nombre-de-imagen" },
{ "tipo": "texto",  "titulo": "Una historia", "texto": "Esta obra nació de…" },
{ "tipo": "imagen", "titulo": "Foto de referencia", "imagen": "nombre-de-imagen", "descripcion": "Esta imagen fue una referencia." },
{ "tipo": "enlace", "titulo": "Más sobre el tema", "url": "https://…" }
```

- Las imágenes de inspiración y las miniaturas de video se preparan con `-Tipo inspiracion`.
- Los enlaces se abren en otra pestaña y **nada se reproduce solo**: el visitante decide.
- Si la obra tiene una explicación en audio, agrega `"audio": "nombre.mp3"` y guarda el archivo en `public/meraki/audio/`.

## Publicar en Vercel

El sitio es HTML estático ya armado en `public/meraki/`: no hay nada que instalar ni construir.

1. En vercel.com: *Add New → Project* e importa este repositorio.
2. `vercel.json` ya le indica a Vercel que publique `public/meraki` (sin instalar ni construir) y que use barra final en las direcciones (`/obra/venom/`).
3. Cada vez que subas cambios a `main`, Vercel vuelve a publicar solo.

Si cambias el contenido: edita `content/`, ejecuta `node tools/build.mjs` y sube los cambios (incluida la carpeta `public/meraki`).

## Los códigos QR

1. Publica el sitio.
2. Abre `https://TU-DIRECCIÓN/…/qr/` (la hoja de QR **desde la dirección final**: así los QR llevan al lugar correcto).
3. Imprime la hoja (botón *Imprimir hoja*) o descarga cada QR en SVG para diseñarlo con el rótulo del cuadro.
4. **Prueba al menos un QR con tu celular antes de imprimir todos.**

Hay una tarjeta por obra con `"expuesta": true`, más una tarjeta de la galería completa.

Si la dirección del sitio cambia (por ejemplo, comprando un dominio propio), los QR ya impresos dejan de servir.
Por eso conviene tener la dirección definitiva *antes* de imprimir. En `content/site.json` se puede escribir `baseUrl`
(por ejemplo `https://midominio.com/meraki`) para que el sitio incluya enlaces completos y `sitemap.xml`.

## Privacidad (importante: hay artistas menores de edad)

Publica solo lo que el artista y su familia hayan aprobado. No pongas teléfonos, direcciones, colegio, correo, ubicación ni datos familiares.
No se incluyen redes sociales a propósito.

## Antes de la exposición

- [ ] Todas las obras tienen foto y están en `obras.json` con `"publicada": true`.
- [ ] El sitio está publicado y abre desde un celular con datos móviles.
- [ ] Probaste un QR con tu celular, apuntando a la dirección final.
- [ ] Revisaste los nombres y tildes de artistas y obras.
