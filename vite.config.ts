import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => {
  const contentSecurityPolicy =
    command === "serve"
      ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws://localhost:5173"
      : "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'";

  return {
    base: "./",
    plugins: [
      react(),
      {
        name: "ai-workspace-csp",
        transformIndexHtml(html) {
          return html.replace("__AI_WORKSPACE_CSP__", contentSecurityPolicy);
        }
      }
    ],
    build: {
      outDir: "dist",
      emptyOutDir: true
    }
  };
});
