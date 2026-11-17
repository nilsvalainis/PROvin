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
    include: ["lib/**/*.test.ts", "lib/**/*.test.tsx", "components/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "lib/test-empty-server-only.ts"),
    },
  },
});
