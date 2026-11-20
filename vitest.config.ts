import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    // Aizsardzība: testi nekad neraksta produkcijas Blob (sk. failu).
    setupFiles: ["lib/test-setup-no-prod-blob.ts"],
    // Visi TS testi lib/, components/, app/. Releja .mjs testi (relay/) iet ar node --test.
    include: ["{lib,components,app}/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/e2e/**", "**/*.spec.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "lib/test-empty-server-only.ts"),
    },
  },
});
