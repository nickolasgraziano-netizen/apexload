import type { MetadataRoute } from "next";

// Orientation lock only takes effect when the app is installed to a home
// screen (display: "standalone") — a regular browser tab always follows
// the device's rotation regardless of what's declared here. The CSS
// landscape guard in globals.css is what actually enforces portrait-only
// in every context, this just makes the installed-app case match too.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ApexLoad",
    short_name: "ApexLoad",
    description: "Your rolling rotation. Tracked, timed, and dialed in.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
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
