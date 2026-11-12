import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          gsap: ["gsap"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
