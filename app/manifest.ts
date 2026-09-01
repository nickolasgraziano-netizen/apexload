import type { MetadataRoute } from "next";

// Do not force portrait here: if a phone is turned sideways, ApexLoad should
// remain visible and usable instead of blocking the user mid-workout.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ApexLoad",
    short_name: "ApexLoad",
    description: "Your rolling rotation. Tracked, timed, and dialed in.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0B0D10",
    theme_color: "#0B0D10",
    icons: [
      {
        src: "/logo-mark.png",
        sizes: "560x560",
        type: "image/png",
      },
    ],
  };
}
