import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Teaching Success App",
    short_name: "TS App",
    description: "Student, parent, and tutor workflow app for Teaching Success.",
    start_url: "/login",
    display: "standalone",
    background_color: "#eef1f7",
    theme_color: "#2c3a52"
  };
}
