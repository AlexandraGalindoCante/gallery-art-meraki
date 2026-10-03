import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  // La galería de Meraki es un sitio 100% estático (HTML + CSS + JS) en public/meraki/.
  // Se genera con `node tools/build.mjs` desde la carpeta content/. Ver LEEME.md.
  useEffect(() => {
    window.location.replace("/meraki/index.html");
  }, []);

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#fbfaf8", color: "#1f2a2b", fontFamily: "system-ui" }}>
      <p>
        Abriendo la galería de Meraki… <a href="/meraki/index.html" style={{ color: "#e8782b" }}>entrar</a>
      </p>
    </div>
  );
}
