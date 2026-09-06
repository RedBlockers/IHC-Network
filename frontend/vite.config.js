import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            "/api": { target: "http://localhost:3000", changeOrigin: true },
            "/socket.io": { target: "http://localhost:3000", ws: true, changeOrigin: true },
            "/media": { target: "http://localhost:3000", changeOrigin: true },
        },
    },
    build: {
        target: "es2022",
        sourcemap: false,
    },
});
