import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: [
        "lib/margin/**/*.ts",
        "lib/ingest/columns.ts",
        "lib/ingest/validate.ts",
        "lib/ingest/merge.ts",
        "lib/ingest/parse.ts",
        "lib/ingest/scan.ts",
        "lib/brief/build.ts",
        "lib/corrections/rules.ts",
        "lib/answers/nl.ts",
      ],
      thresholds: { lines: 80, functions: 80 },
    },
  },
});
