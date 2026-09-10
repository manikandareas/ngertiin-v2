import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, normalizePath } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const require = createRequire(import.meta.url);
const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: ["cmaps", "standard_fonts", "wasm"].map((folder) => ({
        src: normalizePath(join(pdfjsRoot, folder)),
        dest: `pdfjs/${folder}`,
        rename: { stripBase: true },
      })),
    }),
  ],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
