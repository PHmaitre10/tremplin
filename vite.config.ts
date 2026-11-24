import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En développement et en aperçu, /api est relayé vers le backend (pas de CORS à gérer).
const proxy = { "/api": { target: process.env.API_TARGET ?? "http://localhost:8000", changeOrigin: false } };
export default defineConfig({ plugins: [react()], server: { proxy }, preview: { proxy } });
