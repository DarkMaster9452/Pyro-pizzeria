import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pyro & Polomárik — Pizza platforma",
    short_name: "Pyro Pizza",
    description: "Prémiová pizza platforma. Rozvoz a osobný odber.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF8F1",
    theme_color: "#B22222",
    icons: [
      {
        src:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%94%A5%3C/text%3E%3C/svg%3E",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
