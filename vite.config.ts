import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
  plugins: [tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // This project's path contains a literal ":" (macOS Maps.app container path).
  // Vite's server.fs.allow containment check breaks on that colon and 403s every
  // request even for files inside the project root, so the allow-list check is
  // disabled here. Safe for local dev; irrelevant to the production build.
  server: { fs: { strict: false } },
});
