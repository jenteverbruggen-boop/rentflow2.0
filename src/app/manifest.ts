import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RentFlow",
    short_name: "RentFlow",
    description: "Verhuur- en planningsplatform voor projecten en materialen",
    start_url: "/",
    display: "standalone",
    background_color: "#25211c",
    theme_color: "#2a266e",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
