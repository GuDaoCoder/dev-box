import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// Vite 配置文档：https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],

  // 以下选项用于 Tauri 开发和构建流程。
  //
  // 1. 避免 Vite 清屏后遮住 Rust 错误。
  clearScreen: false,
  // 2. Tauri 依赖固定端口；端口被占用时直接失败。
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. Rust 源码由 Cargo 监听，Vite 无需重复监听。
      ignored: ["**/src-tauri/**"],
    },
  },
}));
