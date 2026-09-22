import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 1430,
    strictPort: true,
  },
  test: {
    environment: "node",
  },
});
