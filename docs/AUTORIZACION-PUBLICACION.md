# Autorización de publicación de obras e imagen — modelo

> Este es un **modelo de partida**, no asesoría legal. Conviene que Meraki lo revise con una persona de confianza
> en temas legales antes de usarlo. Hay artistas menores de edad: la autorización la firma su madre, padre o
> representante legal.

**Galería digital de Meraki Academia de arte**

**Yo,** ______________________________ , identificado(a) con documento ______________ , en calidad de
☐ artista mayor de edad  ☐ madre/padre/representante legal de ______________________________ (artista menor de edad),

**autorizo** a Meraki Academia de arte a publicar en su galería digital (sitio web y códigos QR de la exposición):

1. ☐ Las fotografías de las obras de la persona artista.
2. ☐ Su nombre (indicar cómo desea que aparezca): ______________________________
3. ☐ Su edad.
4. ☐ Su fotografía de perfil.
5. ☐ Un texto de presentación escrito por la persona artista (o aprobado por ella).

**Entiendo que:**

- Las obras **siguen siendo de la persona artista**, que conserva todos sus derechos de autor. Esta autorización
  solo permite mostrarlas en la galería digital de Meraki; no permite venderlas, copiarlas ni usarlas para otra cosa.
- No se publicará teléfono, dirección, colegio, correo, ubicación ni redes sociales de la persona artista.
- Puedo pedir en cualquier momento que se retire una obra, la foto o el perfil completo, escribiendo a Meraki.
- La publicación en internet puede ser vista por cualquier persona.

Firma: ______________________  Nombre: ______________________  Fecha: ____ / ____ / ________

---

### Para quien administra la galería

- Guarda las autorizaciones firmadas (en papel o digitales) en un lugar seguro, fuera del sitio web.
- Si alguien pide retirar una obra: en `content/obras.json` cambia `"publicada": true` por `false`, ejecuta
  `node tools/build.mjs` y sube los cambios. Para retirar a un artista completo, `"publicado": false` en `content/artistas.json`.
- Las fotos retiradas siguen en el historial de git. Si se necesita borrarlas definitivamente, hay que pedir ayuda.
