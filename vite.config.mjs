import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import glsl from "vite-plugin-glsl";

export default defineConfig({
  plugins: [react(), glsl()],
  base: "/", // Good for most deployments (Vercel, Netlify, etc.)
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  assetsInclude: ["**/*.glb", "**/*.gltf", "**/*.bin", "**/*.jpg", "**/*.png"], // Optional: extend as needed
  server: {
    port: Number(process.env.PORT) || 2000,
    strictPort: true,
  },
});
