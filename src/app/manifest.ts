// src/app/manifest.ts
// Next's file-convention manifest — auto-compiled to /manifest.webmanifest
// with a <link rel="manifest"> tag injected automatically. No code
// elsewhere needs to reference this file.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Job Radar",
    short_name: "Job Radar",
    description:
      "A personal job aggregator scraping career pages of companies known to sponsor visas.",
    start_url: "/",
    display: "standalone",
    background_color: "#08080f", // --bg in globals.css
    theme_color: "#08080f",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Padded further inside its canvas than the "any" icons above —
        // Android's adaptive-icon mask crops to a circle, and without
        // that extra margin it clips the dart's flights.
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
