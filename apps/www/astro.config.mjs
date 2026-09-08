import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  server: { port: 4321 },
  vite: { plugins: [tailwindcss()] },
});
